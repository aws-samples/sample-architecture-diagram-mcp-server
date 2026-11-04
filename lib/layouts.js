// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Composable page: a component CATALOG and LAYOUTS that mount its components.
//
// The interactive page has slots — dock, stepCard, nodeModal, header — and the
// core renders each slot from a list of component entries (see the core's
// ZoomBar / StepCard / NodeModal / LiveDiagram). A layout says which components
// go in each slot, in order, with which props, plus a theme and branding.
// Presets (`default`, `cost`) are just layouts; `default` is exactly what the
// page did before layouts existed, and a spec without `layout` embeds nothing.
//
// Built-in components ship in the default page, so a layout that uses only them
// needs no build. Custom components (a .jsx + .component.json in
// DIAGRAM_COMPONENTS_DIR or ~/.aws-architecture-diagram/components) need a page
// that bundles them: buildBundle runs Vite on the standalone sources and caches
// the result by a hash of the components + base page + package version.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync, rmSync } from "fs";
import { assertLocalCss, remoteLoads } from "./self-contained.js";
import { fileURLToPath } from "url";
import { dirname, join, resolve, delimiter, extname, basename, isAbsolute } from "path";
import { homedir } from "os";
import { createHash } from "crypto";
import { createRequire } from "node:module";
import { z } from "zod";
import { SLOTS, layoutSchema, layoutRefSchema, layoutName, componentId, propsSchema, THEME_TOKENS } from "./layout-schemas.js";
import { APP_COMPONENT_PROPS, APP_COMPONENT_DESCRIPTIONS } from "./app-schemas.js";
import { ODB_APP_PRESET } from "./app-presets.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const PKG_VERSION = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf-8")).version;
export const DEFAULT_PAGE = join(PKG_ROOT, "dist", "index.html");

// ── Component catalog ────────────────────────────────────────────────────────

const langText = z.union([z.string(), z.record(z.string(), z.string())]);
const none = z.object({}).strict();

// Built-in components, per slot, in the slot's default order (kept equal to the
// core's DOCK_ITEMS / STEP_CARD_PARTS / NODE_MODAL_SECTIONS — tested).
export const BUILTIN_COMPONENTS = [
  { id: "dock.brand", slot: "dock", description: "Brand mark: the layout's branding logo and/or name. Renders nothing without branding.", props: none, renders: [] },
  { id: "dock.title", slot: "dock", description: "Diagram title and subtitle (hidden when the spec sets showTitle: false).", props: z.object({ width: z.number().int().min(120).max(600).optional().describe("Column width in px (default 300).") }).strict(), renders: ["title"] },
  { id: "dock.zoom", slot: "dock", description: "Zoom out, fit and zoom in buttons.", props: none, renders: [] },
  { id: "dock.png", slot: "dock", description: "Download the canvas as PNG.", props: none, renders: [] },
  { id: "dock.shareCard", slot: "dock", description: "Download a 1200×630 share card (canvas + title).", props: none, renders: [] },
  { id: "dock.walkthrough", slot: "dock", description: "Walkthrough restart and play/pause (only when the spec has steps).", props: none, renders: ["steps"] },
  { id: "dock.cost", slot: "dock", description: "Cost estimate link button (only when the spec has costUrl, or a step has one). A link — nothing is priced.", props: z.object({ label: langText.optional().describe("Button label when the spec sets no costLabel.") }).strict(), renders: ["costUrl"] },
  { id: "dock.language", slot: "dock", description: "Language menu (only when the spec offers more than one language).", props: none, renders: ["languages"] },
  { id: "dock.theme", slot: "dock", description: "Light/dark switch.", props: none, renders: [] },
  { id: "stepCard.title", slot: "stepCard", description: "Step icon and title.", props: none, renders: [] },
  { id: "stepCard.body", slot: "stepCard", description: "Step body paragraph (inline markdown).", props: none, renders: [] },
  { id: "stepCard.bullets", slot: "stepCard", description: "Step bullet list.", props: none, renders: [] },
  { id: "stepCard.process", slot: "stepCard", description: "Numbered process list.", props: none, renders: [] },
  { id: "stepCard.code", slot: "stepCard", description: "Code: one block (code + codeLabel) or several collapsible blocks (codeBlocks, or codeSplit: \"markers\") with per-block header, copy and chevron, expand/collapse all and 'Show more'.", props: z.object({
    defaultCollapsed: z.enum(["rest", "all", "none"]).optional().describe("Which blocks start collapsed when a block does not say: rest (default — first open), all, none."),
    maxLines: z.number().int().min(3).max(500).optional().describe("Lines shown before 'Show more' (default 20)."),
    showCopy: z.boolean().optional().describe("Per-block copy button (default true)."),
    showLang: z.boolean().optional().describe("Language tag on each block header (default true)."),
  }).strict(), renders: [] },
  { id: "stepCard.sections", slot: "stepCard", description: "Documentation sections.", props: none, renders: [] },
  { id: "stepCard.chips", slot: "stepCard", description: "Status chips.", props: none, renders: [] },
  { id: "stepCard.costPill", slot: "stepCard", description: "Cost estimate link pill for a step with costUrl.", props: z.object({ label: langText.optional().describe("Pill label when the step sets no costLabel.") }).strict(), renders: ["stepCostUrl"] },
  { id: "nodeModal.role", slot: "nodeModal", description: "The node's role paragraph.", props: none, renders: [] },
  { id: "nodeModal.iac", slot: "nodeModal", description: "config.iac rows.", props: z.object({ title: z.string().max(80).optional() }).strict(), renders: [] },
  { id: "nodeModal.pricing", slot: "nodeModal", description: "config.pricing rows.", props: z.object({ title: z.string().max(80).optional() }).strict(), renders: [] },
  { id: "header.caption", slot: "header", description: "Caption band above the canvas (spec.caption).", props: none, renders: ["caption"] },
  // App shell (layout shell "app"): sidebar parts and page parts. They are not
  // document slots; a layout places them in app.sidebar / app.pages[].components.
  ...Object.keys(APP_COMPONENT_PROPS).map(id => ({ id, slot: id.split(".")[0], description: APP_COMPONENT_DESCRIPTIONS[id], props: APP_COMPONENT_PROPS[id], renders: id === "page.architecture" ? ["services"] : [], shell: "app" })),
].map(c => ({ ...c, builtin: true, version: PKG_VERSION }));

