// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Icon resolution shared by the MCP and every renderer (pure — no fs).
//   iconForService(name, files?)  service display name → icon file:
//       1. exact SERVICE_ICONS hit   2. Amazon/AWS-prefix-insensitive hit
//       3. fuzzy match against `files` (the icon file names the host can serve):
//          every token of an icon's core name must be in the query, most
//          specific wins — so free text ("Frontend Next.js (ECS Fargate)")
//          resolves without ever picking a wrong-but-plausible icon.
//   iconForShape(shape)           AWS4 shape → icon file.
//   withServiceIcon(x, key)       { …x, icon } filled from x[key] when x has no icon.
//   iconFilterKind(ref)           'mono' for line-art that a dark theme recolors
//                                 with a CSS filter, else 'none'.
import { SERVICE_ICONS, SHAPE_ICONS } from "./serviceIcons.js";
import { DARK_VARIANT_BASES } from "./darkVariants.js";

export { SERVICE_ICONS, SHAPE_ICONS, DARK_VARIANT_BASES };

// Normalize a name (service or icon filename core) to comparison tokens. Strips
// the Amazon/AWS vendor prefix, the Arch_/Res_/Arch-Category_ icon prefix, the
// theme suffix (before the size one: "Res_Users_48_Light.png" is the generic
// people icon), the _48/_32 size suffix and the extension.
export function normTokens(s) {
  return String(s)
    .replace(/\.(png|svg)$/i, "")
    .replace(/^(Arch|Res|Arch-Category)[_-]/i, "")
    .replace(/_(light|dark)$/i, "")
    .replace(/_(48|32|16|64)$/i, "")
    .replace(/\b(amazon|aws)\b/gi, " ")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(t => t.length > 1);
}

// Fuzzy index per file list (keyed by the array, so a host that refreshes its
// list — icons fetched mid-session — gets a fresh index).
const INDEX = new WeakMap();
function fuzzyIndex(files) {
  let idx = INDEX.get(files);
  if (idx) return idx;
  idx = [];
  for (const f of files) {
    if (!/\.(png|svg)$/i.test(f) || /^Arch-Category[_-]/i.test(f)) continue; // never a generic category tile
    const toks = normTokens(f);
    if (toks.length) idx.push({ file: f, toks, key: toks.join(" ") });
  }
  INDEX.set(files, idx);
  return idx;
}

const bareName = (s) => s.replace(/^(Amazon|AWS)\s+/i, "").toLowerCase();
const BARE = new Map();
for (const [svc, file] of Object.entries(SERVICE_ICONS)) if (!BARE.has(bareName(svc))) BARE.set(bareName(svc), file); // first wins

export function iconForService(name, files) {
  if (name && typeof name === "object") name = name.en || name.pt || name.es || Object.values(name)[0];
  if (!name || typeof name !== "string") return null;
  if (SERVICE_ICONS[name]) return SERVICE_ICONS[name];
  const hit = BARE.get(bareName(name));
  if (hit) return hit;
  if (!files) return null;
  const q = new Set(normTokens(name));
  if (!q.size) return null;
  let best = null;
  for (const ent of fuzzyIndex(files)) {
    if (ent.toks.length > q.size || !ent.toks.every(t => q.has(t))) continue;
    const score = ent.toks.length;
    if (!best || score > best.score || (score === best.score && ent.key.length < best.key.length)) best = { file: ent.file, score, key: ent.key };
  }
  return best ? best.file : null;
}

export function iconForShape(shape) {
  if (!shape) return null;
  return SHAPE_ICONS[String(shape).toLowerCase()] || null;
}

export function withServiceIcon(x, key = "service", files) {
  if (!x || x.icon || !x[key]) return x;
  const icon = iconForService(x[key], files);
  return icon ? { ...x, icon } : x;
}

// Navy Res_ glyphs whose *_Dark sibling is a DIFFERENT drawing (Res_User_48:
// one person vs two) are recolored by filter instead of swapped.
export const MONO_INVERT_RES = new Set(["Res_User_48"]);

export function iconFilterKind(ref) {
  if (!ref) return "none";
  const base = ref.endsWith(".png") ? ref.slice(0, -4) : ref;
  return ref.startsWith("aws-icons/") || MONO_INVERT_RES.has(base) ? "mono" : "none";
}
