/*
 * MyoTwin drawing primitives: time-series line chart (SVG), image and colour
 * scale (canvas), radiation direction rose (SVG) and status icon references.
 * Pure helpers with no app state. Colours of SVG marks come from CSS classes
 * (so the theme can change them); canvas colormaps are computed here.
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
    red: { word: 'Act now', shape: 'octagon', icon: '#st-red' },
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

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }

  function ramp(stops, t) {
    t = clamp01(t);
    var n = stops.length - 1, i = Math.min(n - 1, Math.floor(t * n)), f = t * n - i;
    var a = stops[i], b = stops[i + 1];
    return [Math.round(lerp(a[0], b[0], f)), Math.round(lerp(a[1], b[1], f)), Math.round(lerp(a[2], b[2], f))];
  }

  // Perceptually ordered ramps, hand-picked; 'diverging' is blue - neutral - orange
  // (safe for red-green colour blindness), centred on 0 by the caller.
  var MAPS = {
    gray: [[12, 16, 24], [235, 239, 245]],
    heat: [[10, 14, 40], [72, 22, 110], [170, 50, 90], [236, 110, 50], [252, 205, 90], [252, 250, 210]],
    diverging: [[33, 102, 172], [120, 170, 214], [226, 230, 236], [244, 165, 96], [178, 70, 24]]
  };

  /** Colour for t in [0, 1] on a named colormap, as [r, g, b]. */
  function colormap(name, t) { return ramp(MAPS[name] || MAPS.gray, t); }

  /** Map a value to [0, 1]; diverging maps are centred on 0. */
  function normalise(v, min, max, name) {
    if (name === 'diverging') {
      var m = Math.max(Math.abs(min), Math.abs(max)) || 1;
      return 0.5 + 0.5 * (v / m);
    }
    return max > min ? (v - min) / (max - min) : 0.5;
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

  // ---- line chart --------------------------------------------------------------
  /**
   * Draw a time series into an <svg>.
   * opts: { series: [{missionDay, value|null}], baseline: {median, low, high}|null,
   *   expected: [{missionDay, low, high}]|null, thresholds: [{value, label, status}],
   *   markers: [{missionDay, label}], exercise: [{missionDay, done}]|null,
   *   statusAt: (missionDay) => status, selectedDay, unit, yLabel }
   */
  function line(svg, opts) {
    opts = opts || {};
    var series = opts.series || [];
    var size = sizeOf(svg, 640, 260);
    var W = size.w, H = size.h;
    var hasEx = opts.exercise && opts.exercise.length;
    var m = { l: 62, r: 16, t: 14, b: hasEx ? 50 : 38 };
    clear(svg);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('role', 'img');
    var label = (opts.yLabel || 'Value') + (opts.unit ? ' (' + opts.unit + ')' : '') +
      ' by mission day, ' + series.filter(function (p) { return p.value != null; }).length + ' nights with data';
    svg.setAttribute('aria-label', label);
    el('title', null, svg).textContent = label;

    // Domains
    var days = series.map(function (p) { return p.missionDay; });
    (opts.expected || []).forEach(function (p) { days.push(p.missionDay); });
    var x0 = Math.min.apply(null, days.length ? days : [0]);
    var x1 = Math.max.apply(null, days.length ? days : [1]);
    if (x1 === x0) x1 = x0 + 1;
    var ys = [];
    series.forEach(function (p) { if (p.value != null) ys.push(p.value); });
    if (opts.baseline) ys.push(opts.baseline.low, opts.baseline.high, opts.baseline.median);
    (opts.expected || []).forEach(function (p) { ys.push(p.low, p.high); });
    (opts.thresholds || []).forEach(function (t) { ys.push(t.value); });
    ys = ys.filter(function (v) { return v != null && isFinite(v); });
    var y0 = ys.length ? Math.min.apply(null, ys) : 0, y1 = ys.length ? Math.max.apply(null, ys) : 1;
    var pad = (y1 - y0 || Math.abs(y1) || 1) * 0.08;
    y0 -= pad; y1 += pad;
    var yt = niceTicks(y0, y1, Math.max(3, Math.floor((H - m.t - m.b) / 44)));
    if (yt.length) { y0 = Math.min(y0, yt[0]); y1 = Math.max(y1, yt[yt.length - 1]); }

    var pw = W - m.l - m.r, ph = H - m.t - m.b;
    function X(d) { return m.l + (d - x0) / (x1 - x0) * pw; }
    function Y(v) { return m.t + (1 - (v - y0) / (y1 - y0)) * ph; }

    // Baseline period shading (mission days below 0)
    if (x0 < 0) {
      var bx1 = X(Math.min(-0.5, x1));
      el('rect', { x: m.l, y: m.t, width: Math.max(0, bx1 - m.l), height: ph, 'class': 'baseline-period' }, svg);
      if (bx1 - m.l >= 64) text(svg, (m.l + bx1) / 2, H - m.b + 18, 'Baseline', 'ax-label ax-baseline');
    }

    // Grid and y axis
    yt.forEach(function (v) {
      el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), 'class': 'grid' }, svg);
      text(svg, m.l - 8, Y(v) + 4, fmt(v), 'ax-label', 'end');
    });
    if (opts.yLabel) {
      var yl = text(svg, 0, 0, opts.yLabel + (opts.unit ? ' (' + opts.unit + ')' : ''), 'ax-title');
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
    text(svg, m.l + pw, H - 4, 'Mission day', 'ax-title', 'end');

    // Baseline band and median
    if (opts.baseline && opts.baseline.low != null && opts.baseline.high != null) {
      var b = opts.baseline;
      el('rect', { x: m.l, y: Y(b.high), width: pw, height: Math.max(0, Y(b.low) - Y(b.high)), 'class': 'band-baseline' }, svg);
      if (b.median != null) el('line', { x1: m.l, x2: W - m.r, y1: Y(b.median), y2: Y(b.median), 'class': 'line-median' }, svg);
      if (pw >= 420) text(svg, W - m.r - 4, Y(b.high) - 4, 'Own baseline', 'band-label', 'end');
    }

    // Expected band
    if (opts.expected && opts.expected.length > 1) {
      var ex = opts.expected.slice().sort(function (a, c) { return a.missionDay - c.missionDay; });
      var d = ex.map(function (p, i) { return (i ? 'L' : 'M') + X(p.missionDay).toFixed(1) + ',' + Y(p.high).toFixed(1); }).join('');
      for (var i = ex.length - 1; i >= 0; i--) d += 'L' + X(ex[i].missionDay).toFixed(1) + ',' + Y(ex[i].low).toFixed(1);
      el('path', { d: d + 'Z', 'class': 'band-expected' }, svg);
    }

    // Thresholds
    (opts.thresholds || []).forEach(function (t) {
      if (t.value == null || t.value < y0 || t.value > y1) return;
      el('line', { x1: m.l, x2: W - m.r, y1: Y(t.value), y2: Y(t.value), 'class': 'threshold st-' + statusKey(t.status) }, svg);
      if (t.label) text(svg, m.l + 6, Y(t.value) - 4, t.label, 'threshold-label st-' + statusKey(t.status), 'start');
    });

    // Event markers
    (opts.markers || []).forEach(function (mk, k) {
      if (mk.missionDay < x0 || mk.missionDay > x1) return;
      var mx = X(mk.missionDay);
      el('line', { x1: mx, x2: mx, y1: m.t, y2: m.t + ph, 'class': 'event' }, svg);
      if (mk.label) {
        var anchor = mx > m.l + pw * 0.75 ? 'end' : 'start';
        var rows = pw < 420 ? 3 : 2;
        text(svg, mx + (anchor === 'end' ? -4 : 4), m.t + 12 + (k % rows) * 14, mk.label, 'event-label', anchor);
      }
    });

    // Selected day
    if (opts.selectedDay != null && opts.selectedDay >= x0 && opts.selectedDay <= x1) {
      el('line', { x1: X(opts.selectedDay), x2: X(opts.selectedDay), y1: m.t, y2: m.t + ph, 'class': 'selected-day' }, svg);
    }

    // Series line with gaps, then status-shaped points
    var path = '', pen = false;
    series.forEach(function (p) {
      if (p.value == null || !isFinite(p.value)) { pen = false; return; }
      path += (pen ? 'L' : 'M') + X(p.missionDay).toFixed(1) + ',' + Y(p.value).toFixed(1);
      pen = true;
    });
    if (path) el('path', { d: path, 'class': 'series' }, svg);
    var r = series.length > 120 ? 2.5 : 3.5;
    series.forEach(function (p) {
      if (p.value == null || !isFinite(p.value)) return;
      var st = opts.statusAt ? opts.statusAt(p.missionDay) : 'green';
      var big = p.missionDay === opts.selectedDay;
      var node = marker(svg, X(p.missionDay), Y(p.value), st, big ? r + 2.5 : r);
      if (big) node.setAttribute('class', node.getAttribute('class') + ' mk-selected');
    });

    // Exercise log ticks along the bottom
    if (hasEx) {
      var ey = H - m.b + 30;
      opts.exercise.forEach(function (e) {
        if (e.missionDay < x0 || e.missionDay > x1) return;
        el('line', { x1: X(e.missionDay), x2: X(e.missionDay), y1: ey - (e.done ? 6 : 2), y2: ey,
          'class': e.done ? 'ex-done' : 'ex-missed' }, svg);
      });
      text(svg, m.l - 8, ey, 'Exercise', 'ax-label', 'end');
    }
    return { x: X, y: Y };
  }

  // ---- image -------------------------------------------------------------------
  /**
   * Draw a row-major Float32Array image (values[y * w + x]) onto a canvas with
   * nearest-neighbour scaling. NaN cells get nanColor.
   * image: { w, h, values, min, max }; opts: { colormap, nanColor: [r,g,b,a], scale }
   */
  function image(canvas, img, opts) {
    opts = opts || {};
    var name = opts.colormap || 'gray';
    var scale = Math.max(1, Math.round(opts.scale || 4));
    var nan = opts.nanColor || [0, 0, 0, 0];
    var w = img.w, h = img.h, v = img.values;
    var min = img.min, max = img.max;
    var doc = root.document;
    var src = doc.createElement('canvas');
    src.width = w; src.height = h;
    var sctx = src.getContext('2d');
    var data = sctx.createImageData(w, h);
    for (var i = 0; i < w * h; i++) {
      var val = v[i], o = i * 4;
      if (val == null || !isFinite(val)) {
        data.data[o] = nan[0]; data.data[o + 1] = nan[1]; data.data[o + 2] = nan[2];
        data.data[o + 3] = nan.length > 3 ? nan[3] : 255;
        continue;
      }
      var c = colormap(name, normalise(val, min, max, name));
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
    var doc = root.document, name = scale.colormap || 'gray';
    while (container.firstChild) container.removeChild(container.firstChild);
    var min = scale.min, max = scale.max;
    if (name === 'diverging') { var m = Math.max(Math.abs(min), Math.abs(max)) || 1; min = -m; max = m; }
    var cv = doc.createElement('canvas');
    cv.width = 256; cv.height = 1;
    cv.className = 'colorbar-strip';
    cv.setAttribute('aria-hidden', 'true');
    var ctx = cv.getContext('2d'), id = ctx.createImageData(256, 1);
    for (var i = 0; i < 256; i++) {
      var c = colormap(name, i / 255);
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
    [f(min) + unit, name === 'diverging' ? '0' : f((min + max) / 2), f(max) + unit].forEach(function (s) {
      var sp = doc.createElement('span');
      sp.textContent = s;
      labels.appendChild(sp);
    });
    container.appendChild(labels);
    container.setAttribute('aria-label', 'Colour scale from ' + f(min) + ' to ' + f(max) + unit);
  }

  // ---- direction rose ----------------------------------------------------------
  /**
   * 8-sector rose of particle arrival directions. Sector 0 points toward the head
   * (up); sectors run clockwise. Wedge radius is proportional to sqrt(count / max),
   * so wedge area is proportional to count. opts: { highlightMax: true }
   */
  function rose(svg, counts, opts) {
    opts = opts || {};
    counts = (counts || []).slice(0, 8);
    while (counts.length < 8) counts.push(0);
    var S = 220, c = S / 2, R = 72;
    clear(svg);
    svg.setAttribute('viewBox', '0 0 ' + S + ' ' + S);
    svg.setAttribute('role', 'img');
    var max = Math.max.apply(null, counts), imax = counts.indexOf(max);
    var lab = 'Particle arrival directions in 8 sectors, sector 0 toward the head. Counts: ' + counts.join(', ');
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
    return imax;
  }

  var api = {
    STATUS: STATUS,
    statusIcon: statusIcon,
    statusIconEl: statusIconEl,
    niceTicks: niceTicks,
    format: fmt,
    colormap: colormap,
    normalise: normalise,
    line: line,
    image: image,
    colorbar: colorbar,
    rose: rose
  };

  ns.charts = api;
  if (inNode) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
