---
name: markdown-charts
description: Put charts and data visualizations in Markdown files and reports. Write a Vega-Lite spec, render it to a theme-aware SVG with this skill's render.mjs, and embed it with a Markdown image link next to a data table. Use whenever a report, research note, README or other .md file would benefit from a chart, graph, plot or visualization, or when the user asks for a chart in a Markdown document. TRIGGER on "chart", "graph", "plot", "visualize", "data viz" when the output is a Markdown file.
---

# Markdown charts

Charts in Markdown are **Vega-Lite specs rendered to SVG files** and embedded with `![finding](charts/<slug>.svg)`. That works in every Markdown viewer: Office Viewer, the VS Code preview, GitHub, and PDF/DOCX export. Code-block charts work only where the viewer bundles that library.

This skill folder is `~/.claude/skills/markdown-charts/`. Below, `$SKILL` means that path.

## Steps

1. **Pick the form first**: bar, line, dot, or not a chart at all. If the `dataviz` skill is available, load it for form and design rules; this skill handles the pipeline. One finding per chart.
2. **Write the spec** at `charts/<slug>.vl.json`, in a `charts/` folder next to the Markdown file. Start from the closest template:
   - `$SKILL/examples/bar-single-series.vl.json`: one series, columns, a value on each cap, no y-axis.
   - `$SKILL/examples/line-two-series.vl.json`: two series, lines with markers, a legend, and end-value labels.

   Put the data inline in `"data": {"values": [...]}`. For large data, use `"data": {"url": "file.csv"}`, which resolves relative to the spec's folder.
3. **Render:**
   ```sh
   node ~/.claude/skills/markdown-charts/render.mjs charts/            # all specs in the folder
   node ~/.claude/skills/markdown-charts/render.mjs charts/<slug>.vl.json
   ```
   Each `<slug>.vl.json` is written out as `<slug>.svg` in the same folder.
4. **Embed** `![<the finding as a sentence>](charts/<slug>.svg)` in the Markdown. **Always keep a data table next to the chart.** A static image has no hover or tooltips, so the table is the accessible view of the data.
5. **Look at it before you finish.** On macOS, run `qlmanage -t -s 1100 -o "$TMPDIR" charts/<slug>.svg` and read the PNG it produces. Check for label collisions, clipped text, and wasted space. If a sandbox blocks `qlmanage`, rerun it outside the sandbox; it only writes a preview image.

## What render.mjs does for you

- **Applies a validated palette.** It comes from the dataviz skill's reference palette.
  - Categorical slots in a fixed order: blue, orange, aqua, yellow, magenta, green, violet, red.
  - Ink colors for text, and hairline grid lines.
- **Embeds a dark mode.** Each SVG carries a `prefers-color-scheme: dark` stylesheet that switches every palette color to its dark step, so charts follow light and dark editor themes.
- **Applies mark specs.**
  - Bars are capped at 24px wide with 4px rounded ends.
  - Lines are 2px.
  - Points are solid 8px dots with a 2px ring in the surface color.
  - The y-axis line is hidden.
- **Measures text with a font-width table.** Vega in Node has no font engine, and its fallback overestimates widths by about 50%, which bloats the SVG.

## Spec conventions

- **Title:** the finding, as a sentence. **Subtitle:** an array of lines, each about 70 characters or fewer, giving what was measured and then the source.
- **Size:** `"width": 460` and a height of 220–260, which fits a Markdown column.
- **Legend:** one series gets no legend, because the title names it. Two or more series get a legend plus selective direct labels, such as end values. Never put a number on every point.
- **One y-axis only.** Never use a dual axis. To compare measures on different scales, index them to a common base or make two charts.
- **Colors:** don't set series colors. Let the theme assign slots in order.
  - Scatter plots and small multiples get at most 3 series; fold the rest into "Other" or facet them.
  - A hand-set color must be a palette hex, or the dark-mode swap won't catch it.
- **Text:** use the ink colors (`#0b0b0b`, `#52514e`, `#898781`), never a series color.

## Viewer notes

**Office Viewer** (the cweijan.vscode-office extension, built on Vditor):
- Image links to SVG files render.
- Mermaid code blocks render, including `xychart-beta` bar and line charts, `pie`, and `quadrantChart`. They use the viewer's own theme, so keep them for diagrams and quick sketches.
- ECharts code blocks are not bundled.
- Raw HTML and inline `<svg>` go through a sanitizer, so prefer image links.

**The VS Code preview and GitHub** both render SVG image links. GitHub follows the reader's OS color scheme for the dark variant.

## Troubleshooting

- **`Cannot find module 'vega'`:** run `cd ~/.claude/skills/markdown-charts && npm install`.
- **Node:** needs Node 18 or later.
- **pip/Python:** not needed. The renderer is Node-only on purpose.
- **Very wide SVG:** a long title or subtitle line stretches the chart. Split the subtitle into an array of shorter lines.
- **A color doesn't change in dark mode:** it isn't a palette hex. Use a palette color, or remove the override.
