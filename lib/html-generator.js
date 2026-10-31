// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { getDiagramType, validateTypedDiagram, TYPED_KINDS } from '../packages/diagram-core/src/typed/index.js';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { SERVICE_ICONS, SHAPE_ICONS, iconForService as coreIconForService, iconForShape } from '../packages/diagram-core/src/icons.js';
import { embedJson } from './embed.js';
import { iconRoot } from './icon-root.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = readFileSync(join(__dirname, '../dist/index.html'), 'utf-8');

// Icon catalogs + resolver live in the core (shared with every renderer); the
// MCP adds the fuzzy layer over the icon files on disk, which lets a free-text
// service name still resolve to the most specific matching icon. The file list
// is re-read when the icon root changes (icons arriving mid-session via
// setup_icons don't leave a stale empty index behind).
export { SERVICE_ICONS, SHAPE_ICONS, iconForShape };

let _diskFiles = null;
let _diskFilesRoot = null;
function diskIconFiles() {
  const root = iconRoot();
  if (_diskFiles && _diskFilesRoot === root) return _diskFiles;
  _diskFilesRoot = root;
  try { _diskFiles = readdirSync(join(root, 'icons')); } catch { _diskFiles = []; } // assets not fetched yet
  return _diskFiles;
}

export function iconForService(name) {
  return coreIconForService(name, diskIconFiles());
}

// Icon assets are organized as <iconRoot()>/{icons,aws-icons,tech-icons}/.
// A standalone HTML opened via file:// cannot resolve absolute "/icons/..." paths,
// so we inline every icon used by the diagram as a base64 data-URI.
// See lib/icon-root.js for where the icons are looked up (env override, package
// assets/, then the shared ~/.aws-architecture-icons cache).

// Group/container icons referenced by variants (must mirror ALL_GROUP_ICONS in
// src/lib/groupVariants.ts). All are inlined so any container type renders.
const GROUP_ICONS = [
  'AWS-Cloud_32.png',
  'Region_32.png',
  'Virtual-private-cloud-VPC_32.png',
  'Public-subnet_32.png',
  'Private-subnet_32.png',
  'AWS-Account_32.png',
  'Auto-Scaling-group_32.png',
  'Corporate-data-center_32.png',
];

const MIME = { '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif' };

/**
 * Resolve an icon reference to an absolute file path.
 *  - "aws-icons/user.svg" / "tech-icons/x.svg"  -> <iconRoot>/<as-is>
 *  - "Arch_X_48.png"                            -> <iconRoot>/icons/<name>
 */
function iconPath(ref) {
  const root = iconRoot();
  if (ref.includes('/')) return join(root, ref);
  return join(root, 'icons', ref);
}

