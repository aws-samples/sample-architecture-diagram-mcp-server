// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// The Workspace port over the local disk.
//   * LocalWorkspace — any path; relative paths resolve from the working
//     directory (the stdio server and the CLI: the caller IS the local user).
//   * SandboxedWorkspace — every path confined to ONE root (MCP_OUTPUT_DIR in
//     the streamable-HTTP server). Relative paths resolve under the root;
//     absolute paths outside it, `..` that climbs out of it and symlinks whose
//     target leaves it (realpath of the nearest existing ancestor) are rejected
//     with WorkspaceAccessError — on reads as well as writes.
//   * ConfinedFileReader — the domain's LocalFileReader (layout CSS / images,
//     custom component files) for the sandboxed composition: the sandbox root
//     plus the server's own configuration folders (saved layouts, components,
//     bundle cache), which the operator owns.
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { WorkspaceAccessError } from "#application/ports/index.ts";
import type { Workspace } from "#application/ports/index.ts";
import type { LocalFileReader } from "#domain/ports/index.ts";

abstract class FsWorkspace implements Workspace {
  abstract resolve(path: string, baseDir?: string): string;
  /** Enforce the access policy on an absolute path (no-op locally). */
  protected abstract guard(path: string): string;

  exists(path: string): boolean { return existsSync(this.guard(path)); }
  isFile(path: string): boolean { const p = this.guard(path); return existsSync(p) && statSync(p).isFile(); }
  size(path: string): number { return statSync(this.guard(path)).size; }
  readText(path: string): string { return readFileSync(this.guard(path), "utf-8"); }
  readBytes(path: string): Uint8Array { return readFileSync(this.guard(path)); }
  writeText(path: string, text: string): void {
    const p = this.guard(path);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text, "utf-8");
  }
  writeBytes(path: string, bytes: Uint8Array): void {
    const p = this.guard(path);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, bytes);
  }
  remove(path: string): void { rmSync(this.guard(path), { recursive: true, force: true }); }
  dirname(path: string): string { return dirname(path); }
  join(...parts: string[]): string { return join(...parts); }
}

/** Unrestricted local disk. `cwd`: what relative paths resolve from (default process.cwd() at call time). */
export class LocalWorkspace extends FsWorkspace {
  private readonly cwd: string | undefined;
  constructor(cwd?: string) { super(); this.cwd = cwd; }
  resolve(path: string, baseDir?: string): string {
    return isAbsolute(path) ? path : resolve(baseDir ?? this.cwd ?? process.cwd(), path);
  }
  protected guard(path: string): string { return path; }
}

const within = (root: string, p: string): boolean => p === root || p.startsWith(root.endsWith(sep) ? root : root + sep);

/** The real path of `p`, from its nearest existing ancestor (null when a dangling symlink is on the way). */
function realOfNearest(p: string): string | null {
  let cur = p;
  const rest: string[] = [];
  for (;;) {
    let exists = false;
    try { lstatSync(cur); exists = true; } catch { /* not there yet */ }
    if (exists) {
      try { return join(realpathSync(cur), ...rest); } catch { return null; } // dangling symlink
    }
    const up = dirname(cur);
    if (up === cur) return join(cur, ...rest);
    rest.unshift(cur.slice(up.length).replace(/^[\\/]+/, ""));
    cur = up;
  }
}

/** Every path confined to `root` (created when missing). */
export class SandboxedWorkspace extends FsWorkspace {
  readonly root: string;
  private readonly realRoot: string;
  constructor(root: string) {
    super();
    this.root = resolve(root);
    mkdirSync(this.root, { recursive: true });
    this.realRoot = realpathSync(this.root);
  }
  /** True when `abs` (absolute) stays inside the root, symlinks included. */
  allows(abs: string): boolean {
    if (!within(this.root, abs) && !within(this.realRoot, abs)) return false;
    const real = realOfNearest(abs);
    return real !== null && within(this.realRoot, real);
  }
  resolve(path: string, baseDir?: string): string {
    const base = baseDir === undefined ? this.root : this.guard(resolve(this.root, baseDir));
    const abs = resolve(base, path);
    if (!this.allows(abs)) throw new WorkspaceAccessError(path, this.root);
    return abs;
  }
  protected guard(path: string): string {
    const abs = resolve(this.root, path);
    if (!this.allows(abs)) throw new WorkspaceAccessError(path, this.root);
    return abs;
  }
}

/** The domain's local-file reader confined to a sandbox (plus the server's own config folders). */
export class ConfinedFileReader implements LocalFileReader {
  private readonly ws: SandboxedWorkspace;
  private readonly trusted: () => readonly string[];
  constructor(ws: SandboxedWorkspace, trustedRoots: () => readonly string[] = () => []) {
    this.ws = ws;
    this.trusted = trustedRoots;
  }
  private isTrusted(abs: string): boolean {
    const real = realOfNearest(abs);
    return real !== null && this.trusted().some(t => {
      const root = resolve(t);
      const realRoot = realOfNearest(root) ?? root;
      return within(root, abs) && within(realRoot, real);
    });
  }
  private guard(path: string): string {
    const abs = resolve(this.ws.root, path);
    if (this.isTrusted(abs) || this.ws.allows(abs)) return abs;
    throw new WorkspaceAccessError(path, this.ws.root);
  }
  resolve(path: string, baseDir?: string): string {
    const abs = resolve(baseDir === undefined ? this.ws.root : resolve(this.ws.root, baseDir), path);
    if (this.isTrusted(abs)) return abs;
    return this.ws.resolve(abs);
  }
  isFile(path: string): boolean { const p = this.guard(path); return existsSync(p) && statSync(p).isFile(); }
  readText(path: string): string { return readFileSync(this.guard(path), "utf-8"); }
  readBytes(path: string): Uint8Array { return readFileSync(this.guard(path)); }
}
