// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// JSON syntax highlighting for the export panel. Self-contained for file://.
import hljs from "highlight.js/lib/core";
import json from "highlight.js/lib/languages/json";

let registered = false;
function ensureRegistered() {
  if (registered) return;
  hljs.registerLanguage("json", json);
  registered = true;
}

export function highlightJson(code: string): string {
  ensureRegistered();
  try {
    return hljs.highlight(code, { language: "json" }).value;
  } catch {
    return code.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
  }
}