export function toDataUri(ref) {
  try {
    const p = iconPath(ref);
    if (!existsSync(p)) return null;
    const ext = extname(p).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const buf = readFileSync(p);
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// ── Tabs / sequence view ──
// Default labels for the two-tab rail auto-built from `sequence` (the common
// "architecture + how it flows" document). Bilingual so tr() resolves in either.
const DEFAULT_TAB_LABELS = {
  architecture: { en: 'Architecture', pt: 'Arquitetura', es: 'Arquitectura' },
  sequence: { en: 'Sequence', pt: 'Sequência', es: 'Secuencia' },
  typed: { en: 'Diagram', pt: 'Diagrama', es: 'Diagrama' },
};

// A sequence participant gets the same icon treatment a node does: explicit
// `icon` wins, else resolve from `service`, else from the label. Resolved at
// generation time so the renderer only ever sees a concrete ref (and the ref is
// inlined as a data-URI, which is what makes the file work under file://).
function resolveSequence(seq) {
  if (!seq) return seq;
  const participants = (seq.participants || []).map(p => {
    if (!p || p.icon) return p;
    const name = typeof p.service === 'string' ? p.service : (p.service?.en || p.service?.pt);
    const label = typeof p.label === 'string' ? p.label : (p.label?.en || p.label?.pt);
    const f = (name ? iconForService(name) : null) || (name ? null : iconForService(label));
    return f ? { ...p, icon: f } : p;
  });
  return { ...seq, participants };
}

// Normalize the tab descriptor. `tabs` is authoritative; a bare `sequence` is
// sugar for the two-tab Architecture + Sequence rail. Returns undefined when the
// diagram is single-view (classic behaviour, nothing added to the payload).
export function resolveTabs(options = {}) {
  let tabs = options.tabs;
  if (!tabs?.length) {
    if (!options.sequence) return undefined;
    tabs = [
      { id: 'arch', kind: 'architecture', label: DEFAULT_TAB_LABELS.architecture },
      { id: 'seq', kind: 'sequence', label: DEFAULT_TAB_LABELS.sequence, sequence: options.sequence },
    ];
  }
  return tabs.map(t => {
    if (t.kind === 'typed') assertTypedDiagram(t);
    return {
      ...t,
      label: t.label || DEFAULT_TAB_LABELS[t.kind] || getDiagramType(t.diagram?.kind)?.label || t.id,
      ...(t.sequence ? { sequence: resolveSequence(t.sequence) } : {}),
      ...(t.kind === 'typed' ? { diagram: resolveTypedIcons(t.diagram) } : {}),
    };
  });
}

// A typed tab carries a typed diagram document (@aws-sample-live-diagram/core's
// ./typed registry: gantt, er, swimlane, workflow, …). It is validated with the
// SAME spec the core's views (and downstream apps) use, so a broken body fails
// the render with the spec's own messages instead of drawing a half diagram.
function assertTypedDiagram(t) {
  if (!t.diagram || typeof t.diagram !== 'object') throw new Error(`tab "${t.id}": kind 'typed' requires \`diagram\` ({ kind, … })`);
  if (!getDiagramType(t.diagram.kind)) throw new Error(`tab "${t.id}": unknown typed diagram kind "${t.diagram.kind}" (known: ${TYPED_KINDS.join(', ')})`);
  const { valid, errors } = validateTypedDiagram(t.diagram);
  if (!valid) throw new Error(`tab "${t.id}": invalid ${t.diagram.kind} diagram:\n- ${errors.slice(0, 20).join('\n- ')}`);
}

// Workflow nodes resolve their icon from `service` like every other node.
function resolveTypedIcons(doc) {
  if (doc?.kind !== 'workflow') return doc;
  return { ...doc, nodes: (doc.nodes || []).map(n => (n.icon || !n.service ? n : { ...n, icon: iconForService(n.service) || undefined })) };
}

// Every icon ref a tab payload references (tab buttons + sequence participants).
function tabIconRefs(tabs) {
  const refs = [];
  for (const t of tabs || []) {
    if (t?.icon && t.icon !== 'none') refs.push(t.icon);
    for (const n of t?.diagram?.nodes || []) if (n?.icon) refs.push(n.icon);
    for (const p of t?.sequence?.participants || []) {
      if (p?.icon && p.icon !== 'none') refs.push(p.icon);
    }
  }
  return refs;
}

/**
 * Build a { iconRef -> dataUri } map for every icon the diagram needs:
 * service icons, the user node, and all group decorations.
 */
function buildIconMap(services, steps, groups, tabs) {
  const refs = new Set(GROUP_ICONS);
  for (const s of services || []) {
    if (s && s.icon) refs.add(s.icon);
  }
  // A group can override its container glyph with a specific service icon
  // (e.g. Cluster EKS showing the EKS icon in its header). Those refs are not
  // in GROUP_ICONS, so inline them too or they break under file://.
  for (const g of groups || []) {
    if (g && g.icon && g.icon !== 'none') refs.add(g.icon);
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
  const map = {};
  const missing = [];
  for (const ref of refs) {
    const uri = toDataUri(ref);
    if (uri) map[ref] = uri;
    else missing.push(ref);
  }
  return { map, missing };
}

// Inline an arbitrary list of icon references to { ref -> dataUri }, reusing the
// same icon-root resolution + base64 machinery as the architecture path. Exported
// so the sequence-diagram generator can inline participant/lifeline icons without
// duplicating iconPath/toDataUri. Returns { map, missing } (missing = refs with
// no file on disk, so the caller can surface them).
export function inlineIconRefs(refs) {
  const map = {};
  const missing = [];
  for (const ref of new Set(refs)) {
    if (!ref) continue;
    const uri = toDataUri(ref);
    if (uri) map[ref] = uri;
    else missing.push(ref);
  }
  return { map, missing };
}

// Report which service nodes will render as a bare initial (no icon resolved).
// The generator writes the HTML regardless, but the MCP tools surface this list
// back to the model so it can fix the reference — pass a canonical AWS service
// name (see resolve_icon) or an explicit `icon` — instead of silently shipping a
// diagram with blank nodes. Externals are excluded from the WARNING (a third-party
// or on-prem actor legitimately has no AWS icon) — they still get icon resolution
// attempted in buildArchAndIcons, so "Users" renders its icon without being nagged
// about when it doesn't.
export function iconResolutionReport(services) {
  const unresolved = [];
  for (const s of services || []) {
    if (!s || s.external || s.id === 'users' || s.icon) continue;
    const name = typeof s.service === 'string' ? s.service : (s.service?.en || s.service?.pt);
    if (!iconForService(name) && !iconForShape(s.shape)) {
      unresolved.push({ id: s.id, service: name });
    }
  }
  return unresolved;
}

// Compute the two JSON payloads the standalone template needs (arch-data +
// icon-data), doing the same icon auto-resolution generateHtml does. Shared by
// generateHtml (fills the template) and diagramParts (inline embedding).
function buildArchAndIcons(title, subtitle, services, connections, options = {}) {
  // Resolve an icon for EVERY node that didn't bring its own, externals included:
  // "Users" / "User" / "Corporate data center" are external actors that do have an
  // icon in the AWS set, and excluding externals here left them as bare initials.
  // A third-party with no matching icon (e.g. "Stripe") still falls through to the
  // initial, because iconForService only matches when the icon's whole core name
  // appears in the service name.
  const resolved = (services || []).map(s => {
    if (s && !s.icon) {
      const f = iconForService(typeof s.service === 'string' ? s.service : (s.service?.en || s.service?.pt))
        || iconForShape(s.shape);
      if (f) return { ...s, icon: f };
    }
    return s;
  });
  const tabs = resolveTabs(options);
  const archData = embedJson(archDataObject(title, subtitle, resolved, connections, { ...options, tabs }));
  const { map, missing } = buildIconMap(resolved, options.steps, options.groups, tabs);
  if (missing.length) {
    console.error(`[aws-live-diagram] icons not found (rendered as fallback initials): ${missing.join(', ')}`);
  }
  return { archData, iconData: embedJson(map) };
}

function archDataObject(title, subtitle, resolved, connections, options) {
  return {
    title, subtitle, services: resolved, connections,
    direction: options.direction || 'TB',
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
    // Architecture delta: services/connections/groups carry a `delta` status and
    // the viewer gets a Before/Delta/After toggle. deltaSummary drives the legend
    // counts; deltaView is the view the diagram opens on.
    ...(options.delta ? { delta: true } : {}),
    ...(options.deltaSummary ? { deltaSummary: options.deltaSummary } : {}),
    ...(options.deltaView ? { deltaView: options.deltaView } : {}),
  };
}

export function generateHtml(title, subtitle, services, connections, options = {}) {
  const { archData, iconData } = buildArchAndIcons(title, subtitle, services, connections, options);
  // Replacer FUNCTIONS, not strings: `$&` / '$`' / `$'` anywhere in the author
  // text would otherwise be read as replacement patterns and splice template
  // text into the embedded data.
  return TEMPLATE
    .replace('{{ARCH_DATA}}', () => archData)
    .replace('{{ICON_DATA}}', () => iconData);
}

// ── diagramParts ──
// Return the pieces needed to embed the LIVE diagram INLINE in another document
// (no iframe): the template's <head> <style> + <script type="module"> (the React
// bundle), plus the #root container and the two <script application/json> data
// blocks. The consumer (the cost calculator) drops `head` into its own <head>
// and `body` into a panel — so the diagram's bundle runs in the SAME document,
// which is what lets the app sync its light/dark theme with the diagram.
// Parses the STATIC template (stable markers), not a rendered diagram.
export function diagramParts(title, subtitle, services, connections, options = {}) {
  const { archData, iconData } = buildArchAndIcons(title, subtitle, services, connections, options);
  const styleM = TEMPLATE.match(/<style[^>]*>[\s\S]*?<\/style>/i);
  const moduleM = TEMPLATE.match(/<script type="module"[^>]*>[\s\S]*?<\/script>/i);
  const head = [styleM ? styleM[0] : '', moduleM ? moduleM[0] : ''].filter(Boolean).join('\n');
  const body =
    `<div id="root"></div>\n` +
    `<script type="application/json" id="arch-data">${archData}</script>\n` +
    `<script type="application/json" id="icon-data">${iconData}</script>`;
  return { head, body, archData, iconData };
}
