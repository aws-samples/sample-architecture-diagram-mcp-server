// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Where the AWS Architecture Icons live.
//
// They are NOT redistributed with this package (AWS Terms of Use), so they have
// to be fetched once. The thing that used to hurt was that "once" meant "once
// per copy of this server": a plugin install, an `npx` run and a git clone each
// looked only at their own `assets/`, so reinstalling or upgrading the plugin
// silently went back to rendering category-colored initials.
//
// Fix: a per-MACHINE cache that every copy shares. Resolution order:
//   1. AWS_DIAGRAM_ICON_ROOT      — explicit override, always wins
//   2. <package>/assets           — a checkout that fetched icons into itself
//   3. ~/.aws-architecture-icons  — the shared cache (fetch-icons.sh default)
// Falls back to <package>/assets so messages point somewhere sensible when no
// icons exist anywhere yet.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { extname, join } from "node:path";
import type { IconSource } from "#domain/ports/index.ts";

/** Environment variables this adapter reads (read on each resolution, like the old module). */
export type IconEnv = Readonly<Record<string, string | undefined>>;

export interface FsIconSourceOptions {
  /** The package root; its assets/ is candidate 2. */
  packageRoot: string;
  /** Holds AWS_DIAGRAM_ICON_ROOT (pass process.env in the composition root). */
  env?: IconEnv;
  /** Home folder of the shared cache (default os.homedir()). */
  home?: string;
}

/** True when <root>/icons holds at least one usable icon file. */
export function hasIcons(root: string): boolean {
  try {
    return readdirSync(join(root, "icons")).some(f => /\.(png|svg)$/i.test(f));
  } catch {
    return false; // missing/unreadable dir — just "no icons here"
  }
}

const MIME: Record<string, string> = { ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif" };

export class FsIconSource implements IconSource {
  /** <package>/assets. */
  readonly packageIconRoot: string;
  /** ~/.aws-architecture-icons. */
  readonly sharedIconRoot: string;
  private readonly env: IconEnv;
  private cached: string | null = null;
  private files: string[] | null = null;
  private filesRoot: string | null = null;

  constructor(options: FsIconSourceOptions) {
    this.packageIconRoot = join(options.packageRoot, "assets");
    this.sharedIconRoot = join(options.home ?? homedir(), ".aws-architecture-icons");
    this.env = options.env ?? {};
  }

  /** The directory holding icons/, aws-icons/, tech-icons/ for this process. */
  root(): string {
    if (this.cached) return this.cached;
    const env = this.env.AWS_DIAGRAM_ICON_ROOT;
    if (env) return (this.cached = env);
    for (const candidate of [this.packageIconRoot, this.sharedIconRoot]) {
      if (hasIcons(candidate)) return (this.cached = candidate);
    }
    return (this.cached = this.packageIconRoot);
  }

  /**
   * Forget the resolved root. Icons can land *while* the server is running (the
   * setup_icons tool), and the very next diagram must see them.
   */
  reset(): void {
    this.cached = null;
  }

  installed(): boolean {
    return hasIcons(this.root());
  }

  iconFiles(): readonly string[] {
    const root = this.root();
    if (this.files && this.filesRoot === root) return this.files;
    this.filesRoot = root;
    try { this.files = readdirSync(join(root, "icons")); } catch { this.files = []; } // assets not fetched yet
    return this.files;
  }

  /**
   * Resolve an icon reference to an absolute file path.
   *  - "aws-icons/user.svg" / "tech-icons/x.svg"  -> <root>/<as-is>
   *  - "Arch_X_48.png"                            -> <root>/icons/<name>
   */
  iconPath(ref: string): string {
    const root = this.root();
    if (ref.includes("/")) return join(root, ref);
    return join(root, "icons", ref);
  }

  dataUri(ref: string): string | null {
    try {
      const p = this.iconPath(ref);
      if (!existsSync(p)) return null;
      const ext = extname(p).toLowerCase();
      const mime = MIME[ext] || "application/octet-stream";
      const buf = readFileSync(p);
      return `data:${mime};base64,${buf.toString("base64")}`;
    } catch {
      return null;
    }
  }
}
