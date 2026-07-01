// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Lightweight JSON tokenizer for the export panel. Returns plain tokens that the
// UI renders as React <span>s — NO dangerouslySetInnerHTML / innerHTML, so there
// is no HTML-injection surface (the panel only ever shows our own JSON payload).

export type JsonToken = { text: string; cls: "attr" | "string" | "number" | "literal" | "plain" };

// Classify JSON into tokens. Regex splits on strings / numbers / literals; a
// string immediately followed by ':' is a key (attr).
export function tokenizeJson(code: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  const re = /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) tokens.push({ text: code.slice(last, m.index), cls: "plain" });
    const val = m[0];
    if (val[0] === '"') {
      const after = code.slice(re.lastIndex).match(/^\s*:/);
      tokens.push({ text: val, cls: after ? "attr" : "string" });
    } else if (val === "true" || val === "false" || val === "null") {
      tokens.push({ text: val, cls: "literal" });
    } else {
      tokens.push({ text: val, cls: "number" });
    }
    last = re.lastIndex;
  }
  if (last < code.length) tokens.push({ text: code.slice(last), cls: "plain" });
  return tokens;
}
