// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Layout resolution, saved layouts and the custom-component catalog, over the
// ports that reach the disk (LayoutStore, ComponentSource, LocalFileReader,
// BundleCache, TemplateSource, Hasher). Building a bundle is NOT here: the
// application's BundleBuilder runs Vite with registrationModule() and caches the
// page under bundleKey(); this module only reads that cache.
import { z } from "zod";
import { SLOTS, layoutSchema, layoutRefSchema, layoutName, propsSchema } from "#domain/schemas/layout.ts";
import type { Layout, LayoutRef, PatchOp, Slot, SlotEntry } from "#domain/schemas/layout.ts";
import { assertLocalCss } from "#domain/shared/self-contained.ts";
import { base64 } from "#domain/shared/base64.ts";
import { baseName, extName, messageOf } from "#domain/shared/paths.ts";
import { themeContrast } from "#domain/architecture/contrast.ts";
import type { ContrastCheck } from "#domain/architecture/contrast.ts";
import type { BundleCache, ComponentSource, Hasher, LayoutStore, LocalFileReader, TemplateSource } from "#domain/ports/index.ts";
import { PRESETS, SLOT_DEFAULTS, builtinComponents, customComponentManifestSchema } from "./catalog.ts";
import type { BuiltinComponent, CatalogComponent, CustomComponent } from "./catalog.ts";
import { appEntries, entryOf, layoutPayload, slotPayload, themeCss } from "./resolved.ts";
import type { LayoutPayload, ResolvedBranding, ResolvedLayout, ResolvedTheme, SlotItem } from "./resolved.ts";

export interface LayoutsDeps {
  /** package.json version: stamped on built-in components and mixed into bundle keys. */
  packageVersion: string;
  layouts: LayoutStore;
  components: ComponentSource;
  files: LocalFileReader;
  bundles: BundleCache;
  templates: TemplateSource;
  hash: Hasher;
}

export interface LayoutListing {
  name: string;
  preset: boolean;
  extends?: string | null;
  description?: string;
  path?: string;
  error?: string;
}
export interface ComponentDescription {
  id: string;
  slot: string;
  builtin: boolean;
  version: string;
  description: string;
  props: unknown;
  file?: string;
}
export interface SavedLayout { name: string; path: string; layout: Layout }
export type LayoutValidation =
  | { ok: true; name: string; chain: string[]; slots: LayoutPayload; custom: string[]; needsBuild: boolean; built: boolean; contrast: ContrastCheck[]; warnings?: string[] }
  | { ok: false; error: string };
export interface PortableLayout { layout: LayoutRef; notes: string[] }
export interface LayoutUpdate { set?: Record<string, unknown>; patch?: PatchOp[] }

export interface Layouts {
  /** Built-ins stamped with the package version. */
  BUILTIN_COMPONENTS: BuiltinComponent[];
  /** The folder new layouts are saved into. */
  layoutsDir(): string;
  /** The custom components folder. */
  componentsDir(): string;
  /** The bundle cache folder. */
  bundleCacheDir(): string;
  /** Custom components found on disk: { ok: [...entries], errors: [...] }. */
  customComponents(): { ok: CustomComponent[]; errors: string[] };
  /** The full catalog: built-ins + custom components. */
  listComponents(): CatalogComponent[];
  describeComponent(id: string): ComponentDescription;
  listLayouts(): LayoutListing[];
  /**
   * Resolve a layout reference (name or inline object) through its `extends`
   * chain. `baseDir` resolves relative asset paths of an INLINE layout (the
   * spec's folder; default: the working directory).
   */
  resolveLayout(ref: unknown, options?: { baseDir?: string }): ResolvedLayout;
  /** Every slot entry is a known component of that slot with valid props. */
  validateSlots(resolved: Omit<ResolvedLayout, "custom">): string[];
  /** The app shell is complete and every entry is a known sidebar/page component with valid props. */
  validateApp(resolved: Omit<ResolvedLayout, "custom">): string[];
  /** The page with the layout's head injections: theme tokens, css, favicon, <title>. */
  applyLayoutHead(html: string, resolved: ResolvedLayout): string;
  /** Cache key for a page bundling these custom components. */
  bundleKey(custom: readonly CustomComponent[]): string;
  bundlePath(custom: readonly CustomComponent[]): string;
  /** The base page for a resolved layout: the default page, or its cached bundle (throws when not built). */
  basePageFor(resolved: ResolvedLayout): string;
  /** Save a layout as <layoutsDir>/<name>.json (presets are read-only). */
  saveLayout(layout: unknown, options?: { overwrite?: boolean }): SavedLayout;
  /** Patch a saved layout: append `patch` ops and/or replace top-level keys (null deletes). */
  updateLayout(name: string, update?: LayoutUpdate): SavedLayout;
  /** Delete a saved layout file (presets are read-only). Returns the path removed. */
  deleteLayout(name: string): { name: string; path: string };
  /** A self-contained copy of a resolved layout for <name>.spec.json. */
  portableLayout(ref: LayoutRef, resolved: ResolvedLayout): PortableLayout;
  /** Resolve without rendering: { ok, slots, custom, needsBuild, built, error }. */
  validateLayout(ref: unknown, options?: { baseDir?: string }): LayoutValidation;
}

