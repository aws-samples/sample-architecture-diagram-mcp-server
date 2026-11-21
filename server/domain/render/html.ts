// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// The architecture page: fills the standalone template (dist/index.html) with
// the diagram data (arch-data) and every icon it needs as data: URIs
// (icon-data), so the single HTML file opens from file:// with no network.
import { getDiagramType, validateTypedDiagram, TYPED_KINDS } from "@aws-sample-live-diagram/core/typed";
import { APP_GLYPH_NAMES } from "@aws-sample-live-diagram/core";
import { embedJson } from "#domain/shared/embed.ts";
import { createIconResolver, serviceName } from "./icons.ts";
import type { IconResolver } from "./icons.ts";
import type { Diagnostics, IconSource, TemplateSource } from "#domain/ports/index.ts";
import type { LangText, SequenceTabBody, Step, Tab, Caption, CostEntry, ArchitectureSpec } from "#domain/schemas/architecture.ts";
import type { SpecData, SpecMetrics } from "#domain/schemas/app.ts";
import type { DeltaSummary } from "#domain/architecture/delta.ts";

export interface HtmlRendererDeps {
  templates: TemplateSource;
  icons: IconSource;
  diagnostics: Diagnostics;
}

/** A node as the page receives it (a spec service, possibly with a `delta` status). */
export interface HtmlService {
  id: string;
  service?: LangText;
  shape?: string;
  icon?: string;
  [field: string]: unknown;
}
export interface HtmlConnection {
  id: string;
  source: string;
  target: string;
  [field: string]: unknown;
}
export interface HtmlGroup {
  id: string;
  icon?: string;
  [field: string]: unknown;
}

/** A tab as the page receives it: label always set, sequence icons resolved, typed body validated. */
export type ResolvedTab = Omit<Tab, "label"> & { label: LangText };

/** The layout part of arch-data (layoutPayload + the app-shell icon map). */
export interface PageLayout {
  shell?: string;
  app?: unknown;
  branding?: { name?: string; logo?: string };
  appIcons?: Record<string, string>;
  [field: string]: unknown;
}

/** Everything generateHtml reads besides title/subtitle/services/connections. */
export interface HtmlOptions {
  groups?: readonly (HtmlGroup | null | undefined)[];
  steps?: readonly (Step | null | undefined)[];
  tabs?: readonly Tab[];
  sequence?: SequenceTabBody;
  direction?: ArchitectureSpec["direction"];
  caption?: Caption;
  lang?: string;
  languages?: string[];
  uiStrings?: ArchitectureSpec["uiStrings"];
  langLabels?: ArchitectureSpec["langLabels"];
  stepFocus?: boolean;
  stepZoom?: boolean;
  startStep?: number;
  startCardScale?: number;
  flowDots?: boolean;
  flowPeriod?: number;
  collapsible?: boolean;
  defaultCollapsed?: string[];
  costUrl?: string;
  costs?: CostEntry[];
  costLabel?: LangText;
  titleBehavior?: ArchitectureSpec["titleBehavior"];
  dock?: ArchitectureSpec["dock"];
  showTitle?: boolean;
  layout?: PageLayout;
  data?: SpecData;
  metrics?: SpecMetrics;
  /** Architecture delta: services/connections/groups carry a `delta` status. */
  delta?: boolean;
  deltaSummary?: DeltaSummary;
  deltaView?: string;
  /** The page to fill instead of dist/index.html — the same page with a layout's head injections, or a bundle with custom components. */
  templateHtml?: string;
}

export interface DiagramParts {
  head: string;
  body: string;
  archData: string;
  iconData: string;
}

export interface HtmlRenderer {
  generateHtml(title: LangText, subtitle: LangText, services: readonly HtmlService[], connections: readonly HtmlConnection[], options?: HtmlOptions): string;
  diagramParts(title: LangText, subtitle: LangText, services: readonly HtmlService[], connections: readonly HtmlConnection[], options?: HtmlOptions): DiagramParts;
  resolveTabs(options?: Pick<HtmlOptions, "tabs" | "sequence">): ResolvedTab[] | undefined;
  icons: IconResolver;
}

