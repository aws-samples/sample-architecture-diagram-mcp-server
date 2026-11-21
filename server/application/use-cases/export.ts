// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Export: a .drawio to PNG/SVG/PDF (draw.io desktop), and an interactive HTML
// to a PNG figure / animated GIF / animated SVG (headless browser).
import type { RasterizeRequest, RasterizeResult, WrittenFile } from "#application/ports/index.ts";
import type { AppDeps } from "./deps.ts";
import { WrittenFiles } from "./files.ts";

export type DrawioExportResult =
  | { status: "input-missing" }
  | { status: "no-converter" }
  | { status: "no-output" }
  | { status: "failed"; message: string }
  | { status: "ok"; written: WrittenFile[] };

export type MediaRequest = Omit<RasterizeRequest, "htmlPath" | "pngPath" | "gifPath" | "svgPath"> & { htmlPath: string; pngPath?: string; gifPath?: string; svgPath?: string };

export function createExport(deps: AppDeps) {
  const { workspace: ws } = deps;
  return {
    exportDrawio({ inputPath, outputPath, format, scale }: { inputPath: string; outputPath: string; format: "png" | "svg" | "pdf"; scale: number }): DrawioExportResult {
      const input = ws.resolve(inputPath);
      const output = ws.resolve(outputPath);
      if (!ws.exists(input)) return { status: "input-missing" };
      if (!deps.drawio.available()) return { status: "no-converter" };
      try {
        deps.drawio.export({ inputPath: input, outputPath: output, format, scale });
      } catch (e) {
        return { status: "failed", message: e instanceof Error ? e.message : String(e) };
      }
      if (!ws.exists(output)) return { status: "no-output" };
      const files = new WrittenFiles(ws);
      files.add(output);
      return { status: "ok", written: files.list };
    },

    /** Rasterize an interactive diagram. The result names the paths as the caller gave them. */
    async renderMedia(req: MediaRequest): Promise<RasterizeResult & { written: WrittenFile[] }> {
      const abs = (p: string | undefined) => (p === undefined ? undefined : ws.resolve(p));
      const htmlPath = ws.resolve(req.htmlPath);
      if (!ws.exists(htmlPath)) throw new Error(`html not found: ${req.htmlPath}`);
      const r = await deps.rasterizer.render({ ...req, htmlPath, pngPath: abs(req.pngPath), gifPath: abs(req.gifPath), svgPath: abs(req.svgPath) });
      const files = new WrittenFiles(ws);
      for (const p of [r.png, r.gif, r.svg]) if (p && ws.exists(p)) files.add(p);
      return {
        ...r,
        ...(r.png ? { png: req.pngPath } : {}),
        ...(r.gif ? { gif: req.gifPath } : {}),
        ...(r.svg ? { svg: req.svgPath } : {}),
        written: files.list,
      };
    },
  };
}
export type Export = ReturnType<typeof createExport>;
