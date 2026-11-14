// Sample data for visual testing of js/charts.js. Hand-made; not model output.
// Written with an SI tool (Claude) and reviewed by the team.
(function () {
  'use strict';
  var charts = window.MyoTwin.charts;

  // Status icons
  var ul = document.getElementById('statuses');
  ['green', 'amber', 'red', 'grey'].forEach(function (s) {
    var li = document.createElement('li');
    li.className = 'st-' + s;
    li.appendChild(charts.statusIconEl(s, 18));
    li.appendChild(document.createTextNode(' ' + charts.STATUS[s].word + '  (' + charts.statusIcon(s) + ')'));
    ul.appendChild(li);
  });

  // Line chart sample: 14 baseline nights, then 60 mission days drifting down, with gaps.
  var series = [], expected = [], exercise = [];
  for (var d = -14; d <= 60; d++) {
    var wobble = Math.sin(d * 1.7) * 0.25 + Math.cos(d * 0.9) * 0.15;
    var v = d < 0 ? 9.0 + wobble : 9.0 - d * 0.03 + wobble;
    if (d === 20 || d === 21 || d === 22 || d === 41) v = null;
    series.push({ missionDay: d, value: v });
    if (d >= 0) {
      expected.push({ missionDay: d, low: 8.6 - d * 0.035, high: 9.4 - d * 0.022 });
      exercise.push({ missionDay: d, done: d % 7 !== 3 && d % 11 !== 5 });
    }
  }
  function statusAt(day) { return day < 0 ? 'green' : day < 25 ? 'green' : day < 45 ? 'amber' : 'red'; }

  function drawLines() {
    charts.line(document.getElementById('line-full'), {
      series: series,
      baseline: { median: 9.0, low: 8.62, high: 9.38 },
      expected: expected,
      thresholds: [{ value: 8.62, label: 'Watch', status: 'amber' }, { value: 7.5, label: 'Act now', status: 'red' }],
      markers: [{ missionDay: 0, label: 'Landing' }, { missionDay: 30, label: 'Sample event' }],
      exercise: exercise,
      statusAt: statusAt,
      selectedDay: 45,
      unit: 'deg',
      yLabel: 'Calf phase'
    });
    charts.line(document.getElementById('line-min'), {
      series: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (i) { return { missionDay: i, value: 6 + Math.sin(i) }; }),
      unit: 'h',
      yLabel: 'Sleep'
    });
  }

  // Rose
  charts.rose(document.getElementById('rose'), [120, 60, 30, 18, 12, 20, 35, 70], { highlightMax: true });

  // Images: a small ellipse "body" so the crispness of cells is visible.
  function blob(w, h, fn) {
    var values = new Float32Array(w * h), min = Infinity, max = -Infinity;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var v = fn(x, y);
        values[y * w + x] = v;
        if (isFinite(v)) { min = Math.min(min, v); max = Math.max(max, v); }
      }
    }
    return { w: w, h: h, values: values, min: min, max: max };
  }
  function inside(x, y, w, h) {
    var dx = (x + 0.5 - w / 2) / (w * 0.42), dy = (y + 0.5 - h / 2) / (h * 0.46);
    return dx * dx + dy * dy <= 1;
  }
  var W = 24, H = 40;
  var gray = blob(W, H, function (x, y) { return inside(x, y, W, H) ? 10 + 20 * Math.abs(Math.sin(x * 0.4) * Math.cos(y * 0.2)) : 0; });
  var heat = blob(W, H, function (x, y) { return inside(x, y, W, H) ? y / H * 100 : NaN; });
  var div = blob(W, H, function (x, y) { return inside(x, y, W, H) ? (y < H / 2 ? -1 : 1) * (x / W) * 12 : NaN; });

  charts.image(document.getElementById('img-gray'), gray, { colormap: 'gray', scale: 6 });
  charts.colorbar(document.getElementById('cb-gray'), { min: gray.min, max: gray.max, unit: 'cm', colormap: 'gray' });
  charts.image(document.getElementById('img-heat'), heat, { colormap: 'heat', scale: 6 });
  charts.colorbar(document.getElementById('cb-heat'), { min: heat.min, max: heat.max, unit: 'kPa', colormap: 'heat' });
  charts.image(document.getElementById('img-div'), div, { colormap: 'diverging', scale: 6, nanColor: [0, 0, 0, 0] });
  charts.colorbar(document.getElementById('cb-div'), { min: div.min, max: div.max, unit: '%', colormap: 'diverging' });

  drawLines();
  window.addEventListener('resize', drawLines);

  var btn = document.getElementById('theme');
  btn.addEventListener('click', function () {
    var on = document.body.classList.toggle('mode-eldercare');
    document.body.classList.toggle('mode-astronaut', !on);
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? 'Switch to Astronaut theme' : 'Switch to Eldercare theme';
    drawLines();
  });
  if (location.hash === '#eldercare') btn.click();
})();