// Group/container icons referenced by variants (must mirror ALL_GROUP_ICONS in
// src/lib/groupVariants.ts). All are inlined so any container type renders.
const GROUP_ICONS = [
  "AWS-Cloud_32.png",
  "Region_32.png",
  "Virtual-private-cloud-VPC_32.png",
  "Public-subnet_32.png",
  "Private-subnet_32.png",
  "AWS-Account_32.png",
  "Auto-Scaling-group_32.png",
  "Corporate-data-center_32.png",
];

// ── Tabs / sequence view ──
// Default labels for the two-tab rail auto-built from `sequence` (the common
// "architecture + how it flows" document). Bilingual so tr() resolves in either.
const DEFAULT_TAB_LABELS: Partial<Record<Tab["kind"], Record<string, string>>> = {
  architecture: { en: "Architecture", pt: "Arquitetura", es: "Arquitectura" },
  sequence: { en: "Sequence", pt: "Sequência", es: "Secuencia" },
  typed: { en: "Diagram", pt: "Diagrama", es: "Diagrama" },
};

// Glyph names the app shell draws itself (no icon file needed).
const APP_GLYPHS = new Set<string>(APP_GLYPH_NAMES);

/** A typed tab's workflow node (the only typed kind whose nodes carry icons). */
interface TypedNode { icon?: string; service?: string; [field: string]: unknown }
type TypedBody = NonNullable<Tab["diagram"]>;

const DEFAULT_PAGE_TITLE = "AWS Architecture Diagram";
const escTitle = (s: unknown): string => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

// A typed tab carries a typed diagram document (@aws-sample-live-diagram/core's
// ./typed registry: gantt, er, swimlane, workflow, …). It is validated with the
// SAME spec the core's views (and downstream apps) use, so a broken body fails
// the render with the spec's own messages instead of drawing a half diagram.
function assertTypedDiagram(t: Tab): void {
  if (!t.diagram || typeof t.diagram !== "object") throw new Error(`tab "${t.id}": kind 'typed' requires \`diagram\` ({ kind, … })`);
  if (!getDiagramType(t.diagram.kind)) throw new Error(`tab "${t.id}": unknown typed diagram kind "${t.diagram.kind}" (known: ${TYPED_KINDS.join(", ")})`);
  const { valid, errors } = validateTypedDiagram(t.diagram);
  if (!valid) throw new Error(`tab "${t.id}": invalid ${t.diagram.kind} diagram:\n- ${errors.slice(0, 20).join("\n- ")}`);
}

// Every icon ref a tab payload references (tab buttons + sequence participants).
function tabIconRefs(tabs: readonly ResolvedTab[] | undefined): string[] {
  const refs: string[] = [];
  for (const t of tabs || []) {
    if (t?.icon && t.icon !== "none") refs.push(t.icon);
    const nodes = (t?.diagram as { nodes?: (TypedNode | null)[] } | undefined)?.nodes;
    for (const n of nodes || []) if (n?.icon) refs.push(n.icon);
    for (const p of t?.sequence?.participants || []) {
      if (p?.icon && p.icon !== "none") refs.push(p.icon);
    }
  }
  return refs;
}

// The browser tab / bookmark / history name: the layout's branding name (already
// written by the layout head), else the diagram title in its authored language,
// else the generic default. Only the template's default <title> is replaced.
function withPageTitle(page: string, title: LangText, options: HtmlOptions): string {
  if (options.layout?.branding?.name) return page;
  const pick = (v: LangText): string | undefined => (v && typeof v === "object" ? (v[options.lang || "en"] ?? v.en ?? Object.values(v)[0]) : v);
  const t = String(pick(title) ?? "").trim();
  if (!t) return page;
  return page.replace(`<title>${DEFAULT_PAGE_TITLE}</title>`, () => `<title>${escTitle(t)}</title>`);
}