// ── Zod issues ───────────────────────────────────────────────────────────────

interface IssueLike { code: string; path: PropertyKey[]; message: string; errors?: IssueLike[][] }
interface FlatIssue { path: PropertyKey[]; message: string }

// A union (layout name | inline layout) hides the real problem behind "Invalid
// input": report the issues of the branch that got furthest (deepest paths).
function flatIssues(issues: readonly IssueLike[], base: PropertyKey[] = []): FlatIssue[] {
  const out: FlatIssue[] = [];
  for (const i of issues) {
    if (i.code === "invalid_union" && Array.isArray(i.errors) && i.errors.length) {
      const best = i.errors.map(e => flatIssues(e, [...base, ...i.path])).sort((a, b) => Math.max(0, ...b.map(x => x.path.length)) - Math.max(0, ...a.map(x => x.path.length)))[0];
      out.push(...best);
    } else out.push({ path: [...base, ...i.path], message: i.message });
  }
  return out;
}
/** One line per issue of a layout ZodError, the deepest union branch first. */
export const formatIssues = (err: z.ZodError): string => flatIssues(err.issues as readonly IssueLike[]).map(i => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");

// ── Patches ──────────────────────────────────────────────────────────────────

type Positioned = { slot: Slot; index?: number; before?: string; after?: string };

function place(list: SlotItem[], entry: SlotItem, op: Positioned, where: string): void {
  const at = op.index != null ? Math.min(op.index, list.length)
    : op.before ? list.findIndex(e => e.component === op.before)
    : op.after ? list.findIndex(e => e.component === op.after) + 1
    : list.length;
  if ((op.before || op.after) && at < (op.after ? 1 : 0)) throw new Error(`${where}: ${op.before || op.after} is not in slot ${op.slot}`);
  list.splice(at, 0, entry);
}

function applyPatch(slots: Record<Slot, SlotItem[]>, patch: readonly PatchOp[] | undefined, where: string): void {
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
    else if (op.op === "replace") {
      // The replacement may already sit elsewhere in the slot: move it here
      // (keeping its props unless new ones are given) instead of listing it twice.
      const dup = list.findIndex(e => e.component === op.with);
      const keep = dup >= 0 ? list[dup].props : {};
      list.splice(idx, 1, { component: op.with, props: op.props || keep });
      if (dup >= 0 && op.with !== op.component) list.splice(dup, 1);
    }
    else if (op.op === "props") list[idx] = { ...list[idx], props: { ...list[idx].props, ...op.props } };
  }
}

const IMAGE_MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml" };
const escHtml = (s: unknown): string => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

// Presets ship with the package and reference no files, so the folder their
// (absent) relative assets would resolve from never matters.
const PRESET_BASE_DIR = "";

interface ChainLink { layout: Layout; baseDir: string | undefined; source: string }

