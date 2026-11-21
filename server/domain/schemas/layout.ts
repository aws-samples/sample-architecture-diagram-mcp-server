// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Contract of a LAYOUT: which components fill each slot of the interactive page,
// in what order and with what props, plus the theme and branding. Kept apart
// from lib/layouts.js (the resolver) so lib/schemas.js can embed it in the
// diagram spec without an import cycle.
import { z } from "zod";
import { DIAGRAM_THEME } from "@aws-sample-live-diagram/core";
import { remoteLoads } from "#domain/shared/self-contained.ts";
import { appConfigSchema } from "./app.ts";

export const SLOTS = ["dock", "stepCard", "nodeModal", "header"] as const;
export type Slot = (typeof SLOTS)[number];
export const slotEnum = z.enum(SLOTS, { error: () => `unknown slot; valid slots: ${SLOTS.join(", ")}` });

// Canvas/card/dock design tokens a theme may set (CSS custom properties).
// Plus dock/accent tokens the layout CSS maps onto the dock (its own markup is fixed).
export const DOCK_TOKENS = ["dock-txt", "dock-muted", "accent", "accent-txt"];
export const THEME_TOKENS: string[] = [...Object.keys(DIAGRAM_THEME.light), ...DOCK_TOKENS];

const nameRe = /^[a-z0-9][a-z0-9._-]*$/i;
export const layoutName = z.string().regex(nameRe, "letters, digits, . _ - (starting with a letter or digit)");
export const componentId = z.string().regex(/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9-]*)+$/, "dotted id such as dock.cost or my.badge");

// Props are a JSON object; each component validates its own shape.
/** A JSON value (what a layout component's props may hold). */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export const jsonValue: z.ZodType<JsonValue> = z.lazy(() => z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(z.string(), jsonValue)]));
export const propsSchema = z.record(z.string(), jsonValue);

export const slotEntrySchema = z.union([
  componentId,
  z.object({
    component: componentId.describe("Component id from list_components (built-in like dock.cost, or a registered custom one)."),
    props: propsSchema.optional().describe("Props for this component; validated against its schema."),
  }).strict(),
]);

const position = {
  before: componentId.optional().describe("Insert/move before this component."),
  after: componentId.optional().describe("Insert/move after this component."),
  index: z.number().int().min(0).optional().describe("Insert/move at this index."),
};
export const patchOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), slot: slotEnum, component: componentId, props: propsSchema.optional(), ...position }).strict(),
  z.object({ op: z.literal("remove"), slot: slotEnum, component: componentId }).strict(),
  z.object({ op: z.literal("move"), slot: slotEnum, component: componentId, ...position }).strict(),
  z.object({ op: z.literal("replace"), slot: slotEnum, component: componentId, with: componentId, props: propsSchema.optional() }).strict(),
  z.object({ op: z.literal("props"), slot: slotEnum, component: componentId, props: propsSchema }).strict(),
]);

// A CSS value: nothing that could end the declaration or the <style> element.
const cssValue = z.string().max(300).regex(/^[^;{}<>\\]*$/, "may not contain ; { } < > or \\")
  .refine(v => remoteLoads(v).length === 0, "may not load a remote resource (url(https://…)); the page must stay self-contained");
const themeMode = z.object(Object.fromEntries(THEME_TOKENS.map(t => [t, cssValue.optional()]))).strict();
// Local file only (no scheme): a remote asset would break the self-contained page.
export const localPath = z.string().max(400).refine(p => !/^[a-z][a-z0-9+.-]*:/i.test(p) || /^[a-z]:[\\/]/i.test(p), "must be a local file path, not a URL");
// An image: a local file path, or an inlined data: URI (what a portable spec carries).
const IMAGE_DATA_URI = /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
export const localImage = z.string().max(700000).refine(
  p => IMAGE_DATA_URI.test(p) || (p.length <= 400 && (!/^[a-z][a-z0-9+.-]*:/i.test(p) || /^[a-z]:[\\/]/i.test(p))),
  "must be a local file path or a data:image/…;base64 URI, not a URL");

export const layoutThemeSchema = z.object({
  light: themeMode.optional(),
  dark: themeMode.optional(),
  fontFamily: cssValue.optional(),
  css: localPath.optional().describe("A local CSS file injected into the page <head> (after the theme tokens)."),
  cssText: z.string().max(200000).optional().describe("CSS text injected after `css` (a portable spec carries its layout CSS here). Local only: url(https://…) and remote @import are rejected."),
}).strict();

export const layoutBrandingSchema = z.object({
  name: z.string().max(80).optional().describe("Product/brand name: shown by dock.brand and used as the page <title>."),
  logo: localImage.optional().describe("Local image (png, jpg, gif, webp, svg; ≤ 512 KB) inlined for dock.brand — or a data:image/…;base64 URI."),
  favicon: localImage.optional().describe("Local image inlined as the page icon — or a data:image/…;base64 URI."),
}).strict();

export const layoutSchema = z.object({
  name: layoutName.optional(),
  description: z.string().max(500).optional(),
  extends: layoutName.optional().describe("Layout this one starts from (a preset such as 'default' or 'cost', or a saved layout). Default 'default'."),
  slots: z.object(Object.fromEntries(SLOTS.map(s => [s, z.array(slotEntrySchema).optional()]))).strict().optional()
    .describe("Full component list per slot, in order (replaces the inherited list for that slot)."),
  patch: z.array(patchOpSchema).optional().describe("Edits applied after `slots`: add / remove / move / replace a component, or change its props."),
  theme: layoutThemeSchema.optional(),
  branding: layoutBrandingSchema.optional(),
  shell: z.enum(["document", "app"]).optional().describe("Page family. 'document' (default): caption + tab rail + canvas + dock, exactly as before. 'app': a sidebar + pages app assembled from the app-shell components (see `app`)."),
  app: appConfigSchema.optional().describe("The app shell (shell: 'app'): sidebar components, pages with their components, start page, and generic example data for previews."),
}).strict();

/** A spec's `layout`: a saved layout / preset name, or an inline layout. */
export const layoutRefSchema = z.union([layoutName, layoutSchema]);

// ── Inferred types ──
export type SlotEntry = z.infer<typeof slotEntrySchema>;
export type PatchOp = z.infer<typeof patchOpSchema>;
export type LayoutTheme = z.infer<typeof layoutThemeSchema>;
export type LayoutBranding = z.infer<typeof layoutBrandingSchema>;
/** An inline layout document (also the body of a saved layout file). */
export type Layout = z.infer<typeof layoutSchema>;
/** A spec's `layout`: a name or an inline layout. */
export type LayoutRef = z.infer<typeof layoutRefSchema>;
