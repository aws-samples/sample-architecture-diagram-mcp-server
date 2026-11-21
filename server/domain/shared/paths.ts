// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The two path facts the domain reads from a file path it was handed (error
// messages and MIME lookup), with Node's path.basename / path.extname
// semantics. Both separators are accepted so a Windows path reads the same.

/** Last path segment (trailing separators ignored). */
export function baseName(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  const i = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return i >= 0 ? trimmed.slice(i + 1) : trimmed;
}

/** Extension of the last segment including the dot ("" for none or a dotfile such as ".env"). */
export function extName(path: string): string {
  const b = baseName(path);
  const dot = b.lastIndexOf(".");
  return dot > 0 ? b.slice(dot) : "";
}

/** Error message of a caught value (what `e.message` reads for an Error). */
export function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String((e as { message?: unknown } | null)?.message ?? e);
}
