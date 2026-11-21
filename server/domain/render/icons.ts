// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Icon catalogs + resolver live in the core (shared with every renderer); the
// MCP adds the fuzzy layer over the icon files on disk, which lets a free-text
// service name still resolve to the most specific matching icon. The file list
// comes from the IconSource port, which re-reads it when the icon root changes
// (icons arriving mid-session via setup_icons don't leave a stale empty index
// behind).
//
// A standalone HTML opened via file:// cannot resolve absolute "/icons/..."
// paths, so every icon a diagram uses is inlined as a base64 data-URI
// (IconSource.dataUri).
import { SERVICE_ICONS, SHAPE_ICONS, iconForService as coreIconForService, iconForShape as coreIconForShape } from "@aws-sample-live-diagram/core";
import type { IconSource } from "#domain/ports/index.ts";
import type { LangText } from "#domain/schemas/architecture.ts";

export { SERVICE_ICONS, SHAPE_ICONS };

/** AWS4 shape → icon file (pure). */
export const iconForShape: (shape: string | null | undefined) => string | null = coreIconForShape;
const resolveServiceIcon: (name: LangText | null | undefined, files?: readonly string[]) => string | null = coreIconForService;

/** { ref → data: URI } for the refs found on disk, plus the refs that were not. */
export interface InlinedIcons {
  map: Record<string, string>;
  missing: string[];
}

/** A node the architecture report checks (only the fields it reads). */
export interface IconCheckedService {
  id: string;
  service?: LangText;
  shape?: string;
  icon?: string;
  external?: boolean;
}
export interface UnresolvedIcon {
  id: string;
  service: string | undefined;
}

export interface IconResolver {
  /** Service display name → icon file (exact catalog hit, then fuzzy match over the installed files). */
  iconForService(name: LangText | null | undefined): string | null;
  iconForShape(shape: string | null | undefined): string | null;
  /** An icon reference as a data: URI, or null when the file is missing. */
  toDataUri(ref: string): string | null;
  /**
   * Inline an arbitrary list of icon references to { ref -> dataUri } (the
   * sequence and flow players reuse the architecture path's machinery).
   * missing = refs with no file on disk, so the caller can surface them.
   */
  inlineIconRefs(refs: Iterable<string | null | undefined>): InlinedIcons;
  /**
   * Which service nodes will render as a bare initial (no icon resolved).
   * Externals are excluded from the WARNING (a third-party or on-prem actor
   * legitimately has no AWS icon) — they still get icon resolution attempted,
   * so "Users" renders its icon without being nagged about when it doesn't.
   */
  iconResolutionReport(services: readonly (IconCheckedService | null | undefined)[] | null | undefined): UnresolvedIcon[];
}

/** The English (else Portuguese) text of an author string, as the icon resolver reads it. */
export function serviceName(v: LangText | undefined): string | undefined {
  return typeof v === "string" ? v : (v?.en || v?.pt);
}

export function createIconResolver(icons: IconSource): IconResolver {
  const iconForService = (name: LangText | null | undefined): string | null => resolveServiceIcon(name, icons.iconFiles());
  const toDataUri = (ref: string): string | null => icons.dataUri(ref);
  return {
    iconForService,
    iconForShape,
    toDataUri,
    inlineIconRefs(refs) {
      const map: Record<string, string> = {};
      const missing: string[] = [];
      for (const ref of new Set(refs)) {
        if (!ref) continue;
        const uri = toDataUri(ref);
        if (uri) map[ref] = uri;
        else missing.push(ref);
      }
      return { map, missing };
    },
    iconResolutionReport(services) {
      const unresolved: UnresolvedIcon[] = [];
      for (const s of services || []) {
        if (!s || s.external || s.id === "users" || s.icon) continue;
        const name = serviceName(s.service);
        if (!iconForService(name) && !iconForShape(s.shape)) {
          unresolved.push({ id: s.id, service: name });
        }
      }
      return unresolved;
    },
  };
}