function archDataObject(title: LangText, subtitle: LangText, resolved: readonly HtmlService[], connections: readonly HtmlConnection[], options: Omit<HtmlOptions, "tabs"> & { tabs?: readonly ResolvedTab[] }): Record<string, unknown> {
  return {
    title, subtitle, services: resolved, connections,
    direction: options.direction || "TB",
    groups: options.groups || [],
    // Optional header band above the canvas (string | { title, text, meta[] })
    // so a diagram opened cold says what it is before the reader decodes it.
    ...(options.caption ? { caption: options.caption } : {}),
    ...(options.lang ? { lang: options.lang } : {}),
    ...(options.languages ? { languages: options.languages } : {}),
    // Author-supplied chrome i18n so ANY language (not just en/pt/es) fully localizes.
    ...(options.uiStrings ? { uiStrings: options.uiStrings } : {}),
    ...(options.langLabels ? { langLabels: options.langLabels } : {}),
    // Optional guided walkthrough (nodes/edges/groups tinted per beat + overlay card).
    ...(options.steps ? { steps: options.steps } : {}),
    ...(options.stepFocus ? { stepFocus: true } : {}),
    ...(options.stepZoom ? { stepZoom: true } : {}),
    ...(Number.isInteger(options.startStep) ? { startStep: options.startStep } : {}),
    ...(Number.isInteger(options.startCardScale) ? { startCardScale: options.startCardScale } : {}),
    ...(options.flowDots === false ? { flowDots: false } : {}),
    // Uniform flow-dot period (seconds): every edge's dot shares it so a GIF
    // captured over `flowPeriod` seconds loops seamlessly (render_diagram_media).
    ...(options.flowPeriod ? { flowPeriod: options.flowPeriod } : {}),
    ...(options.collapsible === false ? { collapsible: false } : {}),
    // Multi-view document: tab rail + panels (architecture / animated UML
    // sequence / prose). Absent => classic single-canvas diagram.
    ...(options.tabs?.length ? { tabs: options.tabs } : {}),
    ...(options.defaultCollapsed?.length ? { defaultCollapsed: options.defaultCollapsed } : {}),
    // Cost CTA: only a link to an external estimate; nothing is priced here.
    ...(options.costUrl ? { costUrl: options.costUrl } : {}),
    ...(options.costs?.length ? { costs: options.costs } : {}),
    ...(options.titleBehavior ? { titleBehavior: options.titleBehavior } : {}),
    ...(options.dock ? { dock: options.dock } : {}),
    ...(options.costLabel != null ? { costLabel: options.costLabel } : {}),
    // Dock title on/off (the <title> and share card keep the title either way).
    ...(options.showTitle === false ? { showTitle: false } : {}),
    // Layout (server/domain/layouts): components per slot + branding. Absent =>
    // the standard page, exactly as before layouts existed.
    ...(options.layout ? { layout: options.layout } : {}),
    // App shell (layout shell 'app'): inputs and formulas the pages read.
    ...(options.data ? { data: options.data } : {}),
    ...(options.metrics ? { metrics: options.metrics } : {}),
    // Architecture delta: services/connections/groups carry a `delta` status and
    // the viewer gets a Before/Delta/After toggle. deltaSummary drives the legend
    // counts; deltaView is the view the diagram opens on.
    ...(options.delta ? { delta: true } : {}),
    ...(options.deltaSummary ? { deltaSummary: options.deltaSummary } : {}),
    ...(options.deltaView ? { deltaView: options.deltaView } : {}),
  };
}

