// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// DrawioExporter over the draw.io desktop CLI (optional; found per OS).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import type { DrawioExporter } from "#application/ports/index.ts";

const CANDIDATES = [
  "drawio",
  "/Applications/draw.io.app/Contents/MacOS/draw.io", // macOS app bundle
  "/usr/bin/drawio",
  "/snap/bin/drawio",
];

export class DrawioCliExporter implements DrawioExporter {
  private readonly env: Readonly<Record<string, string | undefined>>;
  private readonly platform: string;
  constructor({ env = {}, platform = process.platform }: { env?: Readonly<Record<string, string | undefined>>; platform?: string } = {}) {
    this.env = env;
    this.platform = platform;
  }

  /** An invocable draw.io command, or null when it is not installed. */
  locate(): string | null {
    for (const cmd of CANDIDATES) {
      try {
        if (cmd.includes("/")) {
          if (existsSync(cmd)) return cmd; // absolute path: no process spawn
        } else {
          // Bare name: resolve on PATH via `which`, args as an array (no shell).
          execFileSync("which", [cmd], { stdio: "ignore" });
          return cmd;
        }
      } catch { /* try next */ }
    }
    return null;
  }

  available(): boolean {
    return this.locate() !== null;
  }

  export({ inputPath, outputPath, format, scale }: { inputPath: string; outputPath: string; format: "png" | "svg" | "pdf"; scale: number }): void {
    const cli = this.locate();
    if (!cli) throw new Error("draw.io CLI not found");
    // An argument list (no shell string): paths/format cannot inject commands.
    const drawioArgs = ["--export", "--format", String(format), "--scale", String(scale), "--output", outputPath, inputPath];
    // Headless export needs a display; Linux servers require xvfb-run.
    const needsXvfb = this.platform === "linux" && !this.env.DISPLAY;
    const [bin, argv] = needsXvfb ? ["xvfb-run", ["-a", cli, ...drawioArgs]] as const : [cli, drawioArgs] as const;
    execFileSync(bin, argv, { timeout: 60000, stdio: "ignore" });
  }
}
