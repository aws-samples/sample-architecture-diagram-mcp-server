// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Ports of the DOMAIN: the few things the pure renderers need from outside
// (page templates, icon files, local layout assets, saved layouts, custom
// components, the bundle cache, a hash). server/adapters/outbound implements
// them with Node; tests and other hosts may pass in-memory fakes. Nothing here
// may import Node APIs.
//
// ── Deps style (one rule for the whole domain) ──
// A domain module that needs the outside world exports a FACTORY,
// `create<Thing>(deps)`, taking the ports below and returning plain functions
// bound to them:
//
//   createIconResolver({ icons })                         → iconForService, toDataUri, inlineIconRefs, iconResolutionReport
//   createHtmlRenderer({ templates, icons, diagnostics }) → generateHtml, diagramParts, resolveTabs, …
//   createFlowRenderer / createSequenceRenderer           → generateFlowHtml / generateSequenceHtml (+ reports)
//   createValidator({ icons })                            → validateDiagram
//   createLayouts({ … })                                  → resolveLayout, listLayouts, saveLayout, … (catalog + saved layouts)
//   createSpecRenderer({ …all of the above })             → parseSpec, prepareSpec, finishSpec, renderSpec, portableSpec
//
// Everything that is pure (schemas, computeLayout, generateDrawio, computeDelta,
// contrast, themeCss, layoutPayload, layoutWarnings, registrationModule,
// diagramElementsJson, sidecarJson, specJson, the formatters) is a plain
// module-level export with no deps. No module reads a file, the clock, the
// environment or the console at import time; ports are only called when a
// returned function runs.

/** The page templates the renderers fill. Read when called, so a rebuilt page is picked up. */
export interface TemplateSource {
  /** The standalone interactive page (<package>/dist/index.html, with {{ARCH_DATA}} / {{ICON_DATA}}). */
  standalonePage(): string;
  /** The self-contained flow player (workflow / dataflow / lifecycle). */
  flowTemplate(): string;
  /** The self-contained UML sequence player. */
  sequenceTemplate(): string;
  /** A core module compiled to a classic-script body (its `export` keywords dropped), inlined by the players. */
  inlineScript(name: InlineScriptName): string;
}
export type InlineScriptName = "flowLayout" | "sequenceLayout" | "codeBlocks";

/** The AWS Architecture Icons on this machine (<icon root>/{icons,aws-icons,tech-icons}). */
export interface IconSource {
  /**
   * File names under <icon root>/icons ([] when the icons are not installed).
   * Returns the SAME array instance until the icon root changes: the core's
   * fuzzy index is cached per array.
   */
  iconFiles(): readonly string[];
  /**
   * An icon reference as a base64 data: URI, or null when there is no such file.
   * A bare name ("Arch_X_48.png") lives under icons/; a ref with a slash
   * ("aws-icons/user.svg", "tech-icons/x.svg") is relative to the icon root.
   */
  dataUri(ref: string): string | null;
}

/** Non-fatal notes the renderers emit (icons not found). stderr in the stdio server. */
export interface Diagnostics {
  warn(message: string): void;
}

/** Local files a layout references (theme CSS, branding images), by path. */
export interface LocalFileReader {
  /** Absolute path of `path`: as-is when absolute, else relative to `baseDir` (default: the process's working directory). */
  resolve(path: string, baseDir?: string): string;
  /** True when `path` exists and is a regular file. */
  isFile(path: string): boolean;
  /** UTF-8 text of a file (throws when unreadable). */
  readText(path: string): string;
  /** Bytes of a file (throws when unreadable). */
  readBytes(path: string): Uint8Array;
}

/** Saved layouts: the folders of DIAGRAM_LAYOUTS_DIR (or ~/.aws-architecture-diagram/layouts). */
export interface LayoutStore {
  /** Search folders, in search order (never empty). The first one is where new layouts are saved. */
  dirs(): string[];
  /** File names in a folder, or null when it cannot be read. */
  list(dir: string): string[] | null;
  /** Path of `file` inside `dir`. */
  join(dir: string, file: string): string;
  /** Folder of a layout file (relative layout assets resolve from it). */
  dirOf(path: string): string;
  exists(path: string): boolean;
  /** UTF-8 text of a file (throws when unreadable). */
  read(path: string): string;
  write(path: string, text: string): void;
  /** Create a folder (and its parents) when missing. */
  ensureDir(dir: string): void;
  remove(path: string): void;
}

/** Custom layout components: <name>.component.json + its source file in DIAGRAM_COMPONENTS_DIR (or ~/.aws-architecture-diagram/components). */
export interface ComponentSource {
  /** The components folder. */
  dir(): string;
  /** File names in the components folder, or null when it cannot be read. */
  list(): string[] | null;
  /** Absolute path of a file of the components folder. */
  path(fileName: string): string;
  /** True when a file of the components folder exists. */
  exists(fileName: string): boolean;
  /** UTF-8 text of a file of the components folder (throws when unreadable). */
  read(fileName: string): string;
}

/** Built pages that bundle custom components, cached by bundle key (DIAGRAM_BUNDLE_CACHE or ~/.cache/aws-architecture-diagram/bundles). */
export interface BundleCache {
  /** The cache folder. */
  dir(): string;
  /** <cache>/<key>/index.html. */
  path(key: string): string;
  exists(key: string): boolean;
  read(key: string): string;
}

/** SHA-256 of a string (its UTF-8 bytes) or of bytes, as lowercase hex. */
export interface Hasher {
  sha256Hex(data: string | Uint8Array): string;
}