/** Slots of the app shell (components live in layout.app, not in layout.slots). */
export const APP_SLOTS = ["sidebar", "page"];

export const SLOT_DEFAULTS = Object.fromEntries(SLOTS.map(s => [s, BUILTIN_COMPONENTS.filter(c => c.slot === s).map(c => c.id)]));
// The node modal is off in the default page; a layout turns it on by listing sections.
SLOT_DEFAULTS.nodeModal = [];

export function componentsDir(env = process.env) {
  return env.DIAGRAM_COMPONENTS_DIR ? resolve(env.DIAGRAM_COMPONENTS_DIR) : join(homedir(), ".aws-architecture-diagram", "components");
}

export const customComponentManifestSchema = z.object({
  id: componentId,
  slot: z.enum(SLOTS),
  file: z.string().regex(/^[\w.-]+\.(jsx|tsx|js)$/, "a .jsx/.tsx/.js file next to the manifest"),
  description: z.string().max(500).optional(),
  version: z.string().default("0.1.0"),
  props: z.record(z.string(), z.unknown()).optional().describe("JSON Schema of the props (object)."),
}).strict();

/** Custom components found on disk: { ok: [...entries], errors: [...] }. */
export function customComponents(env = process.env) {
  const dir = componentsDir(env);
  const ok = [];
  const errors = [];
  let files = [];
  try { files = readdirSync(dir).filter(f => f.endsWith(".component.json")).sort(); } catch { return { ok, errors }; }
  for (const f of files) {
    try {
      const m = customComponentManifestSchema.parse(JSON.parse(readFileSync(join(dir, f), "utf-8")));
      if (BUILTIN_COMPONENTS.some(b => b.id === m.id)) throw new Error(`id ${m.id} is a built-in component`);
      const file = join(dir, m.file);
      if (!existsSync(file)) throw new Error(`${m.file} not found`);
      const props = m.props ? z.fromJSONSchema(m.props) : z.object({}).passthrough();
      ok.push({ id: m.id, slot: m.slot, description: m.description || "", version: m.version, props, propsJsonSchema: m.props || { type: "object" }, builtin: false, file, manifestPath: join(dir, f), renders: [] });
    } catch (e) {
      errors.push(`${f}: ${e.message}`);
    }
  }
  return { ok, errors };
}

/** The full catalog: built-ins + custom components. */
export function listComponents(env = process.env) {
  return [...BUILTIN_COMPONENTS, ...customComponents(env).ok];
}

export function describeComponent(id, env = process.env) {
  const c = listComponents(env).find(x => x.id === id);
  if (!c) throw new Error(`Unknown component "${id}". See list_components.`);
  return {
    id: c.id, slot: c.slot, builtin: c.builtin, version: c.version, description: c.description,
    props: c.builtin ? z.toJSONSchema(c.props) : c.propsJsonSchema,
    ...(c.builtin ? {} : { file: c.file }),
  };
}