export function createLayouts(deps: LayoutsDeps): Layouts {
  const { layouts: store, components, files } = deps;
  const BUILTIN_COMPONENTS = builtinComponents(deps.packageVersion);

  function customComponents(): { ok: CustomComponent[]; errors: string[] } {
    const ok: CustomComponent[] = [];
    const errors: string[] = [];
    const listed = components.list();
    if (!listed) return { ok, errors };
    const names = listed.filter(f => f.endsWith(".component.json")).sort();
    for (const f of names) {
      try {
        const m = customComponentManifestSchema.parse(JSON.parse(components.read(f)));
        if (BUILTIN_COMPONENTS.some(b => b.id === m.id)) throw new Error(`id ${m.id} is a built-in component`);
        if (!components.exists(m.file)) throw new Error(`${m.file} not found`);
        const file = components.path(m.file);
        // z.fromJSONSchema takes a JSON Schema document; the manifest schema checked it is an object.
        const props: z.ZodType = m.props ? z.fromJSONSchema(m.props as Parameters<typeof z.fromJSONSchema>[0]) : z.object({}).passthrough();
        ok.push({ id: m.id, slot: m.slot, description: m.description || "", version: m.version, props, propsJsonSchema: m.props || { type: "object" }, builtin: false, file, manifestPath: components.path(f), renders: [] });
      } catch (e) {
        errors.push(`${f}: ${messageOf(e)}`);
      }
    }
    return { ok, errors };
  }

  function listComponents(): CatalogComponent[] {
    return [...BUILTIN_COMPONENTS, ...customComponents().ok];
  }

  function describeComponent(id: string): ComponentDescription {
    const c = listComponents().find(x => x.id === id);
    if (!c) throw new Error(`Unknown component "${id}". See list_components.`);
    return {
      id: c.id, slot: c.slot, builtin: c.builtin, version: c.version, description: c.description,
      props: c.builtin ? z.toJSONSchema(c.props) : c.propsJsonSchema,
      ...(c.builtin ? {} : { file: c.file }),
    };
  }

  // ── Presets and saved layouts ──────────────────────────────────────────────

  function savedLayoutPath(name: string): string | null {
    for (const d of store.dirs()) {
      const p = store.join(d, `${name}.json`);
      if (store.exists(p)) return p;
    }
    return null;
  }

  function listLayouts(): LayoutListing[] {
    const out: LayoutListing[] = Object.values(PRESETS).map(p => ({ name: p.name, preset: true, extends: p.extends || null, description: p.description }));
    for (const d of store.dirs()) {
      const listed = store.list(d);
      if (!listed) continue;
      const names = listed.filter(f => f.endsWith(".json")).sort();
      for (const f of names) {
        const name = f.slice(0, -".json".length);
        if (out.some(o => o.name === name)) continue;
        const path = store.join(d, f);
        try {
          const l = layoutSchema.parse(JSON.parse(store.read(path)));
          out.push({ name, preset: false, extends: l.extends || "default", description: l.description || "", path });
        } catch (e) {
          out.push({ name, preset: false, path, error: `invalid layout: ${messageOf(e)}` });
        }
      }
    }
    return out;
  }

  function loadNamed(name: string): ChainLink {
    if (PRESETS[name]) return { layout: PRESETS[name], baseDir: PRESET_BASE_DIR, source: `preset:${name}` };
    const p = savedLayoutPath(name);
    if (!p) throw new Error(`Unknown layout "${name}". Available: ${listLayouts().filter(l => !l.error).map(l => l.name).join(", ")}.`);
    const parsed = layoutSchema.safeParse(JSON.parse(store.read(p)));
    if (!parsed.success) throw new Error(`Layout "${name}" (${p}): ${formatIssues(parsed.error)}`);
    return { layout: parsed.data, baseDir: store.dirOf(p), source: p };
  }

  // ── Resolution ─────────────────────────────────────────────────────────────

  function assetPath(baseDir: string | undefined, p: string, where: string): string {
    const abs = files.resolve(p, baseDir);
    if (!files.isFile(abs)) throw new Error(`${where}: file ${p} not found (resolved to ${abs})`);
    return abs;
  }

  function imageDataUri(path: string): string {
    const mime = IMAGE_MIME[extName(path).toLowerCase()];
    if (!mime) throw new Error(`${baseName(path)}: unsupported image type (${Object.keys(IMAGE_MIME).join(", ")})`);
    const buf = files.readBytes(path);
    if (buf.length > 512 * 1024) throw new Error(`${baseName(path)}: image over 512 KB`);
    return `data:${mime};base64,${base64(buf)}`;
  }

  function validateSlots(resolved: Omit<ResolvedLayout, "custom">): string[] {
    const catalog = new Map(listComponents().map(c => [c.id, c]));
    const problems: string[] = [];
    for (const s of SLOTS) {
      const seen = new Set<string>();
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

  function customUsed(resolved: Omit<ResolvedLayout, "custom">): CustomComponent[] {
    const custom = new Map(customComponents().ok.map(c => [c.id, c]));
    const used = SLOTS.flatMap(s => resolved.slots[s].map(e => custom.get(e.component)).filter((c): c is CustomComponent => Boolean(c)));
    for (const e of appEntries(resolved)) { const c = custom.get(e.component); if (c && !used.includes(c)) used.push(c); }
    return used;
  }

  function validateApp(resolved: Omit<ResolvedLayout, "custom">): string[] {
    const problems: string[] = [];
    if (resolved.shell !== "app") {
      if (resolved.app) problems.push("app is set but shell is not \"app\"; set shell: \"app\" or drop app");
      return problems;
    }
    if (!resolved.app || !(resolved.app.pages || []).length) return ["shell \"app\" needs app.pages (at least one page)"];
    const ids = resolved.app.pages.map(p => p.id);
    const dup = ids.find((id, i) => ids.indexOf(id) !== i);
    if (dup) problems.push(`app.pages: id "${dup}" listed twice`);
    if (resolved.app.startPage && !ids.includes(resolved.app.startPage)) problems.push(`app.startPage "${resolved.app.startPage}" is not a page id`);
    const catalog = new Map(listComponents().map(c => [c.id, c]));
    for (const e of appEntries(resolved)) {
      const c = catalog.get(e.component);
      const want = e.where.startsWith("app.sidebar") && !e.where.includes(".items") ? "sidebar" : "page";
      if (!c) { problems.push(`${e.where}: unknown component "${e.component}"`); continue; }
      if (c.slot !== want) { problems.push(`${e.where}: "${e.component}" is a ${c.slot} component, not a ${want} component`); continue; }
      if (e.component === "page.grid" && ((e.props.items as SlotEntry[] | undefined) || []).some(x => entryOf(x).component === "page.grid")) problems.push(`${e.where}: page.grid cannot nest another page.grid`);
      const r = c.props.safeParse(e.props);
      if (!r.success) problems.push(`${e.where} "${e.component}" props: ${formatIssues(r.error)}`);
    }
    return problems;
  }

  function resolveLayout(ref: unknown, { baseDir }: { baseDir?: string } = {}): ResolvedLayout {
    const parsedRef = layoutRefSchema.safeParse(ref);
    if (!parsedRef.success) throw new Error(`Invalid layout: ${formatIssues(parsedRef.error)}`);
    const chain: ChainLink[] = [];
    const seen = new Set<string>();
    let cur: ChainLink = typeof parsedRef.data === "string" ? loadNamed(parsedRef.data) : { layout: parsedRef.data, baseDir, source: "inline" };
    for (;;) {
      const key = cur.layout.name || cur.source;
      if (seen.has(key)) throw new Error(`Layout extends cycle: ${[...chain.map(c => c.layout.name || c.source), key].join(" → ")}`);
      seen.add(key);
      chain.push(cur);
      if (cur.layout.name === "default" && cur.source === "preset:default") break;
      if (chain.length > 16) throw new Error("Layout extends chain too deep.");
      cur = loadNamed(cur.layout.extends || "default");
    }
    const slots = Object.fromEntries(SLOTS.map(s => [s, SLOT_DEFAULTS[s].map(id => ({ component: id, props: {} }))])) as Record<Slot, SlotItem[]>;
    const theme: ResolvedTheme = { light: {}, dark: {}, fontFamily: undefined, css: [] };
    const branding: ResolvedBranding = {};
    let shell: ResolvedLayout["shell"] = "document";
    let app: ResolvedLayout["app"];
    for (const c of [...chain].reverse()) {
      const l = c.layout;
      const where = `layout ${l.name || c.source}`;
      for (const s of SLOTS) { const list = l.slots?.[s]; if (list) slots[s] = list.map(entryOf); }
      applyPatch(slots, l.patch, where);
      if (l.theme) {
        Object.assign(theme.light, l.theme.light || {});
        Object.assign(theme.dark, l.theme.dark || {});
        if (l.theme.fontFamily) theme.fontFamily = l.theme.fontFamily;
        if (l.theme.css) theme.css.push(assetPath(c.baseDir, l.theme.css, where));
        if (l.theme.cssText) theme.css.push({ text: l.theme.cssText });
      }
      if (l.branding) {
        if (l.branding.name) branding.name = l.branding.name;
        const img = (v: string) => (v.startsWith("data:") ? v : imageDataUri(assetPath(c.baseDir, v, where)));
        if (l.branding.logo) branding.logo = img(l.branding.logo);
        if (l.branding.favicon) branding.favicon = img(l.branding.favicon);
      }
      if (l.shell) shell = l.shell;
      if (l.app) app = l.app;
    }
    const partial: Omit<ResolvedLayout, "custom"> = { name: chain[0].layout.name || (typeof ref === "string" ? ref : "inline"), chain: chain.map(c => c.layout.name || c.source), slots, theme, branding, shell, ...(app ? { app } : {}) };
    const problems = [...validateSlots(partial), ...validateApp(partial)];
    if (problems.length) throw new Error(`Layout ${partial.name}: ${problems.join("; ")}`);
    const resolved: ResolvedLayout = partial as ResolvedLayout; // `custom` is set on the next line (it keeps the original key order)
    resolved.custom = customUsed(partial);
    return resolved;
  }

  // ── Output: page head ──────────────────────────────────────────────────────

  const cssText = (p: ResolvedTheme["css"][number]): string => (typeof p === "string" ? files.readText(p) : p.text);

  function applyLayoutHead(html: string, resolved: ResolvedLayout): string {
    // Nothing in the layout's CSS may load a remote resource (url(https://…),
    // @import of a remote sheet): the page must stay self-contained.
    const tokens = themeCss(resolved.theme);
    assertLocalCss(tokens, `layout ${resolved.name} theme`);
    const cssFiles = resolved.theme.css.map(p => {
      const text = cssText(p);
      assertLocalCss(text, `layout ${resolved.name} css ${typeof p === "string" ? p : "cssText"}`);
      return text;
    });
    const css = [tokens, ...cssFiles].filter(Boolean).join("\n").replace(/<\/style/gi, "<\\/style");
    const parts: string[] = [];
    if (css) parts.push(`<style data-layout="${escHtml(resolved.name)}">\n${css}\n</style>`);
    if (resolved.branding.favicon) parts.push(`<link rel="icon" href="${escHtml(resolved.branding.favicon)}">`);
    let out = html;
    if (parts.length) out = out.replace("</head>", () => `${parts.join("\n")}\n</head>`);
    if (resolved.branding.name) { const name = resolved.branding.name; out = out.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escHtml(name)}</title>`); }
    return out;
  }

  // ── Custom components: bundle cache ────────────────────────────────────────

  function bundleKey(custom: readonly CustomComponent[]): string {
    // One SHA-256 over the same stream the incremental hash used to see.
    let text = `pkg:${deps.packageVersion}\n`;
    // The default page stands in for the core + standalone sources.
    text += `base:${deps.hash.sha256Hex(deps.templates.standalonePage())}\n`;
    for (const c of [...custom].sort((a, b) => a.id.localeCompare(b.id))) {
      text += `component:${c.id}:${files.readText(c.manifestPath)}:${files.readText(c.file)}\n`;
    }
    return deps.hash.sha256Hex(text).slice(0, 16);
  }

  function basePageFor(resolved: ResolvedLayout): string {
    if (!resolved.custom.length) return deps.templates.standalonePage();
    const key = bundleKey(resolved.custom);
    if (!deps.bundles.exists(key)) throw new Error(`Layout ${resolved.name} uses custom components (${resolved.custom.map(c => c.id).join(", ")}) and their bundle is not built: run build_bundle (CLI: layout build <name>).`);
    return deps.bundles.read(key);
  }

  // ── Authoring ──────────────────────────────────────────────────────────────

  function saveLayout(layout: unknown, { overwrite = false }: { overwrite?: boolean } = {}): SavedLayout {
    const parsed = layoutSchema.safeParse(layout);
    if (!parsed.success) throw new Error(`Invalid layout: ${formatIssues(parsed.error)}`);
    const name = layoutName.parse(parsed.data.name);
    if (PRESETS[name]) throw new Error(`"${name}" is a preset (read-only). Save under another name with extends: "${name}".`);
    const dir = store.dirs()[0];
    const p = store.join(dir, `${name}.json`);
    if (store.exists(p) && !overwrite) throw new Error(`Layout "${name}" already exists at ${p} (use update_layout).`);
    store.ensureDir(dir);
    resolveLayout(parsed.data, { baseDir: dir }); // fail now on unknown components, cycles, missing files
    store.write(p, JSON.stringify(parsed.data, null, 2) + "\n");
    return { name, path: p, layout: parsed.data };
  }

  function updateLayout(name: string, { set = {}, patch = [] }: LayoutUpdate = {}): SavedLayout {
    if (PRESETS[name]) throw new Error(`"${name}" is a preset (read-only).`);
    const p = savedLayoutPath(name);
    if (!p) throw new Error(`Unknown saved layout "${name}".`);
    const cur = JSON.parse(store.read(p)) as Record<string, unknown>;
    for (const [k, v] of Object.entries(set)) { if (k === "name") continue; if (v === null) delete cur[k]; else cur[k] = v; }
    if (patch.length) cur.patch = [...((cur.patch as unknown[] | undefined) || []), ...patch];
    const parsed = layoutSchema.safeParse(cur);
    if (!parsed.success) throw new Error(`Invalid layout: ${formatIssues(parsed.error)}`);
    resolveLayout(parsed.data, { baseDir: store.dirOf(p) });
    store.write(p, JSON.stringify(parsed.data, null, 2) + "\n");
    return { name, path: p, layout: parsed.data };
  }

  /**
   * A self-contained copy of a resolved layout for <name>.spec.json: presets stay
   * by name (they ship with the package); a saved or inline layout becomes one
   * inline layout — full slot lists, theme tokens, CSS as text, logo/favicon as
   * data: URIs, the app shell — so the spec re-renders on another machine.
   * Custom components stay by id (their code is not embedded): note returned.
   */
  function portableLayout(ref: LayoutRef, resolved: ResolvedLayout): PortableLayout {
    if (typeof ref === "string" && PRESETS[ref]) return { layout: ref, notes: [] };
    const theme: NonNullable<Layout["theme"]> = {};
    if (Object.keys(resolved.theme.light).length) theme.light = resolved.theme.light;
    if (Object.keys(resolved.theme.dark).length) theme.dark = resolved.theme.dark;
    if (resolved.theme.fontFamily) theme.fontFamily = resolved.theme.fontFamily;
    const css = resolved.theme.css.map(cssText).join("\n");
    if (css) theme.cssText = css;
    const branding: ResolvedBranding = {};
    for (const k of ["name", "logo", "favicon"] as const) if (resolved.branding[k]) branding[k] = resolved.branding[k];
    const layout: Record<string, unknown> = {
      name: resolved.name !== "inline" ? resolved.name : undefined,
      extends: "default",
      slots: Object.fromEntries(SLOTS.map(s => [s, slotPayload(resolved.slots[s])])),
      ...(Object.keys(theme).length ? { theme } : {}),
      ...(Object.keys(branding).length ? { branding } : {}),
      ...(resolved.shell === "app" ? { shell: "app", app: resolved.app } : {}),
    };
    if (!layout.name || PRESETS[layout.name as string]) delete layout.name;
    const notes = resolved.custom.length ? [`the layout uses custom components (${resolved.custom.map(c => c.id).join(", ")}); their code is not embedded in the spec — the target machine needs them in its components folder`] : [];
    // Built from a resolved (valid) layout: it has the layout schema's shape.
    return { layout: layout as Layout, notes };
  }

  function deleteLayout(name: string): { name: string; path: string } {
    if (PRESETS[name]) throw new Error(`"${name}" is a preset (read-only).`);
    const p = savedLayoutPath(name);
    if (!p) throw new Error(`Unknown saved layout "${name}".`);
    store.remove(p);
    return { name, path: p };
  }

  function validateLayout(ref: unknown, { baseDir }: { baseDir?: string } = {}): LayoutValidation {
    try {
      const r = resolveLayout(ref, { baseDir });
      const needsBuild = r.custom.length > 0;
      // WCAG AA (4.5:1) for the text/background pairs the theme sets.
      const contrast = themeContrast(r.theme);
      const lowContrast = contrast.filter(c => c.ok === false).map(c => `${c.mode}: ${c.fg} ${c.fgValue} on ${c.bg} ${c.bgValue} = ${c.ratio}:1 (WCAG AA needs 4.5:1)`);
      return { ok: true, name: r.name, chain: r.chain, slots: layoutPayload(r), custom: r.custom.map(c => c.id), needsBuild, built: needsBuild ? deps.bundles.exists(bundleKey(r.custom)) : true, contrast, ...(lowContrast.length ? { warnings: lowContrast } : {}) };
    } catch (e) {
      return { ok: false, error: messageOf(e) };
    }
  }

  return {
    BUILTIN_COMPONENTS,
    layoutsDir: () => store.dirs()[0],
    componentsDir: () => components.dir(),
    bundleCacheDir: () => deps.bundles.dir(),
    customComponents,
    listComponents,
    describeComponent,
    listLayouts,
    resolveLayout,
    validateSlots,
    validateApp,
    applyLayoutHead,
    bundleKey,
    bundlePath: (custom) => deps.bundles.path(bundleKey(custom)),
    basePageFor,
    saveLayout,
    updateLayout,
    deleteLayout,
    portableLayout,
    validateLayout,
  };
}
