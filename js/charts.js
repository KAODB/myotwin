/*
 * MyoTwin drawing primitives: time-series line chart (SVG), image and colour
 * scale (canvas), radiation direction rose (SVG) and status icon references.
 * Pure helpers with no app state. Colours of SVG marks come from CSS classes
 * (so the theme can change them); canvas colormaps are computed here from the
 * stylesheet's --map-* stops.
 * Loads in Node without touching the DOM; only the drawing calls need one.
 *
 * Written with an SI tool (Claude) and reviewed by the team.
 */
(function (root) {
  'use strict';
  var ns = (root.MyoTwin = root.MyoTwin || {});
  var inNode = typeof module === 'object' && module.exports;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  // ---- status vocabulary -------------------------------------------------------
  // Every status is shown with a shape and a word, never colour alone.
  var STATUS = {
    green: { word: 'In range', shape: 'circle', icon: '#st-green' },
    amber: { word: 'Watch', shape: 'triangle', icon: '#st-amber' },
    red: { word: 'Report', shape: 'octagon', icon: '#st-red' },
    grey: { word: 'No data', shape: 'dash', icon: '#st-grey' }
  };
  function statusKey(s) { return STATUS[s] ? s : 'grey'; }

  /** SVG symbol reference (for <use href>) for a status. */
  function statusIcon(status) { return STATUS[statusKey(status)].icon; }

  /** Small inline <svg><use></svg> element for a status icon (needs a DOM). */
  function statusIconEl(status, size) {
    var s = statusKey(status);
    var svg = el('svg', { 'class': 'st-icon st-' + s, width: size || 16, height: size || 16,
      viewBox: '0 0 16 16', 'aria-hidden': 'true', focusable: 'false' });
    el('use', { href: STATUS[s].icon }, svg);
    return svg;
  }

  // ---- small pure helpers ------------------------------------------------------
  /** "Nice" axis ticks (1, 2, 2.5, 5 x 10^k) covering [lo, hi]. */
  function niceTicks(lo, hi, count) {
    if (!isFinite(lo) || !isFinite(hi)) return [];
    if (lo === hi) { lo -= 1; hi += 1; }
    var raw = (hi - lo) / Math.max(1, count || 5);
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var step = mag;
    [1, 2, 2.5, 5, 10].some(function (m) { step = m * mag; return step >= raw; });
    var out = [];
    for (var v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) {
      out.push(Math.round(v / step) * step);
    }
    return out;
  }

  function fmt(v) {
    var a = Math.abs(v);
    if (a !== 0 && (a >= 1e4 || a < 0.01)) return v.toExponential(1);
    var d = a >= 100 ? 0 : a >= 10 ? 1 : 2;
    return String(+v.toFixed(d));
  }

  /** Dose in the card's units, as [number, unit]: µGy below 1,000, mGy with one decimal from 1,000 up. */
  function doseParts(uGy) { return uGy >= 1000 ? [(uGy / 1000).toFixed(1), 'mGy'] : [String(Math.round(uGy)), 'µGy']; }
  /** Axis tick for a dose: the card's units and rounding without a trailing ".0" (1000 -> "1 mGy"). */
  function doseTick(uGy) { var p = doseParts(uGy); return String(+p[0]) + ' ' + p[1]; }

  /** True when the positive values span more than `ratio` (default 50), largest over smallest. */
  function useLogScale(values, ratio) {
    var v = (values || []).filter(function (x) { return x != null && isFinite(x) && x > 0; });
    if (v.length < 2) return false;
    return Math.max.apply(null, v) / Math.min.apply(null, v) > (ratio || 50);
  }

  /** log10 axis from lo to hi (positive) over [top, top + height]: y mapping and the decade ticks inside. */
  function logAxis(lo, hi, top, height) {
    var l0 = Math.log10(lo), l1 = Math.log10(hi), ticks = [];
    for (var k = Math.ceil(l0 - 1e-9); k <= l1 + 1e-9; k++) ticks.push(Math.pow(10, k));
    return { ticks: ticks, y: function (v) { return top + (1 - (Math.log10(v) - l0) / (l1 - l0)) * height; } };
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }

  function ramp(stops, t) {
    t = clamp01(t);
    var n = stops.length - 1, i = Math.min(n - 1, Math.floor(t * n)), f = t * n - i;
    var a = stops[i], b = stops[i + 1];
    return [Math.round(lerp(a[0], b[0], f)), Math.round(lerp(a[1], b[1], f)), Math.round(lerp(a[2], b[2], f))];
  }

  // Perceptually ordered ramps built from the palette in css/style.css: 'heat' is a single-hue
  // ramp black - working blue - white; 'diverging' is blue - neutral - accent (safe for red-green
  // colour blindness), centred on 0 by the caller; 'gray' stays neutral. In a browser the stops
  // are read from --map-heat and --map-diverging on <body>; these copies of the same values are
  // used in Node and as a fallback.
  var MAPS = {
    gray: [[12, 16, 24], [235, 239, 245]],
    heat: [[2, 7, 10], [1, 79, 117], [2, 151, 222], [166, 221, 245], [252, 255, 255]],
    diverging: [[1, 79, 117], [2, 151, 222], [220, 228, 234], [252, 115, 77], [178, 63, 31]]
  };

  /** Hex stops ("#rrggbb #rrggbb ...") as [[r, g, b], ...], or null when there are fewer than two. */
  function parseStops(str) {
    var hex = String(str || '').match(/#[0-9a-f]{6}\b/gi) || [];
    return hex.length < 2 ? null : hex.map(function (h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); });
  }

  /** The colormaps for the current presentation (read once per drawing call). */
  function themeMaps() {
    var doc = root.document;
    if (!doc || !doc.body || !root.getComputedStyle) return MAPS;
    var cs = root.getComputedStyle(doc.body);
    return {
      gray: MAPS.gray,
      heat: parseStops(cs.getPropertyValue('--map-heat')) || MAPS.heat,
      diverging: parseStops(cs.getPropertyValue('--map-diverging')) || MAPS.diverging
    };
  }

  /** Colour for t in [0, 1] on a named colormap, as [r, g, b]; `maps` defaults to the built-in copies. */
  function colormap(name, t, maps) { maps = maps || MAPS; return ramp(maps[name] || maps.gray, t); }

  /** Map a value to [0, 1]; diverging maps are centred on 0. */
  function normalise(v, min, max, name) {
    if (name === 'diverging') {
      var m = Math.max(Math.abs(min), Math.abs(max)) || 1;
      return 0.5 + 0.5 * (v / m);
    }
    return max > min ? (v - min) / (max - min) : 0.5;
  }

  /** The points of nights up to and including `day` (all of them when `day` is null). */
  function upToDay(points, day) {
    return day == null ? (points || []) : (points || []).filter(function (p) { return p.missionDay <= day; });
  }

  // ---- DOM helpers -------------------------------------------------------------
  function el(tag, attrs, parent) {
    var n = root.document.createElementNS(SVG_NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] != null) n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }
  function text(parent, x, y, str, cls, anchor) {
    var t = el('text', { x: x, y: y, 'class': cls || 'ax-label', 'text-anchor': anchor || 'middle' }, parent);
    t.textContent = str;
    return t;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  // Rendered width of an SVG text node; about 6.5 px per character where it cannot be measured.
  function widthOf(t) {
    var w = t.getComputedTextLength ? t.getComputedTextLength() : 0;
    return w > 0 ? w : t.textContent.length * 6.5;
  }
  function sizeOf(node, w, h) {
    var r = node.getBoundingClientRect ? node.getBoundingClientRect() : { width: 0, height: 0 };
    return { w: Math.round(r.width) || w, h: Math.round(r.height) || h };
  }

  /** Status marker shape centred at (x, y). */
  function marker(parent, x, y, status, r) {
    var s = statusKey(status), cls = 'mk st-' + s;
    r = r || 4;
    if (s === 'green') return el('circle', { cx: x, cy: y, r: r, 'class': cls }, parent);
    if (s === 'amber') {
      return el('path', { d: 'M' + x + ',' + (y - r * 1.25) + 'L' + (x + r * 1.15) + ',' + (y + r * 0.85) +
        'L' + (x - r * 1.15) + ',' + (y + r * 0.85) + 'Z', 'class': cls }, parent);
    }
    if (s === 'red') {
      var pts = [];
      for (var i = 0; i < 8; i++) {
        var a = Math.PI / 8 + i * Math.PI / 4;
        pts.push((x + r * 1.1 * Math.cos(a)).toFixed(1) + ',' + (y + r * 1.1 * Math.sin(a)).toFixed(1));
      }
      return el('polygon', { points: pts.join(' '), 'class': cls }, parent);
    }
    return el('rect', { x: x - r, y: y - 1.25, width: 2 * r, height: 2.5, 'class': cls }, parent);
  }

  // ---- labels inside a chart ----------------------------------------------------
  /**
   * Place labels without overlap. `items` come in order of importance; each is { id, w, h, options:
   * [{ x, y }] } where (x, y) is the left end of the text's baseline, in the order to try. A label's
   * box is x .. x + w across and y - h + 3 .. y + 3 down. An option is taken when its box lies inside
   * `bounds` ({ x0, y0, x1, y1 }) and clears every box in `obstacles` ([{ x0, y0, x1, y1 }]) and every
   * label already placed, with `gap` px to spare; a label with no such option is left out (the legend
   * still names it). Returns [{ id, x, y, box }] for the labels placed, in the order given.
   */
  function labelBox(x, y, w, h) { return { x0: x, y0: y - h + 3, x1: x + w, y1: y + 3 }; }
  function boxesMeet(a, b, gap) { return a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 + gap && b.y0 < a.y1 + gap; }
  function placeLabels(items, obstacles, bounds, gap) {
    gap = gap == null ? 2 : gap;
    var taken = obstacles.slice(), out = [];
    items.forEach(function (it) {
      for (var i = 0; i < it.options.length; i++) {
        var o = it.options[i], b = labelBox(o.x, o.y, it.w, it.h);
        if (b.x0 < bounds.x0 || b.x1 > bounds.x1 || b.y0 < bounds.y0 || b.y1 > bounds.y1) continue;
        if (taken.some(function (t) { return boxesMeet(b, t, gap); })) continue;
        taken.push(b);
        out.push({ id: it.id, x: o.x, y: o.y, box: b });
        return;
      }
    });
    return out;
  }

  // ---- line chart --------------------------------------------------------------
  /**
   * Draw a time series into an <svg>.
   * opts: { series: [{missionDay, value|null}], raw: [{missionDay, value|null}]|null,
   *   baseline: {median, low, high}|null, expected: [{missionDay, low, high}]|null,
   *   thresholds: [{value, label, shortLabel?, status}], markers: [{missionDay, label, shortLabel?, tinyLabel?}],
   *   exercise: [{missionDay, done}]|null, statusAt: (missionDay) => status,
   *   selectedDay, unit, yLabel, xTitle = 'Mission day', axisBreak: missionDay|null,
   *   logY: false, yFormat: (value) => tick text, upTo: missionDay|null,
   *   title, yTitle, youLabel, baselineLabel, expectedLabel, reference: {value, label}|null }
   * `title` is the chart's plain sentence (its accessible name); `yTitle` replaces the axis title
   * built from yLabel and unit. `reference` draws a quiet dashed line (for example a usual night).
   * The person's line, the bands and the reference line are labelled inside the plot (youLabel,
   * baselineLabel, expectedLabel, reference.label), placed by placeLabels clear of the threshold and
   * event labels, the selected-night line and the data; a label with no room is left out.
   * `logY` draws the vertical axis on a log10 scale with decade ticks (non-positive values are gaps).
   * `series` is the line the status is judged on (status-shaped markers); `raw` are the
   * nightly readings drawn as small neutral dots. `axisBreak` draws a break in the x axis
   * just before that day and never joins the line across it. `upTo` draws the readings, the judged
   * line, its points and the exercise ticks only up to that night; the axes, bands, thresholds and
   * markers still come from every point passed, so the chart keeps its frame while the nights advance.
   */
  function line(svg, opts) {
    opts = opts || {};
    var series = opts.series || [];
    var shown = function (pts) { return upToDay(pts, opts.upTo); };
    var size = sizeOf(svg, 640, 260);
    var W = size.w, H = size.h;
    var hasEx = opts.exercise && opts.exercise.length;
    var logY = !!opts.logY;
    var m = { l: logY ? 78 : 62, r: 16, t: 14, b: hasEx ? 50 : 38 };
    function ok(v) { return v != null && isFinite(v) && (!logY || v > 0); }
    // Event labels sit in a strip above the plot, so no data point or selected-night line runs under them.
    var nLab = (opts.markers || []).filter(function (mk) { return mk.label; }).length;
    var rows = Math.min(nLab, W - m.l - m.r < 420 ? 3 : 2);
    if (rows) m.t = 6 + 16 * rows;
    clear(svg);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('role', 'img');
    var xTitle = opts.xTitle || 'Mission day';
    var raw = opts.raw || [];
    var nData = shown(series).filter(function (p) { return p.value != null; }).length;
    var label = opts.title ? opts.title + ' ' + nData + ' nights with data' + (logY ? ', logarithmic scale' : '') + '.' :
      (opts.yLabel || 'Value') + (opts.unit ? ' (' + opts.unit + ')' : '') +
      ' by ' + xTitle.toLowerCase() + ', ' + nData + ' nights with data' + (logY ? ', logarithmic scale' : '');
    svg.setAttribute('aria-label', label);
    el('title', null, svg).textContent = label;

    // Domains
    var days = series.map(function (p) { return p.missionDay; });
    raw.forEach(function (p) { days.push(p.missionDay); });
    (opts.expected || []).forEach(function (p) { days.push(p.missionDay); });
    var x0 = Math.min.apply(null, days.length ? days : [0]);
    var x1 = Math.max.apply(null, days.length ? days : [1]);
    if (x1 === x0) x1 = x0 + 1;
    var ys = [];
    series.forEach(function (p) { if (p.value != null) ys.push(p.value); });
    raw.forEach(function (p) { if (p.value != null) ys.push(p.value); });
    if (opts.baseline) ys.push(opts.baseline.low, opts.baseline.high, opts.baseline.median);
    (opts.expected || []).forEach(function (p) { ys.push(p.low, p.high); });
    (opts.thresholds || []).forEach(function (t) { ys.push(t.value); });
    ys = ys.filter(ok);
    var y0 = ys.length ? Math.min.apply(null, ys) : 0, y1 = ys.length ? Math.max.apply(null, ys) : 1;
    var pw = W - m.l - m.r, ph = H - m.t - m.b, yt, Y;
    if (logY) {
      // Whole decades with a little room, so no point sits on the plot edge.
      y0 = Math.pow(10, Math.floor(Math.log10((ys.length ? y0 : 1) / 1.2)));
      y1 = Math.pow(10, Math.ceil(Math.log10((ys.length ? y1 : 10) * 1.2)));
      var ax = logAxis(y0, y1, m.t, ph);
      yt = ax.ticks; Y = ax.y;
    } else {
      var pad = (y1 - y0 || Math.abs(y1) || 1) * 0.08;
      y0 -= pad; y1 += pad;
      yt = niceTicks(y0, y1, Math.max(3, Math.floor((H - m.t - m.b) / 44)));
      if (yt.length) { y0 = Math.min(y0, yt[0]); y1 = Math.max(y1, yt[yt.length - 1]); }
      Y = function (v) { return m.t + (1 - (v - y0) / (y1 - y0)) * ph; };
    }
    function X(d) { return m.l + (d - x0) / (x1 - x0) * pw; }
    var labels = [];

    // Baseline period shading (mission days below 0)
    if (x0 < 0) {
      var bx1 = X(Math.min(-0.5, x1));
      el('rect', { x: m.l, y: m.t, width: Math.max(0, bx1 - m.l), height: ph, 'class': 'baseline-period' }, svg);
      if (bx1 - m.l >= 64) text(svg, (m.l + bx1) / 2, H - m.b + 18, 'Baseline', 'ax-label ax-baseline');
    }

    // Grid and y axis
    yt.forEach(function (v) {
      el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), 'class': 'grid' }, svg);
      text(svg, m.l - 8, Y(v) + 4, (opts.yFormat || fmt)(v), 'ax-label', 'end');
    });
    if (opts.yTitle || opts.yLabel) {
      var yl = text(svg, 0, 0, opts.yTitle || opts.yLabel + (opts.unit ? ' (' + opts.unit + ')' : ''), 'ax-title');
      yl.setAttribute('transform', 'translate(13,' + (m.t + ph / 2) + ') rotate(-90)');
    }

    // x axis: day ticks only from day 0 onward
    var xt = niceTicks(Math.max(0, x0), x1, Math.max(3, Math.floor(pw / 60))).filter(function (d) {
      return d >= 0 && d === Math.round(d);
    });
    el('line', { x1: m.l, x2: W - m.r, y1: m.t + ph, y2: m.t + ph, 'class': 'axis' }, svg);
    xt.forEach(function (d) {
      el('line', { x1: X(d), x2: X(d), y1: m.t + ph, y2: m.t + ph + 4, 'class': 'axis' }, svg);
      text(svg, X(d), m.t + ph + 18, String(d), 'ax-label');
    });
    text(svg, m.l + pw, H - 4, xTitle, 'ax-title', 'end');

    // Axis break: the days on either side are not adjacent (for example a long transit).
    var brk = opts.axisBreak;
    if (brk != null && brk > x0 && brk <= x1) {
      var bx = X(brk - 0.5), by = m.t + ph;
      el('rect', { x: bx - 4, y: by - 6, width: 8, height: 12, 'class': 'axis-break-gap' }, svg);
      el('path', { d: 'M' + (bx - 6) + ',' + (by + 5) + 'l5,-10M' + (bx + 1) + ',' + (by + 5) + 'l5,-10', 'class': 'axis-break' }, svg);
      el('line', { x1: bx, x2: bx, y1: m.t, y2: by, 'class': 'axis-break-line' }, svg);
    }

    // Baseline band and median
    if (opts.baseline && opts.baseline.low != null && opts.baseline.high != null) {
      var b = opts.baseline;
      el('rect', { x: m.l, y: Y(b.high), width: pw, height: Math.max(0, Y(b.low) - Y(b.high)), 'class': 'band-baseline' }, svg);
      if (b.median != null) el('line', { x1: m.l, x2: W - m.r, y1: Y(b.median), y2: Y(b.median), 'class': 'line-median' }, svg);
    }
    // A quiet dashed reference line (for example a usual night).
    var ref = opts.reference && ok(opts.reference.value) && opts.reference.value >= y0 && opts.reference.value <= y1 ? opts.reference : null;
    if (ref) el('line', { x1: m.l, x2: W - m.r, y1: Y(ref.value), y2: Y(ref.value), 'class': 'line-median line-reference' }, svg);

    // Expected band
    if (opts.expected && opts.expected.length > 1) {
      var ex = opts.expected.slice().sort(function (a, c) { return a.missionDay - c.missionDay; });
      var d = ex.map(function (p, i) { return (i ? 'L' : 'M') + X(p.missionDay).toFixed(1) + ',' + Y(p.high).toFixed(1); }).join('');
      for (var i = ex.length - 1; i >= 0; i--) d += 'L' + X(ex[i].missionDay).toFixed(1) + ',' + Y(ex[i].low).toFixed(1);
      el('path', { d: d + 'Z', 'class': 'band-expected' }, svg);
    }

    // Thresholds (labels are drawn last, see below)
    (opts.thresholds || []).forEach(function (t) {
      if (t.value == null || t.value < y0 || t.value > y1) return;
      el('line', { x1: m.l, x2: W - m.r, y1: Y(t.value), y2: Y(t.value), 'class': 'threshold st-' + statusKey(t.status) }, svg);
      if (t.label) {
        labels.push(function () {
          // A threshold may carry a shortLabel for plots too narrow for the full one.
          var n = text(svg, m.l + 6, Y(t.value) - 4, t.label, 'threshold-label st-' + statusKey(t.status), 'start');
          if (t.shortLabel && (pw < 420 || widthOf(n) > pw - 12)) n.textContent = t.shortLabel;
        });
      }
    });

    // Event markers (labels are drawn last, see below). Each label takes the first row of the strip
    // where it clears the labels already placed there; with no clear row it keeps its own row.
    var rowSpans = [];
    (opts.markers || []).forEach(function (mk, k) {
      if (mk.missionDay < x0 || mk.missionDay > x1) return;
      var mx = X(mk.missionDay);
      el('line', { x1: mx, x2: mx, y1: 4, y2: m.t + ph, 'class': 'event' }, svg);
      if (!mk.label) return;
      labels.push(function () {
        // Beside its own line: the longest wording that fits to its right, else to its left;
        // when none fits, the shortest wording, kept inside the chart as close to its line as it can be.
        var n = text(svg, mx + 4, 16 + (k % rows) * 16, mk.label, 'event-label', 'start');
        var words = [mk.label, mk.shortLabel, mk.tinyLabel].filter(Boolean), lx = null;
        for (var j = 0; j < words.length && lx == null; j++) {
          n.textContent = words[j];
          var w = widthOf(n);
          if (mx + 4 + w <= W - 2) lx = mx + 4;
          else if (mx - 4 - w >= m.l) lx = mx - 4 - w;
        }
        if (lx == null) lx = Math.max(2, Math.min(W - 2 - widthOf(n), mx - widthOf(n) / 2));
        n.setAttribute('x', lx);
        var span = [lx - 6, lx + widthOf(n) + 6], row = k % rows;
        for (var r = 0; r < rows; r++) {
          if (!(rowSpans[r] || []).some(function (q) { return q[0] < span[1] && span[0] < q[1]; })) { row = r; break; }
        }
        (rowSpans[row] = rowSpans[row] || []).push(span);
        n.setAttribute('y', 16 + row * 16);
      });
    });

    // Selected day
    if (opts.selectedDay != null && opts.selectedDay >= x0 && opts.selectedDay <= x1) {
      el('line', { x1: X(opts.selectedDay), x2: X(opts.selectedDay), y1: m.t, y2: m.t + ph, 'class': 'selected-day' }, svg);
    }

    // Nightly readings: small neutral dots
    shown(raw).forEach(function (p) {
      if (!ok(p.value)) return;
      el('circle', { cx: X(p.missionDay).toFixed(1), cy: Y(p.value).toFixed(1), r: 1.8, 'class': 'raw-dot' }, svg);
    });

    // Judged line with gaps (and never across the axis break), then status-shaped points
    var path = '', pen = false, prev = null;
    shown(series).forEach(function (p) {
      if (brk != null && prev != null && prev < brk && p.missionDay >= brk) pen = false;
      prev = p.missionDay;
      if (!ok(p.value)) { pen = false; return; }
      path += (pen ? 'L' : 'M') + X(p.missionDay).toFixed(1) + ',' + Y(p.value).toFixed(1);
      pen = true;
    });
    if (path) el('path', { d: path, 'class': 'series' }, svg);
    var r = series.length > 120 ? 2.5 : 3.5;
    shown(series).forEach(function (p) {
      if (!ok(p.value)) return;
      var st = opts.statusAt ? opts.statusAt(p.missionDay) : 'green';
      var big = p.missionDay === opts.selectedDay;
      var node = marker(svg, X(p.missionDay), Y(p.value), st, big ? r + 2.5 : r);
      if (big) node.setAttribute('class', node.getAttribute('class') + ' mk-selected');
    });

    // Exercise log ticks along the bottom
    if (hasEx) {
      var ey = H - m.b + 30;
      shown(opts.exercise).forEach(function (e) {
        if (e.missionDay < x0 || e.missionDay > x1) return;
        el('line', { x1: X(e.missionDay), x2: X(e.missionDay), y1: ey - (e.done ? 6 : 2), y2: ey,
          'class': e.done ? 'ex-done' : 'ex-missed' }, svg);
      });
      text(svg, m.l - 8, ey, 'Exercise', 'ax-label', 'end');
    }

    // Labels last, over every line and mark; their halo (CSS paint-order) keeps them readable.
    labels.forEach(function (draw) { draw(); });
    plotLabels();
    return { x: X, y: Y, top: m.t, bottom: m.t + ph, left: m.l, right: W - m.r, days: series.map(function (p) { return p.missionDay; }) };

    // "You" at the person's line, and the names of the bands and the reference line, inside the plot.
    function plotLabels() {
      var LH = 12, obstacles = [];
      // What the labels must clear: the threshold and event labels, the threshold lines, the
      // selected-night line, and the data (readings, judged points, the line between them).
      Array.prototype.forEach.call(svg.childNodes || svg.children || [], function (n) {
        var c = (n.getAttribute && n.getAttribute('class')) || '';
        if (/threshold-label|event-label/.test(c)) {
          var w = widthOf(n), x = +n.getAttribute('x'), a = n.getAttribute('text-anchor');
          if (a === 'end') x -= w; else if (a === 'middle') x -= w / 2;
          obstacles.push(labelBox(x, +n.getAttribute('y'), w, LH));
        }
      });
      (opts.thresholds || []).forEach(function (t) {
        if (ok(t.value) && t.value >= y0 && t.value <= y1) obstacles.push({ x0: m.l, x1: W - m.r, y0: Y(t.value) - 1, y1: Y(t.value) + 1 });
      });
      if (opts.selectedDay != null && opts.selectedDay >= x0 && opts.selectedDay <= x1) {
        obstacles.push({ x0: X(opts.selectedDay) - 2, x1: X(opts.selectedDay) + 2, y0: m.t, y1: m.t + ph });
      }
      shown(raw).forEach(function (p) { if (ok(p.value)) obstacles.push({ x0: X(p.missionDay) - 2.5, x1: X(p.missionDay) + 2.5, y0: Y(p.value) - 2.5, y1: Y(p.value) + 2.5 }); });
      var pts = [], last = null;
      shown(series).forEach(function (p) {
        if (!ok(p.value)) { last = null; return; }
        var q = [X(p.missionDay), Y(p.value)];
        if (last && !(brk != null && last.d < brk && p.missionDay >= brk)) {
          var steps = Math.ceil(Math.hypot(q[0] - last.q[0], q[1] - last.q[1]) / 3);
          for (var k = 1; k < steps; k++) pts.push([lerp(last.q[0], q[0], k / steps), lerp(last.q[1], q[1], k / steps), 1.5]);
        }
        pts.push([q[0], q[1], r + 2.5]);
        last = { q: q, d: p.missionDay };
      });
      pts.forEach(function (q) { obstacles.push({ x0: q[0] - q[2], x1: q[0] + q[2], y0: q[1] - q[2], y1: q[1] + q[2] }); });

      var items = [], texts = {};
      function measure(id, str, cls) {
        var n = text(svg, 0, 0, str, cls, 'start');
        texts[id] = n;
        return widthOf(n);
      }
      // The person's line: beside its latest drawn point.
      var end = null;
      shown(series).forEach(function (p) { if (ok(p.value)) end = [X(p.missionDay), Y(p.value)]; });
      if (end && opts.youLabel) {
        var w = measure('you', opts.youLabel, 'band-label chart-label you-label'), px = end[0], py = end[1];
        items.push({ id: 'you', w: w, h: LH, options: [
          { x: px + 9, y: py + 4 }, { x: px - 9 - w, y: py - 9 }, { x: px - 9 - w, y: py + 16 }, { x: px - w / 2, y: py - 11 },
          { x: px - w / 2, y: py + 19 }, { x: px + 9, y: py - 10 }, { x: px + 9, y: py + 18 }, { x: px - 9 - w, y: py + 4 },
          { x: px - w / 2, y: py - 25 }, { x: px - w / 2, y: py + 33 }
        ].concat([-24, 30, -38, 44, -52, 58].reduce(function (a, dy) {
          return a.concat({ x: px - 9 - w, y: py + dy }, { x: px + 9, y: py + dy }, { x: px - 14 - w, y: py + dy });
        }, [])) });
      }
      // A band or a line: the label's right end at a series of points from right to left, just
      // above its top edge, just below its bottom edge, or inside it when it is tall enough.
      function alongBand(id, str, topAt, botAt) {
        var w = measure(id, str, 'band-label chart-label'), opts2 = [];
        for (var f = 1; f >= 0.05; f -= 0.05) {
          var xe = m.l + 4 + (pw - 8) * f, xm = xe - w / 2, top = topAt(xm), bot = botAt(xm);
          opts2.push({ x: xe - w, y: top - 4 }, { x: xe - w, y: bot + LH + 1 });
          if (bot - top > LH + 6) opts2.push({ x: xe - w, y: (top + bot) / 2 + 4 });
        }
        items.push({ id: id, w: w, h: LH, options: opts2 });
      }
      if (opts.expected && opts.expected.length > 1 && opts.expectedLabel) {
        var exs = opts.expected.slice().sort(function (a, c) { return a.missionDay - c.missionDay; });
        var at = function (px, key) {
          var d = x0 + (px - m.l) / pw * (x1 - x0), j = 0;
          if (d <= exs[0].missionDay) return Y(exs[0][key]);
          while (j < exs.length - 1 && exs[j + 1].missionDay < d) j++;
          var a = exs[j], c = exs[Math.min(j + 1, exs.length - 1)], t = c.missionDay > a.missionDay ? clamp01((d - a.missionDay) / (c.missionDay - a.missionDay)) : 0;
          return Y(lerp(a[key], c[key], t));
        };
        alongBand('expected', opts.expectedLabel, function (px) { return at(px, 'high'); }, function (px) { return at(px, 'low'); });
      }
      if (opts.baseline && opts.baseline.low != null && opts.baseline.high != null && opts.baselineLabel) {
        alongBand('baseline', opts.baselineLabel, function () { return Y(opts.baseline.high); }, function () { return Y(opts.baseline.low); });
      }
      if (ref && ref.label) alongBand('reference', ref.label, function () { return Y(ref.value); }, function () { return Y(ref.value); });

      var placed = placeLabels(items, obstacles, { x0: m.l + 2, y0: m.t, x1: W - m.r - 2, y1: m.t + ph });
      Object.keys(texts).forEach(function (id) {
        var p = placed.filter(function (q) { return q.id === id; })[0];
        if (!p) { svg.removeChild(texts[id]); return; }
        texts[id].setAttribute('x', p.x.toFixed(1));
        texts[id].setAttribute('y', p.y.toFixed(1));
      });
    }
  }

  /** The day among `days` whose x (by X) is nearest to px, or null when there is none. */
  function nearestDay(px, days, X) {
    var best = null, dist = Infinity;
    (days || []).forEach(function (d) {
      var e = Math.abs(X(d) - px);
      if (e < dist) { dist = e; best = d; }
    });
    return best;
  }

  // ---- sparkline -------------------------------------------------------------------
  /**
   * Points of a sparkline w x h px: values (null = gap) spread evenly across the width, the lowest
   * at the bottom and the highest at the top, `pad` px inside each edge; all equal values sit in
   * the middle. Returns [[x, y] | null, ...], one per value.
   */
  function sparkPoints(values, w, h, pad) {
    pad = pad == null ? 3 : pad;
    var ok = (values || []).filter(function (v) { return v != null && isFinite(v); });
    var lo = Math.min.apply(null, ok), hi = Math.max.apply(null, ok), n = (values || []).length;
    return (values || []).map(function (v, i) {
      if (v == null || !isFinite(v)) return null;
      var x = n > 1 ? pad + i * (w - 2 * pad) / (n - 1) : w / 2;
      var y = hi > lo ? h - pad - (v - lo) / (hi - lo) * (h - 2 * pad) : h / 2;
      return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
    });
  }

  /** Draw a sparkline into an <svg> (its size from the stylesheet, w x h): the line with gaps, the last point marked. */
  function spark(svg, values, w, h) {
    clear(svg);
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    var pts = sparkPoints(values, w, h, 3), d = '', pen = false, last = null;
    pts.forEach(function (p) {
      if (!p) { pen = false; return; }
      d += (pen ? 'L' : 'M') + p[0] + ',' + p[1];
      pen = true;
      last = p;
    });
    if (d) el('path', { d: d, 'class': 'spark-line' }, svg);
    if (last) el('circle', { cx: last[0], cy: last[1], r: 2.2, 'class': 'spark-dot' }, svg);
  }

  // ---- image -------------------------------------------------------------------
  /**
   * Draw a row-major Float32Array image (values[y * w + x]) onto a canvas with
   * nearest-neighbour scaling. NaN cells get nanColor. Cells where opts.overlay (a
   * Uint8Array of codes) is non-zero get opts.overlayColors[code] instead.
   * image: { w, h, values, min, max };
   * opts: { colormap, nanColor: [r,g,b,a], scale, overlay, overlayColors: { code: [r,g,b,a] } }
   */
  function image(canvas, img, opts) {
    opts = opts || {};
    var name = opts.colormap || 'gray';
    var scale = Math.max(1, Math.round(opts.scale || 4));
    var nan = opts.nanColor || [0, 0, 0, 0];
    var w = img.w, h = img.h, v = img.values;
    var min = img.min, max = img.max;
    var doc = root.document, maps = themeMaps();
    var src = doc.createElement('canvas');
    src.width = w; src.height = h;
    var sctx = src.getContext('2d');
    var data = sctx.createImageData(w, h);
    var ov = opts.overlay, ovc = opts.overlayColors || {};
    for (var i = 0; i < w * h; i++) {
      var val = v[i], o = i * 4;
      if (ov && ov[i] && ovc[ov[i]]) {
        var oc = ovc[ov[i]];
        data.data[o] = oc[0]; data.data[o + 1] = oc[1]; data.data[o + 2] = oc[2];
        data.data[o + 3] = oc.length > 3 ? oc[3] : 255;
        continue;
      }
      if (val == null || !isFinite(val)) {
        data.data[o] = nan[0]; data.data[o + 1] = nan[1]; data.data[o + 2] = nan[2];
        data.data[o + 3] = nan.length > 3 ? nan[3] : 255;
        continue;
      }
      var c = colormap(name, normalise(val, min, max, name), maps);
      data.data[o] = c[0]; data.data[o + 1] = c[1]; data.data[o + 2] = c[2]; data.data[o + 3] = 255;
    }
    sctx.putImageData(data, 0, 0);
    canvas.width = w * scale; canvas.height = h * scale;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  }

  /**
   * Fill a container element with a horizontal colour scale and min / centre / max labels.
   * scale: { min, max, unit, colormap }
   */
  function colorbar(container, scale) {
    var doc = root.document, name = scale.colormap || 'gray', maps = themeMaps();
    while (container.firstChild) container.removeChild(container.firstChild);
    var min = scale.min, max = scale.max;
    if (name === 'diverging') { var m = Math.max(Math.abs(min), Math.abs(max)) || 1; min = -m; max = m; }
    var cv = doc.createElement('canvas');
    cv.width = 256; cv.height = 1;
    cv.className = 'colorbar-strip';
    cv.setAttribute('aria-hidden', 'true');
    var ctx = cv.getContext('2d'), id = ctx.createImageData(256, 1);
    for (var i = 0; i < 256; i++) {
      var c = colormap(name, i / 255, maps);
      id.data[i * 4] = c[0]; id.data[i * 4 + 1] = c[1]; id.data[i * 4 + 2] = c[2]; id.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    container.appendChild(cv);
    var labels = doc.createElement('div');
    labels.className = 'colorbar-labels';
    var unit = scale.unit ? ' ' + scale.unit : '';
    // Label precision follows the range, so near-zero ends read "0.00" rather than "-7.1e-3".
    var span = Math.abs(max - min) || Math.abs(max) || 1;
    var dec = Math.max(0, Math.min(4, 2 - Math.floor(Math.log10(span))));
    var f = function (v) { var s = (Math.abs(v) < Math.pow(10, -dec) / 2 ? 0 : v).toFixed(dec); return s; };
    [f(min), name === 'diverging' ? '0' : f((min + max) / 2), f(max)].forEach(function (s) {
      var sp = doc.createElement('span');
      sp.textContent = s;
      labels.appendChild(sp);
    });
    container.appendChild(labels);
    if (scale.unit) {
      var u = doc.createElement('div');
      u.className = 'colorbar-unit';
      u.textContent = scale.unit;
      container.appendChild(u);
    }
    container.setAttribute('aria-label', 'Colour scale from ' + f(min) + ' to ' + f(max) + unit);
  }

  // ---- direction rose ----------------------------------------------------------
  /**
   * 8-sector rose of particle arrival directions. Sector 0 points toward the head
   * (up); sectors run clockwise. Wedge radius is proportional to sqrt(count / max),
   * so wedge area is proportional to count. opts: { highlightMax: true }
   */
  // Sector names in drawing order (0 = toward the head, clockwise as drawn).
  var ROSE_DIRECTIONS = ['head', 'head-right', 'right', 'feet-right', 'feet', 'feet-left', 'left', 'head-left'];

  function rose(svg, counts, opts) {
    opts = opts || {};
    counts = (counts || []).slice(0, 8);
    while (counts.length < 8) counts.push(0);
    var S = 220, c = S / 2, R = 66;
    clear(svg);
    svg.setAttribute('viewBox', '0 0 ' + S + ' ' + S);
    svg.setAttribute('role', 'img');
    var max = Math.max.apply(null, counts), imax = counts.indexOf(max);
    var lab = 'Share of particle tracks by arrival direction. Counts: ' +
      counts.map(function (n, k) { return ROSE_DIRECTIONS[k] + ' ' + n; }).join(', ');
    svg.setAttribute('aria-label', lab);
    el('title', null, svg).textContent = lab;
    [0.5, 1].forEach(function (f) { el('circle', { cx: c, cy: c, r: R * f, 'class': 'rose-ring' }, svg); });
    for (var k = 0; k < 8; k++) {
      var a = -Math.PI / 2 + k * Math.PI / 4;
      el('line', { x1: c, y1: c, x2: c + R * Math.cos(a), y2: c + R * Math.sin(a), 'class': 'rose-spoke' }, svg);
    }
    counts.forEach(function (n, k) {
      if (!(max > 0) || !(n > 0)) return;
      var r = R * Math.sqrt(n / max);
      var mid = -Math.PI / 2 + k * Math.PI / 4, a0 = mid - Math.PI / 8 + 0.03, a1 = mid + Math.PI / 8 - 0.03;
      var d = 'M' + c + ',' + c + 'L' + (c + r * Math.cos(a0)).toFixed(1) + ',' + (c + r * Math.sin(a0)).toFixed(1) +
        'A' + r.toFixed(1) + ',' + r.toFixed(1) + ' 0 0 1 ' + (c + r * Math.cos(a1)).toFixed(1) + ',' + (c + r * Math.sin(a1)).toFixed(1) + 'Z';
      el('path', { d: d, 'class': 'rose-wedge' + (opts.highlightMax !== false && k === imax ? ' rose-max' : '') }, svg);
    });
    text(svg, c, 18, 'Head', 'rose-label');
    text(svg, c, S - 8, 'Feet', 'rose-label');
    text(svg, c - R - 6, c + 4, 'Left', 'rose-label', 'end');
    text(svg, c + R + 6, c + 4, 'Right', 'rose-label', 'start');
    return imax;
  }

  // ---- hourly series on a logarithmic axis ----------------------------------------
  /**
   * Hourly values on a log10 vertical axis with decade ticks, and an optional shaded span.
   * opts: { points: [{t: ms, value}], from: ms, to: ms, shade: {from: ms, to: ms}|null,
   *   yMin, yMax (positive, decades; the caller makes them cover every value), yLabel, label (accessible name) }
   * Non-positive or null values are gaps. Day ticks at 00:00 UTC, every second day.
   */
  function logSeries(svg, opts) {
    var size = sizeOf(svg, 640, 200), W = size.w, H = size.h;
    var m = { l: 62, r: 16, t: 10, b: 34 };
    clear(svg);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('aria-label', opts.label || 'Chart');
    el('title', null, svg).textContent = opts.label || 'Chart';
    var pw = W - m.l - m.r, ph = H - m.t - m.b;
    var ax = logAxis(opts.yMin, opts.yMax, m.t, ph), Y = ax.y;
    function X(t) { return m.l + (t - opts.from) / (opts.to - opts.from) * pw; }
    if (opts.shade) {
      var s0 = Math.max(opts.from, opts.shade.from), s1 = Math.min(opts.to, opts.shade.to);
      if (s1 > s0) el('rect', { x: X(s0), y: m.t, width: X(s1) - X(s0), height: ph, 'class': 'flux-shade' }, svg);
    }
    ax.ticks.forEach(function (v) {
      el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), 'class': 'grid' }, svg);
      text(svg, m.l - 8, Y(v) + 4, String(v), 'ax-label', 'end');
    });
    if (opts.yLabel) {
      var yl = text(svg, 0, 0, opts.yLabel, 'ax-title');
      yl.setAttribute('transform', 'translate(13,' + (m.t + ph / 2) + ') rotate(-90)');
    }
    el('line', { x1: m.l, x2: W - m.r, y1: m.t + ph, y2: m.t + ph, 'class': 'axis' }, svg);
    var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var step = pw < 360 ? 4 : 2;
    for (var t = opts.from, i = 0; t <= opts.to; t += 86400000, i++) {
      if (i % step) continue;
      var d = new Date(t);
      el('line', { x1: X(t), x2: X(t), y1: m.t + ph, y2: m.t + ph + 4, 'class': 'axis' }, svg);
      text(svg, X(t), m.t + ph + 18, d.getUTCDate() + ' ' + MON[d.getUTCMonth()], 'ax-label');
    }
    var path = '', pen = false;
    (opts.points || []).forEach(function (p) {
      if (p.value == null || !(p.value > 0)) { pen = false; return; }
      path += (pen ? 'L' : 'M') + X(p.t).toFixed(1) + ',' + Y(p.value).toFixed(1);
      pen = true;
    });
    if (path) el('path', { d: path, 'class': 'series' }, svg);
    return { x: X, y: Y };
  }

  // ---- labelled dot scale ------------------------------------------------------
  /**
   * One row per mark on a shared horizontal scale from 0 to `max`. Each label sits in a left
   * gutter outside the plot, vertically centred on its own row with its mark, so no grid or
   * reference line crosses it; on a narrow chart (under 560 px) the label goes on two lines,
   * split after its first comma. One dashed vertical reference line, its label above the plot
   * and kept inside the plot's width.
   * opts: { rows: [{ value, label, shape: 'circle' | 'square' | 'triangle' }],
   *   max, ticks: number[], ref: { value, label }, title, label }
   * The <svg> height attribute is set here from the number of rows (give it no CSS height).
   * Returns { x, rowY, gutter } (rowY[i] is the centre of row i).
   */
  function dotScale(svg, opts) {
    var W = sizeOf(svg, 640, 300).w, narrow = W < 560;
    var ROW = narrow ? 40 : 34, m = { l: 12, r: 18, t: 30, b: 60 };
    var H = m.t + opts.rows.length * ROW + m.b;
    svg.setAttribute('height', H);
    clear(svg);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('aria-label', opts.label || 'Chart');
    el('title', null, svg).textContent = opts.label || 'Chart';
    var rowY = opts.rows.map(function (r, i) { return m.t + i * ROW + ROW / 2; });
    // Labels first, in the gutter, so the plot can start after the widest one.
    var widest = 0;
    opts.rows.forEach(function (r, i) {
      var full = r.label + ': ' + r.value.toFixed(2), cut = r.label.indexOf(', ');
      var lines = narrow && cut > 0 ? [r.label.slice(0, cut + 1), r.label.slice(cut + 2) + ': ' + r.value.toFixed(2)] : [full];
      lines.forEach(function (s, k) {
        var y = rowY[i] + 4.5 + (lines.length === 2 ? (k ? 7 : -7) : 0);
        widest = Math.max(widest, widthOf(text(svg, m.l, y, s, 'ax-label dot-label', 'start')));
      });
    });
    var x0 = m.l + Math.ceil(widest) + 14;
    var pw = W - x0 - m.r;
    function X(v) { return x0 + Math.max(0, Math.min(opts.max, v)) / opts.max * pw; }
    var y1 = m.t + opts.rows.length * ROW;
    // On a narrow plot every second tick keeps its number, so the numbers do not run together.
    (opts.ticks || []).forEach(function (v, k) {
      el('line', { x1: X(v), x2: X(v), y1: m.t, y2: y1, 'class': 'grid' }, svg);
      if (pw >= 240 || k % 2 === 0) text(svg, X(v), y1 + 16, fmt(v), 'ax-label');
    });
    el('line', { x1: x0, x2: W - m.r, y1: y1, y2: y1, 'class': 'axis' }, svg);
    // The axis title is centred on the plot; when it is wider than the plot it goes on two lines
    // centred on the whole chart (narrow screens).
    var tt = text(svg, x0 + pw / 2, y1 + 36, opts.title || '', 'ax-title');
    if (widthOf(tt) > pw) {
      var words = tt.textContent.split(' '), half = Math.ceil(words.length / 2);
      tt.textContent = words.slice(0, half).join(' ');
      tt.setAttribute('x', W / 2);
      text(svg, W / 2, y1 + 51, words.slice(half).join(' '), 'ax-title');
    }
    opts.rows.forEach(function (r, i) {
      el('line', { x1: x0, x2: W - m.r, y1: rowY[i], y2: rowY[i], 'class': 'dot-track' }, svg);
    });
    // Reference line under the marks; its label above the plot, centred on the line but never past the plot's edges.
    if (opts.ref) {
      var xr = X(opts.ref.value);
      el('line', { x1: xr, x2: xr, y1: m.t - 8, y2: y1, 'class': 'dot-ref' }, svg);
      var rl = text(svg, xr, m.t - 14, opts.ref.label, 'dot-ref-label', 'start');
      var w = widthOf(rl);
      rl.setAttribute('x', Math.max(x0, Math.min(W - m.r - w, xr - w / 2)));
    }
    opts.rows.forEach(function (r, i) {
      var y = rowY[i], x = X(r.value), s = 5.5;
      if (r.shape === 'square') el('rect', { x: x - s, y: y - s, width: 2 * s, height: 2 * s, 'class': 'dot dot-square' }, svg);
      else if (r.shape === 'triangle') el('path', { d: 'M' + x + ',' + (y - s * 1.15) + 'L' + (x + s * 1.2) + ',' + (y + s * 0.95) + 'L' + (x - s * 1.2) + ',' + (y + s * 0.95) + 'Z', 'class': 'dot dot-triangle' }, svg);
      else el('circle', { cx: x, cy: y, r: s, 'class': 'dot dot-circle' }, svg);
    });
    return { x: X, rowY: rowY, gutter: x0 };
  }

  // ---- the plate: the sleeper drawn as a stipple ----------------------------------
  /** Bounding box, in cells, of the body cells (those with a region) of a phantom. */
  function bodyBox(ph) {
    var b = { x0: ph.w, x1: -1, y0: ph.h, y1: -1 };
    for (var y = 0; y < ph.h; y++) {
      for (var x = 0; x < ph.w; x++) {
        if (!ph.region[y * ph.w + x]) continue;
        if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x;
        if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
      }
    }
    return b;
  }

  /**
   * Where the body sits on a plate W x H px: `fill` (default 0.78) of the height, centred.
   * cx(col), cy(row) give the centre of a cell; px(xCm), py(yCm) map body centimetres
   * (x from the midline, patient's left positive; y from the top of the head) to plate pixels.
   */
  function plateLayout(ph, W, H, fill) {
    var b = bodyBox(ph), figH = H * (fill || 0.78);
    var cell = figH / (b.y1 - b.y0 + 1), figW = cell * (b.x1 - b.x0 + 1);
    var ox = (W - figW) / 2, oy = (H - figH) / 2, half = ph.w * ph.cellCm / 2;
    return {
      cell: cell, ox: ox, oy: oy, figW: figW, figH: figH, box: b, W: W, H: H,
      cx: function (col) { return ox + (col - b.x0 + 0.5) * cell; },
      cy: function (row) { return oy + (row - b.y0 + 0.5) * cell; },
      px: function (xCm) { return ox + ((xCm + half) / ph.cellCm - b.x0) * cell; },
      py: function (yCm) { return oy + (yCm / ph.cellCm - b.y0) * cell; }
    };
  }

  /**
   * One dot of the stipple for a cell value: { r (px), tone, alpha } or null for no dot.
   * mode 'raw': size and brightness rise with the value from min to max (ink).
   * mode 'diff': size follows the size of the change; a loss is blue, a gain ink.
   * code: overlay code of the cell, 1 = below the noise (smallest quiet dot), 2 = outline of a
   * region that is not measured (hollow dot). The radius runs from 0.16 to 0.5 of a cell, by the
   * square root, so the dot's area follows the value.
   */
  function stippleDot(v, min, max, mode, code, cell) {
    if (code === 2) return { r: cell * 0.2, tone: 'hollow', alpha: 0.8 };
    if (code === 1) return { r: cell * 0.15, tone: 'quiet', alpha: 0.7 };
    if (v == null || !isFinite(v)) return null;
    var t, tone = 'ink';
    if (mode === 'diff') {
      var m = Math.max(Math.abs(min), Math.abs(max)) || 1;
      t = clamp01(Math.abs(v) / m);
      tone = v < 0 ? 'blue' : 'ink';
    } else {
      t = max > min ? clamp01((v - min) / (max - min)) : 0.5;
    }
    // A change is drawn with a higher floor than a raw value, so the body stays readable when the change is small.
    if (mode === 'diff') return { r: cell * (0.2 + 0.3 * Math.sqrt(t)), tone: tone, alpha: 0.5 + 0.5 * t };
    return { r: cell * (0.16 + 0.34 * Math.sqrt(t)), tone: tone, alpha: 0.22 + 0.72 * t };
  }

  /** '#rrggbb' as [r, g, b], or null. */
  function hexRgb(s) {
    var m = /#([0-9a-f]{6})\b/i.exec(String(s || ''));
    return m ? [0, 2, 4].map(function (i) { return parseInt(m[1].slice(i, i + 2), 16); }) : null;
  }
  var TONES = { ink: [234, 242, 247], blue: [2, 151, 222], quiet: [143, 163, 177] };
  /** Dot tones from the stylesheet (--ink, --blue, --quiet), with these copies as the fallback. */
  function themeTones() {
    var doc = root.document;
    if (!doc || !doc.body || !root.getComputedStyle) return TONES;
    var cs = root.getComputedStyle(doc.body);
    return {
      ink: hexRgb(cs.getPropertyValue('--ink')) || TONES.ink,
      blue: hexRgb(cs.getPropertyValue('--blue')) || TONES.blue,
      quiet: hexRgb(cs.getPropertyValue('--quiet')) || TONES.quiet
    };
  }

  /**
   * Draw an image as a stipple onto a canvas sized W x H CSS px: one dot per body cell.
   * img: { values, min, max }; lay: plateLayout(); opts: { mode: 'raw'|'diff', overlay: Uint8Array|null, dpr, progress }.
   * `progress` (0 to 1, default 1) reveals the figure from head to feet: a body row shows once the
   * progress reaches it, fading in over the next STIPPLE_FADE rows; at 1 every dot is drawn exactly as
   * without it, at 0 none is. Returns the number of dots drawn.
   */
  var STIPPLE_FADE = 6;
  function rowShare(progress, k, rows) {
    if (progress == null || progress >= 1) return 1;
    var t = (progress * (rows + STIPPLE_FADE) - k) / STIPPLE_FADE;
    return t <= 0 ? 0 : t >= 1 ? 1 : t;
  }
  function stipple(canvas, img, ph, lay, opts) {
    opts = opts || {};
    var dpr = opts.dpr || 1, tones = themeTones(), n = 0;
    canvas.width = Math.round(lay.W * dpr); canvas.height = Math.round(lay.H * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, lay.W, lay.H);
    var b = lay.box, ov = opts.overlay;
    for (var y = b.y0; y <= b.y1; y++) {
      var share = rowShare(opts.progress, y - b.y0, b.y1 - b.y0 + 1);
      if (!share) break;
      for (var x = b.x0; x <= b.x1; x++) {
        var i = y * ph.w + x;
        if (!ph.region[i]) continue;
        var d = stippleDot(img.values[i], img.min, img.max, opts.mode, ov ? ov[i] : 0, lay.cell);
        if (!d) continue;
        ctx.beginPath();
        ctx.arc(lay.cx(x), lay.cy(y), d.r, 0, Math.PI * 2);
        var c = tones[d.tone === 'hollow' ? 'ink' : d.tone];
        var rgba = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (share === 1 ? d.alpha : d.alpha * share).toFixed(3) + ')';
        if (d.tone === 'hollow') { ctx.lineWidth = 1; ctx.strokeStyle = rgba; ctx.stroke(); } else { ctx.fillStyle = rgba; ctx.fill(); }
        n++;
      }
    }
    return n;
  }

  /**
   * The classical frame of the plate, into an <svg> W x H: a hairline square and circle around the
   * figure, a dotted centre line and dotted cosmic-ray tracks crossing the plate.
   * tracks: [[x0, x1], ...] as fractions of the width at the top and the bottom edge.
   */
  function plateFrame(svg, lay, tracks) {
    var W = lay.W, H = lay.H;
    clear(svg);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var sq = lay.figH, cx = W / 2, top = lay.oy;
    el('rect', { x: cx - sq / 2, y: top, width: sq, height: sq, 'class': 'frame' }, svg);
    el('circle', { cx: cx, cy: top + sq / 2, r: sq / 2, 'class': 'frame' }, svg);
    el('line', { x1: cx, y1: top - 14, x2: cx, y2: top + sq + 14, 'class': 'frame-axis' }, svg);
    (tracks || []).forEach(function (t, k) {
      el('line', { x1: W * t[0], y1: 0, x2: W * t[1], y2: H, 'class': 'track track-' + (k % 3) }, svg);
    });
  }

  /**
   * Small legend of dot sizes into a container: three dots from small to large with the value at
   * each, or for a change view a blue dot (loss), an ink dot (gain) and the smallest quiet dot
   * (below the noise). scale: { mode: 'raw'|'diff', min, max, unit, noise: bool }
   */
  function dotLegend(container, scale) {
    while (container.firstChild) container.removeChild(container.firstChild);
    if (!scale) { container.setAttribute('aria-label', 'No dot scale'); return; }
    var items = [], f = function (v) { return fmt(v); };
    if (scale.mode === 'diff') {
      var m = Math.max(Math.abs(scale.min), Math.abs(scale.max));
      items.push({ r: 5.5, cls: 'lg-blue', text: 'loss to −' + f(m) + '%' }, { r: 5.5, cls: 'lg-ink', text: 'gain to +' + f(m) + '%' });
      if (scale.noise) items.push({ r: 1.6, cls: 'lg-quiet', text: 'below noise' });
    } else {
      items.push({ r: 2.2, cls: 'lg-ink lg-dim', text: f(scale.min) }, { r: 3.9, cls: 'lg-ink lg-mid', text: f((scale.min + scale.max) / 2) },
        { r: 5.5, cls: 'lg-ink', text: f(scale.max) + (scale.unit ? ' ' + scale.unit : '') });
      if (scale.outline) items.push({ r: 2.6, cls: 'lg-hollow', text: 'not measured' });
    }
    var svg = el('svg', { 'class': 'dot-legend', 'aria-hidden': 'true', focusable: 'false', height: 16 });
    var x = 0, parts = [];
    items.forEach(function (it) {
      el('circle', { cx: x + 6, cy: 8, r: it.r, 'class': 'lg-dot ' + it.cls }, svg);
      var t = text(svg, x + 16, 12, it.text, 'lg-text', 'start');
      x += 16 + widthOf(t) + 16;
      parts.push(it.text);
    });
    svg.setAttribute('width', Math.ceil(x));
    svg.setAttribute('viewBox', '0 0 ' + Math.ceil(x) + ' 16');
    container.appendChild(svg);
    container.setAttribute('aria-label', 'Dot size scale: ' + parts.join(', '));
  }

  // ---- the night ruler -----------------------------------------------------------
  var RULER_PAD = 6;
  /** x of night index i on a ruler `width` px wide holding n nights. */
  function rulerX(i, width, n) { return RULER_PAD + i * (width - 2 * RULER_PAD) / Math.max(1, n - 1); }
  /** Night index nearest to x on the same ruler, clamped to the nights there are. */
  function rulerIndex(x, width, n) {
    if (n < 2 || !(width > 2 * RULER_PAD)) return 0;
    var i = Math.round((x - RULER_PAD) / (width - 2 * RULER_PAD) * (n - 1));
    return i < 0 ? 0 : i > n - 1 ? n - 1 : i;
  }
  /** Labelled step in nights (10, 20, 30, 50 or 100) so that labels sit at least minGap px apart. */
  function rulerStep(width, n, minGap) {
    var per = (width - 2 * RULER_PAD) / Math.max(1, n - 1);
    var steps = [10, 20, 30, 50, 100];
    for (var k = 0; k < steps.length; k++) if (steps[k] * per >= (minGap || 34)) return steps[k];
    return 100;
  }

  /**
   * The night ruler into an <svg>: one tick per night, taller every ten mission nights; baseline
   * nights quiet, nights up to the selected one brighter; labels "Arrival", 10, 20...; a blue marker
   * on the selected night. opts: { days: [missionDay], selected: index, events: [{ from, to, label }] }
   * `events` (indices into days) are drawn as a short bracket above the ticks with a tiny label at its
   * start, above the ruler and away from the tick numbers; a label that would run into the previous
   * one or past the right end is left out (the bracket stays).
   */
  function ruler(svg, opts) {
    var size = sizeOf(svg, 800, 46), W = size.w, H = 46, n = opts.days.length, base = 22;
    clear(svg);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    el('line', { x1: 0, y1: base, x2: W, y2: base, 'class': 'tick-base-line' }, svg);
    var step = rulerStep(W, n), arrivalX = null;
    opts.days.forEach(function (d, i) {
      var x = rulerX(i, W, n), tall = d >= 0 && d % 10 === 0;
      var cls = d < 0 ? 'tick tick-baseline' : i <= opts.selected ? 'tick tick-past' : 'tick tick-future';
      el('line', { x1: x, y1: base - (tall ? 9 : 4), x2: x, y2: base, 'class': cls }, svg);
      if (d >= 0 && d % step === 0) {
        if (d === 0) arrivalX = x;
        else if (arrivalX != null && x - arrivalX < 46) return;
        text(svg, x, 41, d === 0 ? 'Arrival' : String(d), 'ruler-label');
      }
    });
    var lastEnd = -Infinity;
    (opts.events || []).forEach(function (e) {
      var x0 = rulerX(e.from, W, n), x1 = Math.max(rulerX(e.to, W, n), x0 + 3), y = 8;
      el('path', { d: 'M' + x0 + ' ' + (y + 3) + 'V' + y + 'H' + x1 + 'V' + (y + 3), 'class': 'ruler-event' }, svg);
      if (!e.label) return;
      var t = text(svg, x0, -1, e.label, 'ruler-event-label', 'start'), w = widthOf(t);
      if (x0 < lastEnd + 8 || x0 + w > W) { svg.removeChild(t); return; }
      lastEnd = x0 + w;
    });
    var sx = rulerX(opts.selected, W, n);
    el('line', { x1: sx, y1: 4, x2: sx, y2: base + 4, 'class': 'ruler-mark' }, svg);
    el('circle', { cx: sx, cy: 4, r: 3.5, 'class': 'ruler-mark-dot' }, svg);
    return { x: function (i) { return rulerX(i, W, n); }, width: W };
  }

  var api = {
    placeLabels: placeLabels,
    bodyBox: bodyBox,
    plateLayout: plateLayout,
    stippleDot: stippleDot,
    stipple: stipple,
    nearestDay: nearestDay,
    sparkPoints: sparkPoints,
    spark: spark,
    plateFrame: plateFrame,
    dotLegend: dotLegend,
    hexRgb: hexRgb,
    rulerX: rulerX,
    rulerIndex: rulerIndex,
    rulerStep: rulerStep,
    ruler: ruler,
    dotScale: dotScale,
    STATUS: STATUS,
    ROSE_DIRECTIONS: ROSE_DIRECTIONS,
    statusIcon: statusIcon,
    statusIconEl: statusIconEl,
    niceTicks: niceTicks,
    format: fmt,
    doseParts: doseParts,
    doseTick: doseTick,
    useLogScale: useLogScale,
    upToDay: upToDay,
    colormap: colormap,
    parseStops: parseStops,
    normalise: normalise,
    line: line,
    logSeries: logSeries,
    image: image,
    colorbar: colorbar,
    rose: rose
  };

  ns.charts = api;
  if (inNode) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