// ── Presets and saved layouts ────────────────────────────────────────────────

export const PRESETS = {
  default: { name: "default", description: "The standard page: every built-in component in its usual place; node modal off." },
  cost: {
    name: "cost", extends: "default",
    description: "default with the cost estimate up front: the dock's cost button right after the title, the step card's cost pill right after the title, and the node modal on (role, IaC, cost/sizing rows on click).",
    slots: { nodeModal: ["nodeModal.role", "nodeModal.iac", "nodeModal.pricing"] },
    patch: [
      { op: "move", slot: "dock", component: "dock.cost", after: "dock.title" },
      { op: "move", slot: "stepCard", component: "stepCard.costPill", after: "stepCard.title" },
    ],
  },  "odb-app": ODB_APP_PRESET,
};

export function layoutsDir(env = process.env) {
  const first = String(env.DIAGRAM_LAYOUTS_DIR || "").split(delimiter).map(s => s.trim()).find(Boolean);
  return first ? resolve(first) : join(homedir(), ".aws-architecture-diagram", "layouts");
}

function layoutDirs(env) {
  const dirs = String(env.DIAGRAM_LAYOUTS_DIR || "").split(delimiter).map(s => s.trim()).filter(Boolean).map(d => resolve(d));
  if (!dirs.length) dirs.push(layoutsDir(env));
  return dirs;
}

function savedLayoutPath(name, env) {
  for (const d of layoutDirs(env)) {
    const p = join(d, `${name}.json`);
    if (existsSync(p)) return p;
  }
  return null;
}

export function listLayouts(env = process.env) {
  const out = Object.values(PRESETS).map(p => ({ name: p.name, preset: true, extends: p.extends || null, description: p.description }));
  for (const d of layoutDirs(env)) {
    let files = [];
    try { files = readdirSync(d).filter(f => f.endsWith(".json")).sort(); } catch { continue; }
    for (const f of files) {
      const name = basename(f, ".json");
      if (out.some(o => o.name === name)) continue;
      try {
        const l = layoutSchema.parse(JSON.parse(readFileSync(join(d, f), "utf-8")));
        out.push({ name, preset: false, extends: l.extends || "default", description: l.description || "", path: join(d, f) });
      } catch (e) {
        out.push({ name, preset: false, path: join(d, f), error: `invalid layout: ${e.message}` });
      }
    }
  }
  return out;
}

function loadNamed(name, env) {
  if (PRESETS[name]) return { layout: PRESETS[name], baseDir: PKG_ROOT, source: `preset:${name}` };
  const p = savedLayoutPath(name, env);
  if (!p) throw new Error(`Unknown layout "${name}". Available: ${listLayouts(env).filter(l => !l.error).map(l => l.name).join(", ")}.`);
  const parsed = layoutSchema.safeParse(JSON.parse(readFileSync(p, "utf-8")));
  if (!parsed.success) throw new Error(`Layout "${name}" (${p}): ${formatIssues(parsed.error)}`);
  return { layout: parsed.data, baseDir: dirname(p), source: p };
}

