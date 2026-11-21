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
// that bundles them (the application's BundleBuilder), cached by bundleKey.
//
// This module is the pure part of the catalog: built-in components, presets,
// the custom-component manifest contract and the preview spec.
import { z } from "zod";
import { SLOTS, componentId } from "#domain/schemas/layout.ts";
import type { Layout, Slot } from "#domain/schemas/layout.ts";
import { APP_COMPONENT_PROPS, APP_COMPONENT_DESCRIPTIONS } from "#domain/schemas/app.ts";
import type { AppComponentId } from "#domain/schemas/app.ts";
import { ODB_APP_PRESET } from "#domain/schemas/app-presets.ts";
import type { ArchitectureSpecInput } from "#domain/schemas/architecture.ts";

/** Slot of a catalog entry: a document slot, or an app-shell slot. */
export type ComponentSlot = Slot | "sidebar" | "page";

interface ComponentBase {
  id: string;
  slot: ComponentSlot;
  description: string;
  /** Spec fields this component renders (drives layoutWarnings). */
  renders: string[];
  version: string;
}
/** A built-in component (ships in the default page). */
export interface BuiltinComponent extends ComponentBase {
  builtin: true;
  props: z.ZodType;
  /** In the catalog but not in its slot's default list (dock.costs). */
  optional?: boolean;
  /** App-shell component (sidebar/page). */
  shell?: "app";
}
/** A custom component found on disk (needs a bundle). */
export interface CustomComponent extends ComponentBase {
  builtin: false;
  props: z.ZodType;
  /** The manifest's JSON Schema of the props (object). */
  propsJsonSchema: Record<string, unknown>;
  /** Absolute path of the component source. */
  file: string;
  /** Absolute path of its .component.json. */
  manifestPath: string;
}
export type CatalogComponent = BuiltinComponent | CustomComponent;
type BuiltinDef = Omit<BuiltinComponent, "version">;

const langText = z.union([z.string(), z.record(z.string(), z.string())]);
const none = z.object({}).strict();

// Built-in components, per slot, in the slot's default order (kept equal to the
// core's DOCK_ITEMS / STEP_CARD_PARTS / NODE_MODAL_SECTIONS — tested).
const BUILTIN_DEFS: Omit<BuiltinDef, "builtin">[] = [
  { id: "dock.brand", slot: "dock", description: "Brand mark: the layout's branding logo and/or name. Renders nothing without branding.", props: none, renders: [] },
  { id: "dock.title", slot: "dock", description: "Diagram title and subtitle (hidden when the spec sets showTitle: false).", props: z.object({ width: z.number().int().min(120).max(600).optional().describe("Column width in px (default 300).") }).strict(), renders: ["title"] },
  { id: "dock.zoom", slot: "dock", description: "Zoom out, fit and zoom in buttons.", props: none, renders: [] },
  { id: "dock.png", slot: "dock", description: "Download the canvas as PNG.", props: none, renders: [] },
  { id: "dock.shareCard", slot: "dock", description: "Download a 1200×630 share card (canvas + title).", props: none, renders: [] },
  { id: "dock.walkthrough", slot: "dock", description: "Walkthrough restart and play/pause (only when the spec has steps).", props: none, renders: ["steps"] },
  { id: "dock.cost", slot: "dock", description: "Cost estimate link button (only when the spec has costUrl, or a step has one). A link — nothing is priced.", props: z.object({ label: langText.optional().describe("Button label when the spec sets no costLabel.") }).strict(), renders: ["costUrl"] },
  { id: "dock.costs", slot: "dock", description: "Estimate split button: the selected environment's estimate, a menu listing every entry of spec.costs (label + environment tag) and an environment switch. dock.cost turns into this automatically when costs has more than one entry.", props: z.object({ label: langText.optional().describe("Button label when the entry has none.") }).strict(), renders: ["costs"], optional: true },
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
  ...(Object.keys(APP_COMPONENT_PROPS) as AppComponentId[]).map(id => ({ id, slot: id.split(".")[0] as ComponentSlot, description: APP_COMPONENT_DESCRIPTIONS[id], props: APP_COMPONENT_PROPS[id], renders: id === "page.architecture" ? ["services"] : [], shell: "app" as const })),
];

/** Built-in components without the package version (the order is the slots' default order). */
export const BUILTIN_COMPONENT_DEFS: BuiltinDef[] = BUILTIN_DEFS.map(c => ({ ...c, builtin: true }));

/** The built-in catalog stamped with this package's version (what list_components reports). */
export function builtinComponents(version: string): BuiltinComponent[] {
  return BUILTIN_DEFS.map(c => ({ ...c, builtin: true, version }));
}

/** Slots of the app shell (components live in layout.app, not in layout.slots). */
export const APP_SLOTS = ["sidebar", "page"];

// Optional built-ins (e.g. dock.costs) are in the catalog but not in a slot's default list.
export const SLOT_DEFAULTS: Record<Slot, string[]> = Object.fromEntries(SLOTS.map(s => [s, BUILTIN_COMPONENT_DEFS.filter(c => c.slot === s && !c.optional).map(c => c.id)])) as Record<Slot, string[]>;
// The node modal is off in the default page; a layout turns it on by listing sections.
SLOT_DEFAULTS.nodeModal = [];

export const customComponentManifestSchema = z.object({
  id: componentId,
  slot: z.enum(SLOTS),
  file: z.string().regex(/^[\w.-]+\.(jsx|tsx|js)$/, "a .jsx/.tsx/.js file next to the manifest"),
  description: z.string().max(500).optional(),
  version: z.string().default("0.1.0"),
  props: z.record(z.string(), z.unknown()).optional().describe("JSON Schema of the props (object)."),
}).strict();
export type CustomComponentManifest = z.infer<typeof customComponentManifestSchema>;

// ── Presets ──────────────────────────────────────────────────────────────────

/** A preset is a named layout shipped with the package (read-only). */
export type Preset = Layout & { name: string; description: string };

export const PRESETS: Record<string, Preset> = {
  default: { name: "default", description: "The standard page: every built-in component in its usual place; node modal off." },
  cost: {
    name: "cost", extends: "default",
    description: "default with the cost estimate up front: the dock's cost button right after the title, the step card's cost pill right after the title, and the node modal on (role, IaC, cost/sizing rows on click).",
    slots: { nodeModal: ["nodeModal.role", "nodeModal.iac", "nodeModal.pricing"] },
    patch: [
      { op: "move", slot: "dock", component: "dock.cost", after: "dock.title" },
      { op: "move", slot: "stepCard", component: "stepCard.costPill", after: "stepCard.title" },
    ],
  },  "odb-app": ODB_APP_PRESET as Preset,
};

/** A small generic diagram for preview_layout. */
export const PREVIEW_SPEC: ArchitectureSpecInput = {
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
