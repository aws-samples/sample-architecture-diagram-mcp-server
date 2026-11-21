// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Export: a .drawio to PNG/SVG/PDF, and an interactive HTML to publishable media.
import { z } from "zod";
import type { Application } from "#application/index.ts";
import { errorOf, failure, text, tool } from "#adapters/inbound/mcp/tool.ts";
import type { ToolDef } from "#adapters/inbound/mcp/tool.ts";


export function exportTools(app: Application): ToolDef[] {
  return [
    tool("export_diagram",
      "Export a .drawio file (from auto_generate_diagram / generate_diagram) to PNG/SVG/PDF. Requires the draw.io desktop CLI (optional dependency).",
      { inputPath: z.string(), outputPath: z.string(), format: z.enum(["png", "svg", "pdf"]).optional().default("png"), scale: z.number().optional().default(2) },
      ({ inputPath, outputPath, format, scale }) => {
    const r = app.export.exportDrawio({ inputPath, outputPath, format, scale });
    switch (r.status) {
      case "input-missing": return failure(`Input not found: ${inputPath}`);
      case "no-converter": return failure(
        "draw.io CLI not found, so this tool can't rasterize the file.\n" +
        "Options:\n" +
        "  - Install it: https://github.com/jgraph/drawio-desktop/releases (or `brew install --cask drawio`), then retry.\n" +
        "  - Or open the .drawio in https://app.diagrams.net and File > Export.\n" +
        "  - For PNG, prefer generate_html_diagram and use the in-browser PNG button (no CLI needed).");
      case "failed": return failure(`Export failed: ${r.message}\nIf on a headless Linux host, install xvfb (apt-get install xvfb).`);
      case "no-output": return failure(`Export ran but no output was produced at ${outputPath}. On headless Linux, ensure xvfb is installed (apt-get install xvfb).`);
      default: return text(`Exported: ${outputPath}`, r.written);
    }
  }),
    tool("render_diagram_media",
      "Rasterize an interactive diagram HTML (from generate_html_diagram / diagram_render) into publishable assets: a PNG @2x figure, an animated GIF, and/or an animated SVG. GIF has two modes: 'flow' (the dots travelling the edges, one seamless loop) and 'walkthrough' (one animated segment PER guided beat/step, concatenated into a looping tour). The SVG is vector + STILL ANIMATED (the flow-dot SMIL is preserved) — sharp at any size and tiny to serve, but many CMSs incl. the AWS Blog/WordPress BLOCK svg upload, so use SVG for your OWN site/embed and GIF for WordPress. Use this to embed a diagram where JS can't run — blog post, PDF, email, slide. Needs headless Chromium (Playwright) and, for GIF, a full ffmpeg on PATH.",
      {
    htmlPath: z.string().describe("Path to the interactive diagram .html produced by generate_html_diagram or diagram_render."),
    pngPath: z.string().optional().describe("If set, write a static PNG figure here (motion frozen)."),
    gifPath: z.string().optional().describe("If set, write an animated GIF here."),
    svgPath: z.string().optional().describe("If set, write a self-contained ANIMATED SVG here (vector, flow-dot animation preserved). For your own site/embed — NOT the AWS Blog/WordPress, which blocks SVG upload."),
    mode: z.enum(["flow", "walkthrough"]).optional().default("flow").describe("GIF content: 'flow' = one looping segment of the animated data flow; 'walkthrough' = one animated segment per guided beat (requires the HTML to have `steps`), concatenated into a looping tour. PNG/SVG are unaffected."),
    theme: z.enum(["light", "dark"]).optional().default("light").describe("Render theme."),
    width: z.number().int().optional().default(1200).describe("Capture width in px."),
    height: z.number().int().optional().default(675).describe("Capture height in px."),
    scale: z.number().optional().default(2).describe("Device scale factor (PNG @Nx)."),
    period: z.number().optional().default(4).describe("flow mode: GIF loop length in seconds; every edge's flow dot shares this exact period so the loop closes seamlessly. (For the sharpest loop, also pass the SAME value as flowPeriod to generate_html_diagram.)"),
    frames: z.number().int().optional().default(24).describe("flow mode: frames captured across one period (GIF smoothness)."),
    beatDuration: z.number().optional().default(2.5).describe("walkthrough mode: seconds held on each beat."),
    beatFrames: z.number().int().optional().default(15).describe("walkthrough mode: frames captured per beat."),
  },
      async ({ htmlPath, pngPath, gifPath, svgPath, mode, theme, width, height, scale, period, frames, beatDuration, beatFrames }) => {
    if (!pngPath && !gifPath && !svgPath) return failure("Nothing to render: set pngPath, gifPath and/or svgPath.");
    try {
      const r = await app.export.renderMedia({ htmlPath, pngPath, gifPath, svgPath, mode, theme, width, height, scale, period, frames, beatDuration, beatFrames });
      const gifDesc = r.gif && (r.mode === "walkthrough"
        ? `GIF: ${r.gif} (walkthrough · ${r.beats || 0} beats × ${beatDuration}s)`
        : `GIF: ${r.gif} (flow · ${period}s loop, ${frames} frames)`);
      const made = [r.png && `PNG: ${r.png}`, gifDesc, r.svg && `SVG: ${r.svg} (animated vector)`].filter(Boolean);
      return text(`Rendered:\n  ${made.join("\n  ")}` + (r.warnings.length ? `\n\n${r.warnings.join("\n")}` : ""), r.written);
    } catch (e) {
      return failure(
        `Render failed: ${errorOf(e)}\n` +
        "Requirements: headless Chromium via Playwright (`npx playwright install chromium`) and, for GIF, a full ffmpeg on PATH (`brew install ffmpeg`).");
    }
  }),
  ];
}