const formatIssues = (err) => err.issues.map(i => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");

// ── Resolution ───────────────────────────────────────────────────────────────

const entryOf = (e) => (typeof e === "string" ? { component: e, props: {} } : { component: e.component, props: e.props || {} });

function place(list, entry, op, where) {
  const at = op.index != null ? Math.min(op.index, list.length)
    : op.before ? list.findIndex(e => e.component === op.before)
    : op.after ? list.findIndex(e => e.component === op.after) + 1
    : list.length;
  if ((op.before || op.after) && at < (op.after ? 1 : 0)) throw new Error(`${where}: ${op.before || op.after} is not in slot ${op.slot}`);
  list.splice(at, 0, entry);
}

function applyPatch(slots, patch, where) {
  for (const [i, op] of (patch || []).entries()) {
    const w = `${where} patch[${i}] (${op.op} ${op.component})`;
    const list = slots[op.slot];
    const idx = list.findIndex(e => e.component === op.component);
    if (op.op === "add") {
      if (idx >= 0) throw new Error(`${w}: already in slot ${op.slot}`);
      place(list, { component: op.component, props: op.props || {} }, op, w);
      continue;
    }
    if (idx < 0) throw new Error(`${w}: not in slot ${op.slot}`);
    if (op.op === "remove") list.splice(idx, 1);
    else if (op.op === "move") { const [e] = list.splice(idx, 1); place(list, e, op, w); }
    else if (op.op === "replace") list.splice(idx, 1, { component: op.with, props: op.props || {} });
    else if (op.op === "props") list[idx] = { ...list[idx], props: { ...list[idx].props, ...op.props } };
  }
}

/**
 * Resolve a layout reference (name or inline object) through its `extends`
 * chain into { name, chain, slots, theme, branding, baseDir per asset }.
 * `baseDir` resolves relative asset paths of an INLINE layout (the spec's folder).
 */
export function resolveLayout(ref, { env = process.env, baseDir = process.cwd() } = {}) {
  const parsedRef = layoutRefSchema.safeParse(ref);
  if (!parsedRef.success) throw new Error(`Invalid layout: ${formatIssues(parsedRef.error)}`);
  const chain = [];
  const seen = new Set();
  let cur = typeof ref === "string" ? loadNamed(ref, env) : { layout: parsedRef.data, baseDir, source: "inline" };
  for (;;) {
    const key = cur.layout.name || cur.source;
    if (seen.has(key)) throw new Error(`Layout extends cycle: ${[...chain.map(c => c.layout.name || c.source), key].join(" → ")}`);
    seen.add(key);
    chain.push(cur);
    if (cur.layout.name === "default" && cur.source === "preset:default") break;
    if (chain.length > 16) throw new Error("Layout extends chain too deep.");
    cur = loadNamed(cur.layout.extends || "default", env);
  }
  const slots = Object.fromEntries(SLOTS.map(s => [s, SLOT_DEFAULTS[s].map(id => ({ component: id, props: {} }))]));
  const theme = { light: {}, dark: {}, fontFamily: undefined, css: [] };
  const branding = {};
  let shell = "document";
  let app;
  for (const c of [...chain].reverse()) {
    const l = c.layout;
    const where = `layout ${l.name || c.source}`;
    for (const s of SLOTS) if (l.slots?.[s]) slots[s] = l.slots[s].map(entryOf);
    applyPatch(slots, l.patch, where);
    if (l.theme) {
      Object.assign(theme.light, l.theme.light || {});
      Object.assign(theme.dark, l.theme.dark || {});
      if (l.theme.fontFamily) theme.fontFamily = l.theme.fontFamily;
      if (l.theme.css) theme.css.push(assetPath(c.baseDir, l.theme.css, where));
    }
    if (l.branding) {
      if (l.branding.name) branding.name = l.branding.name;
      if (l.branding.logo) branding.logo = imageDataUri(assetPath(c.baseDir, l.branding.logo, where));
      if (l.branding.favicon) branding.favicon = imageDataUri(assetPath(c.baseDir, l.branding.favicon, where));
    }
    if (l.shell) shell = l.shell;
    if (l.app) app = l.app;
  }
  const resolved = { name: chain[0].layout.name || (typeof ref === "string" ? ref : "inline"), chain: chain.map(c => c.layout.name || c.source), slots, theme, branding, shell, ...(app ? { app } : {}) };
  const problems = [...validateSlots(resolved, env), ...validateApp(resolved, env)];
  if (problems.length) throw new Error(`Layout ${resolved.name}: ${problems.join("; ")}`);
  resolved.custom = customUsed(resolved, env);
  return resolved;
}

function assetPath(baseDir, p, where) {
  const abs = isAbsolute(p) ? p : resolve(baseDir, p);
  if (!existsSync(abs) || !statSync(abs).isFile()) throw new Error(`${where}: file ${p} not found (resolved to ${abs})`);
  return abs;
}

const IMAGE_MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml" };
function imageDataUri(path) {
  const mime = IMAGE_MIME[extname(path).toLowerCase()];
  if (!mime) throw new Error(`${basename(path)}: unsupported image type (${Object.keys(IMAGE_MIME).join(", ")})`);
  const buf = readFileSync(path);
  if (buf.length > 512 * 1024) throw new Error(`${basename(path)}: image over 512 KB`);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

/** Every slot entry is a known component of that slot with valid props. */
export function validateSlots(resolved, env = process.env) {
  const catalog = new Map(listComponents(env).map(c => [c.id, c]));
  const problems = [];
  for (const s of SLOTS) {
    const seen = new Set();
    for (const { component, props } of resolved.slots[s]) {
      const c = catalog.get(component);
      if (!c) { problems.push(`slot ${s}: unknown component "${component}"`); continue; }
      if (c.slot !== s) { problems.push(`slot ${s}: "${component}" belongs to slot ${c.slot}`); continue; }
      if (seen.has(component)) problems.push(`slot ${s}: "${component}" listed twice`);
      seen.add(component);
      const ok = propsSchema.safeParse(props);
      const r = ok.success ? c.props.safeParse(props) : ok;
      if (!r.success) problems.push(`slot ${s}: "${component}" props: ${formatIssues(r.error)}`);
    }
  }
  return problems;
}

function customUsed(resolved, env) {
  const custom = new Map(customComponents(env).ok.map(c => [c.id, c]));
  const used = SLOTS.flatMap(s => resolved.slots[s].map(e => custom.get(e.component)).filter(Boolean));
  for (const e of appEntries(resolved)) { const c = custom.get(e.component); if (c && !used.includes(c)) used.push(c); }
  return used;
}

/** Every component entry of the app shell (sidebar, pages, grid items), with where it sits. */
function appEntries(resolved) {
  if (resolved.shell !== "app" || !resolved.app) return [];
  const out = [];
  const walk = (list, where) => (list || []).forEach((raw, i) => {
    const e = entryOf(raw);
    out.push({ ...e, where: `${where}[${i}]` });
    if (e.component === "page.grid") walk(e.props.items, `${where}[${i}].items`);
  });
  walk(resolved.app.sidebar, "app.sidebar");
  for (const p of resolved.app.pages || []) walk(p.components, `app.pages.${p.id}`);
  return out;
}

/** The app shell is complete and every entry is a known sidebar/page component with valid props. */
export function validateApp(resolved, env = process.env) {
  const problems = [];
  if (resolved.shell !== "app") {
    if (resolved.app) problems.push("app is set but shell is not \"app\"; set shell: \"app\" or drop app");
    return problems;
  }
  if (!resolved.app || !(resolved.app.pages || []).length) return ["shell \"app\" needs app.pages (at least one page)"];
  const ids = resolved.app.pages.map(p => p.id);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) problems.push(`app.pages: id "${dup}" listed twice`);
  if (resolved.app.startPage && !ids.includes(resolved.app.startPage)) problems.push(`app.startPage "${resolved.app.startPage}" is not a page id`);
  const catalog = new Map(listComponents(env).map(c => [c.id, c]));
  for (const e of appEntries(resolved)) {
    const c = catalog.get(e.component);
    const want = e.where.startsWith("app.sidebar") && !e.where.includes(".items") ? "sidebar" : "page";
    if (!c) { problems.push(`${e.where}: unknown component "${e.component}"`); continue; }
    if (c.slot !== want) { problems.push(`${e.where}: "${e.component}" is a ${c.slot} component, not a ${want} component`); continue; }
    if (e.component === "page.grid" && (e.props.items || []).some(x => entryOf(x).component === "page.grid")) problems.push(`${e.where}: page.grid cannot nest another page.grid`);
    const r = c.props.safeParse(e.props);
    if (!r.success) problems.push(`${e.where} "${e.component}" props: ${formatIssues(r.error)}`);
  }
  return problems;
}

// ── Output: page head + runtime payload ──────────────────────────────────────

const escHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** CSS for the theme tokens; more specific than the page's own token rules. */
export function themeCss(theme) {
  const decl = (vars) => Object.entries(vars || {}).filter(([, v]) => v != null)
    .flatMap(([k, v]) => (k === "dock-bg" ? [`--${k}:${v}`, `--ld-dock-bg:${v}`] : [`--${k}:${v}`])).join(";");
  const rules = [];
  if (Object.keys(theme.light || {}).length) rules.push(`html body .ld-frame.light{${decl(theme.light)}}`);
  if (Object.keys(theme.dark || {}).length) rules.push(`html body .ld-frame.dark{${decl(theme.dark)}}`);
  if (theme.fontFamily) rules.push(`html body .ld-frame{font-family:${theme.fontFamily}}`);
  return rules.join("\n");
}

/** The page with the layout's head injections: theme tokens, css, favicon, <title>. */
export function applyLayoutHead(html, resolved) {
  // Nothing in the layout's CSS may load a remote resource (url(https://…),
  // @import of a remote sheet): the page must stay self-contained.
  const tokens = themeCss(resolved.theme);
  assertLocalCss(tokens, `layout ${resolved.name} theme`);
  const files = resolved.theme.css.map(p => { const text = readFileSync(p, "utf-8"); assertLocalCss(text, `layout ${resolved.name} css ${p}`); return text; });
  const css = [tokens, ...files].filter(Boolean).join("\n").replace(/<\/style/gi, "<\\/style");
  const parts = [];
  if (css) parts.push(`<style data-layout="${escHtml(resolved.name)}">\n${css}\n</style>`);
  if (resolved.branding.favicon) parts.push(`<link rel="icon" href="${escHtml(resolved.branding.favicon)}">`);
  let out = html;
  if (parts.length) out = out.replace("</head>", () => `${parts.join("\n")}\n</head>`);
  if (resolved.branding.name) out = out.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escHtml(resolved.branding.name)}</title>`);
  return out;
}

/** What the page reads at runtime (arch-data.layout). */
export function layoutPayload(resolved) {
  const slot = (s) => resolved.slots[s].map(({ component, props }) => (Object.keys(props).length ? { component, props } : component));
  const payload = Object.fromEntries(SLOTS.map(s => [s, slot(s)]));
  if (resolved.shell === "app" && resolved.app) {
    payload.shell = "app";
    const { example, ...app } = resolved.app;
    payload.app = app;
  }
  if (resolved.branding.logo || resolved.branding.name) {
    payload.branding = { ...(resolved.branding.logo ? { logo: resolved.branding.logo } : {}), ...(resolved.branding.name ? { name: resolved.branding.name } : {}) };
  }
  return payload;
}

/** Every { ref } and form `bind` key in a value tree (props, badges, formulas). */
function collectRefs(v, out) {
  if (Array.isArray(v)) { for (const x of v) collectRefs(x, out); return; }
  if (!v || typeof v !== "object") return;
  if (typeof v.ref === "string") out.add(v.ref);
  if (typeof v.bind === "string") out.add(v.bind);
  for (const x of Object.values(v)) collectRefs(x, out);
}

/** Notes for spec fields no component of the layout renders. */
export function layoutWarnings(spec, resolved) {
  const has = (id) => SLOTS.some(s => resolved.slots[s].some(e => e.component === id));
  const notes = [];
  const stepCost = (spec.steps || []).some(s => s && s.costUrl);
  if (spec.costUrl && !has("dock.cost")) notes.push("costUrl is set but the layout has no dock.cost; the link is not shown.");
  if (stepCost && !has("stepCard.costPill") && !has("dock.cost")) notes.push("a step has costUrl but the layout has neither stepCard.costPill nor dock.cost.");
  else if (stepCost && !has("stepCard.costPill")) notes.push("a step has costUrl but the layout has no stepCard.costPill; only the dock shows it.");
  if (spec.caption && !has("header.caption")) notes.push("caption is set but the layout has no header.caption; the band is not shown.");
  if ((spec.languages || []).length > 1 && !has("dock.language")) notes.push("languages are offered but the layout has no dock.language; the viewer cannot switch.");
  if ((spec.steps || []).length && !has("dock.walkthrough")) notes.push("steps are set but the layout has no dock.walkthrough; only the step rail and arrow keys navigate them.");
  if (resolved.branding.logo && !has("dock.brand") && resolved.shell !== "app") notes.push("branding.logo is set but the layout has no dock.brand.");
  if (resolved.shell === "app") {
    const data = spec.data || resolved.app?.example?.data || {};
    const metrics = spec.metrics || resolved.app?.example?.metrics || {};
    const known = new Set([...Object.keys(data), ...Object.keys(metrics)]);
    const refs = new Set();
    for (const e of appEntries(resolved)) {
      collectRefs(e.props, refs);
    }
    for (const p of resolved.app.pages || []) if (p.badge != null) collectRefs(p.badge, refs);
    for (const m of Object.values(metrics)) collectRefs(m, refs);
    const missing = [...refs].filter(r => !known.has(r));
    if (missing.length) notes.push(`app shell reads ${missing.map(m => `"${m}"`).join(", ")}, which neither spec.data nor spec.metrics defines; those values show as "—".`);
    if ((spec.services || []).length && !appEntries(resolved).some(e => e.component === "page.architecture")) notes.push("the spec has services but no page uses page.architecture; the diagram is not shown.");
  }
  return notes;
}

// ── Custom components: on-demand bundle ──────────────────────────────────────

export function bundleCacheDir(env = process.env) {
  return env.DIAGRAM_BUNDLE_CACHE ? resolve(env.DIAGRAM_BUNDLE_CACHE) : join(homedir(), ".cache", "aws-architecture-diagram", "bundles");
}

/** Cache key for a page bundling these custom components. */
export function bundleKey(custom) {
  const h = createHash("sha256");
  h.update(`pkg:${PKG_VERSION}\n`);
  // The default page stands in for the core + standalone sources.
  h.update(`base:${createHash("sha256").update(readFileSync(DEFAULT_PAGE)).digest("hex")}\n`);
  for (const c of [...custom].sort((a, b) => a.id.localeCompare(b.id))) {
    h.update(`component:${c.id}:${readFileSync(c.manifestPath, "utf-8")}:${readFileSync(c.file, "utf-8")}\n`);
  }
  return h.digest("hex").slice(0, 16);
}

export function bundlePath(custom, env = process.env) {
  return join(bundleCacheDir(env), bundleKey(custom), "index.html");
}

/** Source of the virtual module that registers the custom components. */
export function registrationModule(custom) {
  // The core's react entry, as the standalone page imports it (same registry).
  const coreReact = ["@aws-sample-live-diagram", "core", "react"].join("/");
  const lines = [`import { registerComponent } from ${JSON.stringify(coreReact)};`];
  custom.forEach((c, i) => {
    lines.push(`import C${i} from ${JSON.stringify(c.file)};`);
    lines.push(`registerComponent(${JSON.stringify(c.id)}, C${i}, { slot: ${JSON.stringify(c.slot)} });`);
  });
  return lines.join("\n") + "\n";
}

/**
 * Build (or reuse) the page that bundles `custom`. Needs the repo's dev
 * toolchain (Vite + plugins) and standalone/ sources: available in a clone
 * after `npm install`, not in the npm package.
 */
export async function buildBundle(custom, { env = process.env, force = false } = {}) {
  if (!custom.length) return { built: false, path: DEFAULT_PAGE, note: "No custom components: the default page already has every built-in component." };
  const out = bundlePath(custom, env);
  if (!force && existsSync(out)) return { built: false, cached: true, path: out };
  const standalone = join(PKG_ROOT, "standalone");
  if (!existsSync(join(standalone, "customComponents.ts"))) throw new Error("build_bundle needs the standalone/ sources, which the npm package does not ship: clone the repository and run npm install there.");
  let vite, react, tailwind, singlefile;
  try {
    vite = await import("vite");
    react = (await import("@vitejs/plugin-react")).default;
    tailwind = (await import("@tailwindcss/vite")).default;
    singlefile = (await import("vite-plugin-singlefile")).viteSingleFile;
  } catch (e) {
    throw new Error(`build_bundle needs the dev dependencies (vite, @vitejs/plugin-react, @tailwindcss/vite, vite-plugin-singlefile): run npm install in a clone of the repository. (${e.message})`);
  }
  const req = createRequire(join(PKG_ROOT, "package.json"));
  const pkgDir = (p) => dirname(req.resolve(`${p}/package.json`));
  const target = join(standalone, "customComponents.ts");
  const code = registrationModule(custom);
  mkdirSync(dirname(out), { recursive: true });
  await vite.build({
    configFile: false, logLevel: "warn", root: standalone,
    plugins: [react(), tailwind(), singlefile(), {
      name: "diagram-custom-components", enforce: "pre",
      load(id) { return id === target ? code : null; },
    }],
    resolve: {
      alias: [
        { find: "@", replacement: join(PKG_ROOT, "src") },
        // Component files live outside the repo: resolve their bare imports here.
        ...["react", "react-dom", "framer-motion", "@xyflow/react"].map(p => ({ find: new RegExp(`^${p.replace("/", "\\/")}(\\/.*)?$`), replacement: `${pkgDir(p)}$1` })),
        // …and the core's entries, to the same built files the page uses (one registry).
        ...[["", "index"], ["/react", "react"], ["/typed", "typed"], ["/typed-react", "typed-react"], ["/layout-engine", "layout-engine"]]
          .map(([sub, file]) => ({ find: new RegExp(`^@aws-sample-live-diagram\\/core${sub.replace("/", "\\/")}$`), replacement: join(PKG_ROOT, "packages", "diagram-core", "dist", `${file}.js`) })),
      ],
      dedupe: ["react", "react-dom"],
    },
    build: { outDir: dirname(out), emptyOutDir: true, target: "es2020", modulePreload: false },
  });
  if (!existsSync(out)) throw new Error(`Build finished without ${out}.`);
  // A custom component that pulls a remote script, stylesheet, font or image in
  // its markup/CSS would break the self-contained page: refuse the bundle.
  const hits = remoteLoads(readFileSync(out, "utf-8"));
  if (hits.length) {
    rmSync(out, { force: true });
    throw new Error(`Custom components load remote resources; the page must stay self-contained (inline the asset as a data: URI or local CSS) — found: ${hits[0]}`);
  }
  return { built: true, cached: false, path: out };
}

/** The base page for a resolved layout (sync): default page, or its cached bundle. */
export function basePageFor(resolved, env = process.env) {
  if (!resolved.custom.length) return readFileSync(DEFAULT_PAGE, "utf-8");
  const p = bundlePath(resolved.custom, env);
  if (!existsSync(p)) throw new Error(`Layout ${resolved.name} uses custom components (${resolved.custom.map(c => c.id).join(", ")}) and their bundle is not built: run build_bundle (CLI: layout build <name>).`);
  return readFileSync(p, "utf-8");
}

// ── Authoring ────────────────────────────────────────────────────────────────

/** Save a layout as <layoutsDir>/<name>.json (presets are read-only). */
export function saveLayout(layout, { env = process.env, overwrite = false } = {}) {
  const parsed = layoutSchema.safeParse(layout);
  if (!parsed.success) throw new Error(`Invalid layout: ${formatIssues(parsed.error)}`);
  const name = layoutName.parse(parsed.data.name);
  if (PRESETS[name]) throw new Error(`"${name}" is a preset (read-only). Save under another name with extends: "${name}".`);
  const dir = layoutsDir(env);
  const p = join(dir, `${name}.json`);
  if (existsSync(p) && !overwrite) throw new Error(`Layout "${name}" already exists at ${p} (use update_layout).`);
  mkdirSync(dir, { recursive: true });
  resolveLayout(parsed.data, { env, baseDir: dir }); // fail now on unknown components, cycles, missing files
  writeFileSync(p, JSON.stringify(parsed.data, null, 2) + "\n", "utf-8");
  return { name, path: p, layout: parsed.data };
}

/** Patch a saved layout: append `patch` ops and/or replace top-level keys (null deletes). */
export function updateLayout(name, { set = {}, patch = [] } = {}, env = process.env) {
  if (PRESETS[name]) throw new Error(`"${name}" is a preset (read-only).`);
  const p = savedLayoutPath(name, env);
  if (!p) throw new Error(`Unknown saved layout "${name}".`);
  const cur = JSON.parse(readFileSync(p, "utf-8"));
  for (const [k, v] of Object.entries(set)) { if (k === "name") continue; if (v === null) delete cur[k]; else cur[k] = v; }
  if (patch.length) cur.patch = [...(cur.patch || []), ...patch];
  const parsed = layoutSchema.safeParse(cur);
  if (!parsed.success) throw new Error(`Invalid layout: ${formatIssues(parsed.error)}`);
  resolveLayout(parsed.data, { env, baseDir: dirname(p) });
  writeFileSync(p, JSON.stringify(parsed.data, null, 2) + "\n", "utf-8");
  return { name, path: p, layout: parsed.data };
}

/** Resolve without rendering: { ok, slots, custom, needsBuild, built, error }. */
export function validateLayout(ref, { env = process.env, baseDir } = {}) {
  try {
    const r = resolveLayout(ref, { env, baseDir });
    const needsBuild = r.custom.length > 0;
    return { ok: true, name: r.name, chain: r.chain, slots: layoutPayload(r), custom: r.custom.map(c => c.id), needsBuild, built: needsBuild ? existsSync(bundlePath(r.custom, env)) : true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/** A small generic diagram for preview_layout. */
export const PREVIEW_SPEC = {
  title: "Layout preview",
  subtitle: "Static site and API",
  caption: { eyebrow: "Preview", title: "Layout preview", text: "A generic diagram rendered with this layout.", meta: ["Version: v1"] },
  languages: ["en", "pt"],
  costUrl: "https://calculator.aws/#/estimate",
  services: [
    { id: "users", service: "Users", category: "general", external: true },
    { id: "cdn", service: "Amazon CloudFront", category: "networking", role: "Serves the site and routes /api", config: { iac: { priceClass: "PriceClass_All" } } },
    { id: "site", service: "Amazon S3", category: "storage", role: "Static site files" },
    { id: "api", service: "Amazon API Gateway", category: "networking", role: "API front door" },
    { id: "fn", service: "AWS Lambda", category: "compute", role: "Business logic", config: { pricing: { memory: "512 MB" } } },
    { id: "db", service: "Amazon DynamoDB", category: "database", role: "Data store" },
  ],
  connections: [
    { id: "e1", source: "users", target: "cdn", type: "network", label: "HTTPS" },
    { id: "e2", source: "cdn", target: "site", type: "data" },
    { id: "e3", source: "cdn", target: "api", type: "network", label: "/api" },
    { id: "e4", source: "api", target: "fn", type: "event" },
    { id: "e5", source: "fn", target: "db", type: "data" },
  ],
  steps: [
    { eyebrow: "1 · Edge", title: "Edge", body: "Requests arrive at the CDN.", nodes: ["users", "cdn"], edges: ["e1"], chips: [{ label: "TLS", ok: true }] },
    { eyebrow: "2 · API", title: "API", body: "Dynamic calls go to the API.", code: "GET /api/items", codeLabel: "HTTP", nodes: ["api", "fn", "db"], edges: ["e3", "e4", "e5"], costUrl: "https://calculator.aws/#/estimate", costLabel: "Cost estimate" },
  ],
};

export { THEME_TOKENS, SLOTS };
