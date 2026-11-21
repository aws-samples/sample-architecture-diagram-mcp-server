// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Driven ports of the application layer. Use cases depend on these interfaces
// only; server/adapters/outbound implements them and server/main wires them.
// Nothing here may import Node APIs.

/** A file a use case wrote on the caller's behalf (reported back to inbound adapters). */
export interface WrittenFile {
  /** Absolute path, as resolved by the Workspace. */
  readonly path: string;
  readonly mimeType: "text/html" | "application/json" | "application/xml" | "image/png" | "image/svg+xml" | "image/gif" | "application/pdf";
}

/**
 * Every file read or written on the caller's behalf (output paths, diagram
 * inputs, spec-relative assets). Local compositions allow any path; the HTTP
 * composition confines all access to one root directory and rejects the rest
 * with WorkspaceAccessError.
 */
export interface Workspace {
  /** Resolve a caller-supplied path (relative to `baseDir`, else the workspace root) and enforce the access policy. */
  resolve(path: string, baseDir?: string): string;
  exists(path: string): boolean;
  isFile(path: string): boolean;
  size(path: string): number;
  readText(path: string): string;
  readBytes(path: string): Uint8Array;
  /** Write a text file, creating parent directories. */
  writeText(path: string, text: string): void;
  writeBytes(path: string, bytes: Uint8Array): void;
  remove(path: string): void;
  dirname(path: string): string;
  join(...parts: string[]): string;
  /** A fresh scratch directory inside the policy (removed with `remove`). */
  tempDir(prefix: string): string;
}

export class WorkspaceAccessError extends Error {
  constructor(readonly path: string, readonly root: string) {
    super(`path ${path} is outside the allowed output directory ${root}`);
    this.name = "WorkspaceAccessError";
  }
}

/** Facts about this package (name, version, install root) — read once at startup. */
export interface PackageInfo {
  readonly name: string;
  readonly version: string;
  /** Absolute install root (where package.json, dist/ and scripts/ live). */
  readonly root: string;
}

/** Diagnostics channel. stderr in the stdio server — never stdout (the MCP protocol stream). */
export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string, cause?: unknown): void;
}

/** In-memory drafts of the staged builders (diagram_create → diagram_add_* → diagram_render, sequence_*, flow kinds). */
export interface SessionStore<T> {
  create(value: T): string;
  get(id: string): T | undefined;
  set(id: string, value: T): void;
  delete(id: string): void;
}

/** Rasterizes an interactive HTML diagram (headless Chromium + ffmpeg). */
export interface Rasterizer {
  render(request: RasterizeRequest): Promise<RasterizeResult>;
}
export interface RasterizeRequest {
  readonly htmlPath: string;
  readonly pngPath?: string;
  readonly gifPath?: string;
  readonly svgPath?: string;
  readonly mode?: "flow" | "walkthrough";
  readonly options: Readonly<Record<string, unknown>>;
}
export interface RasterizeResult {
  readonly written: readonly WrittenFile[];
  readonly notes: readonly string[];
}

/** Converts a .drawio file with the draw.io desktop CLI. */
export interface DrawioExporter {
  /** Absolute path of the draw.io CLI, or null when it is not installed. */
  locate(): string | null;
  export(request: { inputPath: string; outputPath: string; format: "png" | "svg" | "pdf"; scale?: number; border?: number; transparent?: boolean }): void;
}

/** The AWS Architecture Icons install (shared ~/.aws-architecture-icons or AWS_DIAGRAM_ICON_ROOT). */
export interface IconInstaller {
  root(): string;
  installed(): boolean;
  count(): number;
  /** Run the installer (scripts/fetch-icons.sh) and return its output. */
  install(options: { zipPath?: string; latest?: boolean; force?: boolean }): string;
  /** Forget cached lookups after an install. */
  refresh(): void;
}

/** Builds the standalone page bundle with custom layout components (vite). */
export interface BundleBuilder {
  build(request: { key: string; registrationModule: string; force: boolean }): Promise<{ built: boolean; cached: boolean; path: string }>;
  cachedPath(key: string): string | null;
}
