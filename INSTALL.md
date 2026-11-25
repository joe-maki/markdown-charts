# markdown-charts: install

**For the person:** clone or unzip this anywhere, open Claude Code, and say:

> Install the markdown-charts skill by following INSTALL.md in `<path to this folder>`.

After that, any time you ask Claude for a report or notes in Markdown, it can add charts that render in Office Viewer, the VS Code preview, and GitHub, and that switch with light and dark themes.

You need **Node.js 18 or later**. Check with `node --version`. If it's missing, install it from nodejs.org or with `brew install node`.

---

## For Claude: install steps

Do these in order. Tell the user what you're doing at each step. Stop and report if a step fails.

1. **Check Node.** Run `node --version`. It must be v18 or later. If it's missing or too old, stop and tell the user how to install it (nodejs.org or `brew install node`).

2. **Copy the skill.** Copy the `markdown-charts/` folder that sits next to this file to `~/.claude/skills/markdown-charts/`, creating `~/.claude/skills/` if it doesn't exist.
   - If `~/.claude/skills/markdown-charts/` already exists, show the user how the two versions differ and ask before overwriting.
   - If a sandbox blocks writing under `~/.claude/`, rerun the copy outside the sandbox (the user will be asked to approve it).

3. **Install dependencies.** Run `cd ~/.claude/skills/markdown-charts && npm install`. This pulls in vega and vega-lite from the npm registry.

4. **Verify.**
   - Run `node ~/.claude/skills/markdown-charts/render.mjs ~/.claude/skills/markdown-charts/examples/`.
   - It should print `wrote …/bar-single-series.svg` and `wrote …/line-two-series.svg`.
   - Each SVG should be about 490–530 px wide. Check with `grep -o '^<svg[^>]*' <file>`.
   - On macOS you can also preview the output: `qlmanage -t -s 1100 -o "$TMPDIR" <svg>`, then read the PNG.

5. **Register it in CLAUDE.md.** Skills in `~/.claude/skills/` are discovered automatically. Also add a standing note so charts are offered without being asked for.
   - Open `~/.claude/CLAUDE.md`, creating it if it doesn't exist, and keep everything already in it.
   - Append this section unless a markdown-charts note is already there:

     ```markdown
     ## Charts in Markdown
     When writing a report, analysis, or notes as a Markdown file and the content has numbers worth seeing, use the `markdown-charts` skill (~/.claude/skills/markdown-charts/SKILL.md): Vega-Lite spec → render.mjs → SVG embedded with ![](), with the data table kept next to it. Load the `dataviz` skill too, if available, for chart design rules.
     ```

6. **Report back.**
   - Tell the user it's installed.
   - Mention that the skill is available from the next Claude Code session, or right away if their version picks up new skills live.
   - Offer to make a sample chart in one of their Markdown files.
