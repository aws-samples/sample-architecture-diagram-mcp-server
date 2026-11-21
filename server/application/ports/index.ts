// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Driven ports of the application layer. Use cases depend on these interfaces
// only; server/adapters/outbound implements them and server/main wires them.
// Nothing here may import Node APIs.

export type WrittenMimeType = "text/html" | "application/json" | "application/xml" | "image/png" | "image/svg+xml" | "image/gif" | "application/pdf";

/** A file a use case wrote on the caller's behalf (reported back to inbound adapters). */
export interface WrittenFile {
  /** Absolute path, as resolved by the Workspace. */
  readonly path: string;
  readonly mimeType: WrittenMimeType;
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
}

export class WorkspaceAccessError extends Error {
  readonly path: string;
  readonly root: string;
  constructor(path: string, root: string) {
    super(`path ${path} is outside the allowed output directory ${root}`);
    this.name = "WorkspaceAccessError";
    this.path = path;
    this.root = root;
  }
}

/** Facts about this package (name, version, install root) — read once at startup. */
export interface PackageInfo {
  readonly name: string;
  readonly version: string;
  /** Absolute install root (where package.json, dist/ and scripts/ live). */
  readonly root: string;
}

/** Diagnostics channel. stderr in the local server — never stdout (the MCP protocol stream). */
export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string, cause?: unknown): void;
}

/** In-memory drafts of the staged builders (diagram_create → diagram_add_* → diagram_render, sequence_*, flow kinds). */
export interface SessionStore<T> {
  /** Store a new draft and return its id (`<prefix><n>`, e.g. d1, d2, …). */
  create(value: T): string;
  get(id: string): T | undefined;
  delete(id: string): void;
}

/** Rasterizes an interactive HTML diagram into a PNG figure, an animated GIF and/or an animated SVG. */
export interface Rasterizer {
  render(request: RasterizeRequest): Promise<RasterizeResult>;
}
export interface RasterizeRequest {
  /** Absolute paths (resolved by the Workspace). */
  readonly htmlPath: string;
  readonly pngPath?: string;
  readonly gifPath?: string;
  readonly svgPath?: string;
  readonly mode: "flow" | "walkthrough";
  readonly theme: "light" | "dark";
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  readonly period: number;
  readonly frames: number;
  readonly beatDuration: number;
  readonly beatFrames: number;
}
export interface RasterizeResult {
  /** The paths written (as requested). */
  readonly png?: string;
  readonly gif?: string;
  readonly svg?: string;
  readonly mode: "flow" | "walkthrough";
  /** walkthrough: the number of beats found in the page. */
  readonly beats?: number;
  readonly warnings: readonly string[];
}

/** Converts a .drawio file to PNG/SVG/PDF with the draw.io desktop application. */
export interface DrawioExporter {
  /** True when the converter is installed on this machine. */
  available(): boolean;
  /** Convert (throws on failure). Absolute paths. */
  export(request: { inputPath: string; outputPath: string; format: "png" | "svg" | "pdf"; scale: number }): void;
}

/** The AWS Architecture Icons install (shared ~/.aws-architecture-icons or AWS_DIAGRAM_ICON_ROOT). */
export interface IconInstaller {
  /** The icon root this process resolves now. */
  root(): string;
  installed(): boolean;
  /** Icon files (.png/.svg) under <root>/icons. */
  count(): number;
  /** Run the installer and return its output (throws `fetch-icons failed: …`). Absolute paths. */
  install(options: { source?: string; dest?: string }): string;
  /** Forget the resolved root and cached file list after an install. */
  refresh(): void;
}

/** Builds the standalone page with custom layout components into the bundle cache. */
export interface BundleBuilder {
  /** The default page (no custom components). */
  defaultPagePath(): string;
  /** Build `outPath` from a registration module, unless it is cached (and not forced). */
  build(request: { outPath: string; registrationModule: string; force: boolean }): Promise<BundleBuild>;
}
export interface BundleBuild {
  built: boolean;
  cached: boolean;
  path: string;
}
