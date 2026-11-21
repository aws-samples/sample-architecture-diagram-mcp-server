// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// File helpers shared by the use cases: everything goes through the Workspace,
// and every file written on the caller's behalf is reported in `written`.
import { messageOf } from "#domain/shared/paths.ts";
import type { WrittenFile, WrittenMimeType, Workspace } from "#application/ports/index.ts";

/** The MIME type of an output file, from its extension. */
export function mimeTypeOf(path: string): WrittenMimeType {
  const p = path.toLowerCase();
  if (p.endsWith(".html") || p.endsWith(".htm")) return "text/html";
  if (p.endsWith(".drawio") || p.endsWith(".xml")) return "application/xml";
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".svg")) return "image/svg+xml";
  if (p.endsWith(".gif")) return "image/gif";
  if (p.endsWith(".pdf")) return "application/pdf";
  return "application/json";
}

/** Collects the files a use case writes. */
export class WrittenFiles {
  readonly list: WrittenFile[] = [];
  private readonly ws: Workspace;
  constructor(ws: Workspace) { this.ws = ws; }

  /** Write a text file at a caller-supplied path (resolved by the Workspace). Returns the absolute path. */
  text(path: string, text: string, baseDir?: string): string {
    const abs = this.ws.resolve(path, baseDir);
    this.ws.writeText(abs, text);
    this.add(abs);
    return abs;
  }

  /** Record a file another component wrote (an absolute, already resolved path). */
  add(abs: string): void {
    if (!this.list.some(f => f.path === abs)) this.list.push({ path: abs, mimeType: mimeTypeOf(abs) });
  }
}

/** Read and parse a JSON file, naming the file when it is missing or invalid. */
export function readJsonFile(ws: Workspace, path: string): unknown {
  const abs = ws.resolve(path);
  if (!ws.exists(abs)) throw new Error(`${path}: file not found`);
  try { return JSON.parse(ws.readText(abs)); }
  catch (e) { throw new Error(`${path}: invalid JSON — ${messageOf(e)}`); }
}
