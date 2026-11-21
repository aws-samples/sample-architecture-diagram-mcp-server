// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// IconInstaller over scripts/fetch-icons.sh and the icon source the domain reads.
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { IconInstaller } from "#application/ports/index.ts";
import { hasIcons } from "./icons.ts";
import type { FsIconSource } from "./icons.ts";

export class FetchIconsInstaller implements IconInstaller {
  private readonly icons: FsIconSource;
  /** scripts/fetch-icons.sh of this package. */
  readonly script: string;
  constructor(icons: FsIconSource, packageRoot: string) {
    this.icons = icons;
    this.script = join(packageRoot, "scripts", "fetch-icons.sh");
  }
  root(): string { return this.icons.root(); }
  installed(): boolean { return hasIcons(this.icons.root()); }
  count(): number {
    try { return readdirSync(join(this.icons.root(), "icons")).filter(f => /\.(png|svg)$/i.test(f)).length; } catch { return 0; }
  }
  install({ source, dest }: { source?: string; dest?: string }): string {
    const args = [this.script, ...(source ? [source] : []), ...(dest ? ["--dest", dest] : [])];
    try {
      return execFileSync("bash", args, { encoding: "utf-8", maxBuffer: 8 * 1024 * 1024 });
    } catch (e) {
      const err = e as { stderr?: string; message?: string };
      throw new Error(`fetch-icons failed: ${err.stderr || err.message}`);
    }
  }
  refresh(): void { this.icons.reset(); }
  /** ~/.aws-architecture-icons (where the installer puts them by default). */
  get sharedRoot(): string { return this.icons.sharedIconRoot; }
}
