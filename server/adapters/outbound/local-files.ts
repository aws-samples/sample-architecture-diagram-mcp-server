// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// LocalFileReader over the local disk (layout theme CSS and branding images).
import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type { LocalFileReader } from "#domain/ports/index.ts";

export class NodeLocalFileReader implements LocalFileReader {
  /** `cwd`: what relative paths resolve from when no baseDir is given (default process.cwd() at call time). */
  private readonly cwd: string | undefined;
  constructor(cwd?: string) { this.cwd = cwd; }

  resolve(path: string, baseDir?: string): string {
    return isAbsolute(path) ? path : resolve(baseDir ?? this.cwd ?? process.cwd(), path);
  }
  isFile(path: string): boolean {
    return existsSync(path) && statSync(path).isFile();
  }
  readText(path: string): string {
    return readFileSync(path, "utf-8");
  }
  readBytes(path: string): Uint8Array {
    return readFileSync(path);
  }
}
