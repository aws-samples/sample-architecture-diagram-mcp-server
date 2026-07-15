// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Content language resolver. An author value is a plain string OR a per-language
// map, e.g. { en: "Overview", pt: "Visão geral" }.

/** Resolve an author value that may be a plain string or a per-language map.
 *  Fallback order: lang → `fallback` (default "en") → first available value → "".
 */
export function tr(val, lang, fallback = "en") {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") return val[lang] ?? val[fallback] ?? Object.values(val)[0] ?? "";
  return String(val);
}

/** Back-compat alias for the slides `i18n(val, lang)` call site: same intent,
 *  with the historical en→pt fallback chain. Prefer `tr` in new code. */
export const i18n = (val, lang) => {
  if (val == null) return "";
  if (typeof val === "string") return val;
  return val[lang] || val.en || val.pt || "";
};