export function createHtmlRenderer(deps: HtmlRendererDeps): HtmlRenderer {
  const icons = createIconResolver(deps.icons);
  const { iconForService, iconForShape, inlineIconRefs } = icons;

  // A sequence participant gets the same icon treatment a node does: explicit
  // `icon` wins, else resolve from `service`, else from the label. Resolved at
  // generation time so the renderer only ever sees a concrete ref (and the ref is
  // inlined as a data-URI, which is what makes the file work under file://).
  function resolveSequence(seq: SequenceTabBody): SequenceTabBody {
    if (!seq) return seq;
    const participants = (seq.participants || []).map(p => {
      if (!p || p.icon) return p;
      const name = serviceName(p.service);
      const label = serviceName(p.label);
      const f = (name ? iconForService(name) : null) || (name ? null : iconForService(label));
      return f ? { ...p, icon: f } : p;
    });
    return { ...seq, participants };
  }

  // Workflow nodes resolve their icon from `service` like every other node.
  function resolveTypedIcons(doc: TypedBody | undefined): TypedBody | undefined {
    if (doc?.kind !== "workflow") return doc;
    const nodes = (doc.nodes as TypedNode[] | undefined) || [];
    return { ...doc, nodes: nodes.map(n => (n.icon || !n.service ? n : { ...n, icon: iconForService(n.service) || undefined })) };
  }

  // Normalize the tab descriptor. `tabs` is authoritative; a bare `sequence` is
  // sugar for the two-tab Architecture + Sequence rail. Returns undefined when the
  // diagram is single-view (classic behaviour, nothing added to the payload).
  function resolveTabs(options: Pick<HtmlOptions, "tabs" | "sequence"> = {}): ResolvedTab[] | undefined {
    let tabs: readonly Tab[] | undefined = options.tabs;
    if (!tabs?.length) {
      if (!options.sequence) return undefined;
      tabs = [
        { id: "arch", kind: "architecture", label: DEFAULT_TAB_LABELS.architecture },
        { id: "seq", kind: "sequence", label: DEFAULT_TAB_LABELS.sequence, sequence: options.sequence },
      ];
    }
    // A document is shown as tabs only when it has two or more views; a single
    // non-architecture tab (e.g. one `doc` tab) used to vanish, leaving the bare
    // canvas. Put the architecture first so that view — and the rail — exist.
    if (tabs.length === 1 && tabs[0].kind !== "architecture") {
      tabs = [{ id: "arch", kind: "architecture", label: DEFAULT_TAB_LABELS.architecture }, ...tabs];
    }
    return tabs.map(t => {
      if (t.kind === "typed") assertTypedDiagram(t);
      return {
        ...t,
        label: t.label || DEFAULT_TAB_LABELS[t.kind] || getDiagramType(t.diagram?.kind)?.label || t.id,
        ...(t.sequence ? { sequence: resolveSequence(t.sequence) } : {}),
        ...(t.kind === "typed" ? { diagram: resolveTypedIcons(t.diagram) } : {}),
      };
    });
  }

  /** { serviceName: iconFile } for every `service` / non-glyph `icon` in an app-shell layout. */
  function appShellIcons(layout: PageLayout | undefined): Record<string, string> | null {
    if (!layout || layout.shell !== "app" || !layout.app) return null;
    const names = new Set<string>();
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) { v.forEach(walk); return; }
      if (!v || typeof v !== "object") return;
      for (const [k, x] of Object.entries(v)) {
        if ((k === "service" || k === "icon") && typeof x === "string" && !APP_GLYPHS.has(x)) names.add(x);
        else walk(x);
      }
    };
    walk(layout.app);
    const out: Record<string, string> = {};
    for (const n of names) { const f = iconForService(n); if (f) out[n] = f; }
    return Object.keys(out).length ? out : null;
  }

  /**
   * Build a { iconRef -> dataUri } map for every icon the diagram needs:
   * service icons, the user node, and all group decorations.
   */
  function buildIconMap(services: readonly HtmlService[], steps: HtmlOptions["steps"], groups: HtmlOptions["groups"], tabs: readonly ResolvedTab[] | undefined, extra: readonly string[] = []) {
    const refs = new Set<string>(GROUP_ICONS);
    for (const ref of extra) refs.add(ref);
    for (const s of services || []) {
      if (s && s.icon) refs.add(s.icon);
    }
    // A group can override its container glyph with a specific service icon
    // (e.g. Cluster EKS showing the EKS icon in its header). Those refs are not
    // in GROUP_ICONS, so inline them too or they break under file://.
    for (const g of groups || []) {
      if (g && g.icon && g.icon !== "none") refs.add(g.icon);
    }
    // Guided-walkthrough overlay: the StepCard renders an icon for the step and
    // for each chip via resolveIcon(), so those refs must be inlined too or they
    // break under file:// in the standalone HTML.
    for (const step of steps || []) {
      if (step && step.icon) refs.add(step.icon);
      for (const c of (step && step.chips) || []) {
        if (c && c.icon) refs.add(c.icon);
      }
    }
    // Tab rail + sequence-view participant icons (same file:// constraint).
    for (const ref of tabIconRefs(tabs)) refs.add(ref);
    // Same map/missing split as inlineIconRefs (the refs are already unique).
    return inlineIconRefs(refs);
  }

  // Compute the two JSON payloads the standalone template needs (arch-data +
  // icon-data), doing the same icon auto-resolution generateHtml does. Shared by
  // generateHtml (fills the template) and diagramParts (inline embedding).
  function buildArchAndIcons(title: LangText, subtitle: LangText, services: readonly HtmlService[], connections: readonly HtmlConnection[], options: HtmlOptions = {}) {
    // Resolve an icon for EVERY node that didn't bring its own, externals included:
    // "Users" / "User" / "Corporate data center" are external actors that do have an
    // icon in the AWS set, and excluding externals here left them as bare initials.
    // A third-party with no matching icon (e.g. "Stripe") still falls through to the
    // initial, because iconForService only matches when the icon's whole core name
    // appears in the service name.
    const resolved = (services || []).map(s => {
      if (s && !s.icon) {
        const f = iconForService(serviceName(s.service))
          || iconForShape(s.shape);
        if (f) return { ...s, icon: f };
      }
      return s;
    });
    const tabs = resolveTabs(options);
    // App shell: service names used as icons by sidebar/page components resolve
    // to icon files here, so the page can inline them (file:// has no /icons/).
    const appIcons = appShellIcons(options.layout);
    const layout = appIcons ? { ...options.layout, appIcons } : options.layout;
    const archData = embedJson(archDataObject(title, subtitle, resolved, connections, { ...options, tabs, ...(layout ? { layout } : {}) }));
    const { map, missing } = buildIconMap(resolved, options.steps, options.groups, tabs, appIcons ? Object.values(appIcons) : []);
    if (missing.length) {
      deps.diagnostics.warn(`[aws-live-diagram] icons not found (rendered as fallback initials): ${missing.join(", ")}`);
    }
    return { archData, iconData: embedJson(map) };
  }

  function generateHtml(title: LangText, subtitle: LangText, services: readonly HtmlService[], connections: readonly HtmlConnection[], options: HtmlOptions = {}): string {
    const { archData, iconData } = buildArchAndIcons(title, subtitle, services, connections, options);
    // Replacer FUNCTIONS, not strings: `$&` / '$`' / `$'` anywhere in the author
    // text would otherwise be read as replacement patterns and splice template
    // text into the embedded data.
    const page = (options.templateHtml || deps.templates.standalonePage())
      .replace("{{ARCH_DATA}}", () => archData)
      .replace("{{ICON_DATA}}", () => iconData);
    return withPageTitle(page, title, options);
  }

  // ── diagramParts ──
  // Return the pieces needed to embed the LIVE diagram INLINE in another document
  // (no iframe): the template's <head> <style> + <script type="module"> (the React
  // bundle), plus the #root container and the two <script application/json> data
  // blocks. The consumer (the cost calculator) drops `head` into its own <head>
  // and `body` into a panel — so the diagram's bundle runs in the SAME document,
  // which is what lets the app sync its light/dark theme with the diagram.
  // Parses the STATIC template (stable markers), not a rendered diagram.
  function diagramParts(title: LangText, subtitle: LangText, services: readonly HtmlService[], connections: readonly HtmlConnection[], options: HtmlOptions = {}): DiagramParts {
    const { archData, iconData } = buildArchAndIcons(title, subtitle, services, connections, options);
    const template = deps.templates.standalonePage();
    const styleM = template.match(/<style[^>]*>[\s\S]*?<\/style>/i);
    const moduleM = template.match(/<script type="module"[^>]*>[\s\S]*?<\/script>/i);
    const head = [styleM ? styleM[0] : "", moduleM ? moduleM[0] : ""].filter(Boolean).join("\n");
    const body =
      `<div id="root"></div>\n` +
      `<script type="application/json" id="arch-data">${archData}</script>\n` +
      `<script type="application/json" id="icon-data">${iconData}</script>`;
    return { head, body, archData, iconData };
  }

  return { generateHtml, diagramParts, resolveTabs, icons };
}
