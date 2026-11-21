// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The filesystem behind saved layouts, custom components and the bundle cache.
// Folders come from the environment passed in (read on each call, like the old
// module did, so a host may change them at runtime):
//   DIAGRAM_LAYOUTS_DIR     one or more folders (path-delimiter separated); the
//                           first is where layouts are saved
//                           (default ~/.aws-architecture-diagram/layouts)
//   DIAGRAM_COMPONENTS_DIR  custom components (default ~/.aws-architecture-diagram/components)
//   DIAGRAM_BUNDLE_CACHE    built pages (default ~/.cache/aws-architecture-diagram/bundles)
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import type { BundleCache, ComponentSource, LayoutStore } from "#domain/ports/index.ts";

export type LayoutEnv = Readonly<Record<string, string | undefined>>;
export interface LayoutFsOptions {
  /** Holds DIAGRAM_LAYOUTS_DIR / DIAGRAM_COMPONENTS_DIR / DIAGRAM_BUNDLE_CACHE (pass process.env in the composition root). */
  env?: LayoutEnv;
  /** Home folder of the defaults (default os.homedir()). */
  home?: string;
}

export class FsLayoutStore implements LayoutStore {
  private readonly env: LayoutEnv;
  private readonly home: string;
  constructor(options: LayoutFsOptions = {}) {
    this.env = options.env ?? {};
    this.home = options.home ?? homedir();
  }

  dirs(): string[] {
    const dirs = String(this.env.DIAGRAM_LAYOUTS_DIR || "").split(delimiter).map(s => s.trim()).filter(Boolean).map(d => resolve(d));
    if (!dirs.length) dirs.push(join(this.home, ".aws-architecture-diagram", "layouts"));
    return dirs;
  }
  list(dir: string): string[] | null {
    try { return readdirSync(dir); } catch { return null; }
  }
  join(dir: string, file: string): string {
    return join(dir, file);
  }
  dirOf(path: string): string {
    return dirname(path);
  }
  exists(path: string): boolean {
    return existsSync(path);
  }
  read(path: string): string {
    return readFileSync(path, "utf-8");
  }
  write(path: string, text: string): void {
    writeFileSync(path, text, "utf-8");
  }
  ensureDir(dir: string): void {
    mkdirSync(dir, { recursive: true });
  }
  remove(path: string): void {
    rmSync(path);
  }
}

export class FsComponentSource implements ComponentSource {
  private readonly env: LayoutEnv;
  private readonly home: string;
  constructor(options: LayoutFsOptions = {}) {
    this.env = options.env ?? {};
    this.home = options.home ?? homedir();
  }

  dir(): string {
    return this.env.DIAGRAM_COMPONENTS_DIR ? resolve(this.env.DIAGRAM_COMPONENTS_DIR) : join(this.home, ".aws-architecture-diagram", "components");
  }
  list(): string[] | null {
    try { return readdirSync(this.dir()); } catch { return null; }
  }
  path(fileName: string): string {
    return join(this.dir(), fileName);
  }
  exists(fileName: string): boolean {
    return existsSync(this.path(fileName));
  }
  read(fileName: string): string {
    return readFileSync(this.path(fileName), "utf-8");
  }
}

export class FsBundleCache implements BundleCache {
  private readonly env: LayoutEnv;
  private readonly home: string;
  constructor(options: LayoutFsOptions = {}) {
    this.env = options.env ?? {};
    this.home = options.home ?? homedir();
  }

  dir(): string {
    return this.env.DIAGRAM_BUNDLE_CACHE ? resolve(this.env.DIAGRAM_BUNDLE_CACHE) : join(this.home, ".cache", "aws-architecture-diagram", "bundles");
  }
  path(key: string): string {
    return join(this.dir(), key, "index.html");
  }
  exists(key: string): boolean {
    return existsSync(this.path(key));
  }
  read(key: string): string {
    return readFileSync(this.path(key), "utf-8");
  }
}
