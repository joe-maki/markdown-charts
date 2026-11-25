#!/usr/bin/env node
// Render Vega-Lite specs to self-contained, theme-aware SVGs for Markdown reports.
// Part of the markdown-charts Claude Code skill (~/.claude/skills/markdown-charts).
//
//   node ~/.claude/skills/markdown-charts/render.mjs path/to/chart.vl.json [...]
//   node ~/.claude/skills/markdown-charts/render.mjs path/to/charts/   (all *.vl.json)
//
// Each foo.vl.json becomes foo.svg next to it. Embed with ![alt](charts/foo.svg).
// Data: inline "values" or a "url" relative to the spec's own folder.
// Theme: light palette baked into the SVG + a prefers-color-scheme:dark stylesheet
// that swaps every light token for its dark step (CSS beats SVG presentation attrs).

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const vega = require('vega');
const vl = require('vega-lite');

// ---- Palette: dataviz reference instance (validated light + dark) ----------
const LIGHT = {
  surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', muted: '#898781',
  grid: '#e1e0d9', axis: '#c3c2b7',
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
};
const DARK = {
  surface: '#1a1a19', ink: '#f0efec', ink2: '#c3c2b7', muted: '#898781',
  grid: '#2c2c2a', axis: '#383835',
  series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'],
};
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// ---- Text measurement ------------------------------------------------------
// Without node-canvas Vega guesses 0.8em per character, which makes every SVG far
// wider than its content. Use Helvetica's AFM advance widths (per 1000 em), a close
// match for the system sans, with a small safety margin. Vega supports a
// user-defined textMetrics.width (vl-convert does the same thing).
const HELV = ' 278!278"355#556$556%889&667\'191(333)333*389+584,278-333.278/278' +
  '05561556255635564556555665567556855695:278;278<584=584>584?556@1015A667B667C722' +
  'D722E667F611G778H722I278J500K667L556M833N722O778P667Q778R722S667T611U722V667W944' +
  'X667Y667Z611[278\\278]278^469_556`333a556b556c500d556e556f278g556h556i222j222' +
  'k500l222m833n556o556p556q556r333s500t278u556v500w722x500y500z500{334|260}334~584' +
  '–556—1000’222‘222“333”333…1000·278×584';
const CHAR_W = new Map();
for (const m of HELV.matchAll(/(.)(\d+)/gsu)) CHAR_W.set(m[1], +m[2] / 1000);
vega.textMetrics.width = (item, text) => {
  const t = text == null ? '' : String(text).trim();
  const size = item.fontSize != null ? +item.fontSize || 0 : 11;
  const bold = item.fontWeight === 'bold' || +item.fontWeight >= 600;
  let em = 0;
  for (const ch of t) em += CHAR_W.get(ch) ?? 0.556;
  return em * size * (bold ? 1.08 : 1.03);
};

const config = {
  background: LIGHT.surface,
  padding: 16,
  font: FONT,
  view: { stroke: null },
  title: { color: LIGHT.ink, subtitleColor: LIGHT.ink2, anchor: 'start', fontSize: 15,
           fontWeight: 600, subtitleFontSize: 12, subtitleFontWeight: 400, offset: 14 },
  axis: { domainColor: LIGHT.axis, tickColor: LIGHT.axis, gridColor: LIGHT.grid, gridWidth: 1,
          labelColor: LIGHT.muted, titleColor: LIGHT.ink2, labelFontSize: 11, titleFontSize: 11,
          titleFontWeight: 400, labelPadding: 6, tickSize: 4 },
  axisBand: { grid: false, ticks: false },
  axisY: { domain: false, ticks: false },
  legend: { labelColor: LIGHT.ink2, titleColor: LIGHT.ink2, labelFontSize: 11, titleFontSize: 11,
            titleFontWeight: 400, orient: 'top', symbolType: 'circle', symbolSize: 64 },
  range: { category: LIGHT.series },
  bar: { fill: LIGHT.series[0], cornerRadiusEnd: 4 },
  rect: { fill: LIGHT.series[0] },
  barBandPaddingInner: 0.3,
  line: { stroke: LIGHT.series[0], strokeWidth: 2, strokeCap: 'round', strokeJoin: 'round' },
  point: { filled: true, size: 64, opacity: 1, stroke: LIGHT.surface, strokeWidth: 2, fill: LIGHT.series[0] },
  area: { fill: LIGHT.series[0], opacity: 0.1 },
  text: { color: LIGHT.ink2, fontSize: 11 },
  scale: { bandPaddingInner: 0.3 },
};

// Cap bar thickness at 24px (marks spec) unless the spec sets its own size.
function capBars(spec) {
  const walk = (s) => {
    if (!s || typeof s !== 'object') return;
    const m = s.mark;
    if (m === 'bar' || (m && m.type === 'bar')) {
      if (typeof m === 'string') s.mark = { type: 'bar', size: 24 };
      else if (m.size == null) m.size = 24;
    }
    for (const k of ['layer', 'concat', 'hconcat', 'vconcat']) (s[k] || []).forEach(walk);
    if (s.spec) walk(s.spec);
  };
  walk(spec);
  return spec;
}

function darkStylesheet() {
  const pairs = [
    [LIGHT.surface, DARK.surface], [LIGHT.ink, DARK.ink], [LIGHT.ink2, DARK.ink2],
    [LIGHT.grid, DARK.grid], [LIGHT.axis, DARK.axis],
    ...LIGHT.series.map((c, i) => [c, DARK.series[i]]),
  ];
  const rules = [];
  for (const [l, d] of pairs) {
    for (const attr of ['fill', 'stroke']) {
      // Vega writes hex in lower case; match both cases to be safe.
      rules.push(`[${attr}="${l}" i]{${attr}:${d}}`);
    }
  }
  return `<style>@media (prefers-color-scheme: dark){${rules.join('')}}</style>`;
}

async function renderOne(specPath) {
  const abs = resolve(specPath);
  const spec = capBars(JSON.parse(readFileSync(abs, 'utf8')));
  spec.config = { ...config, ...(spec.config || {}) };
  const compiled = vl.compile(spec).spec;
  const loader = vega.loader({ baseURL: dirname(abs) + '/', mode: 'file' });
  const view = new vega.View(vega.parse(compiled), { loader, renderer: 'none' });
  let svg = await view.toSVG();
  view.finalize();
  // Inject the dark-mode stylesheet right after the opening <svg ...> tag.
  svg = svg.replace(/(<svg[^>]*>)/, `$1${darkStylesheet()}`);
  // Rounded card corners on the background rect (first rect Vega emits).
  svg = svg.replace(/<rect([^>]*?)fill="#fcfcfb"/i, '<rect$1rx="8" ry="8" fill="#fcfcfb"');
  const out = abs.replace(/\.vl\.json$/, '.svg');
  writeFileSync(out, svg);
  return out;
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error('usage: node ~/.claude/skills/markdown-charts/render.mjs <spec.vl.json | dir> ...');
  process.exit(2);
}
const targets = args.flatMap((a) =>
  statSync(a).isDirectory()
    ? readdirSync(a).filter((f) => f.endsWith('.vl.json')).map((f) => join(a, f))
    : [a]);
for (const t of targets) {
  try { console.log('wrote', await renderOne(t)); }
  catch (e) { console.error('FAILED', t, '\n ', e.message); process.exitCode = 1; }
}
