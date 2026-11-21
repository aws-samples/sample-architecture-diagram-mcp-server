// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Hand a generated diagram off to downstream tools: the neutral elements JSON
// and the IaC payload for the official AWS IaC MCP. Nothing is priced or deployed here.
import { diagramElementsJson } from "#domain/render/spec.ts";
import type { DiagramElements, ElementsSource } from "#domain/render/spec.ts";
import type { AppDeps } from "./deps.ts";

interface ArchData extends ElementsSource {
  services?: Array<{ id?: unknown; service?: unknown; role?: unknown; category?: unknown; external?: unknown; config?: { iac?: unknown } }>;
  connections?: Array<{ source?: unknown; target?: unknown; type?: unknown; label?: unknown }>;
}

export type ArchDataRead = { ok: true; data: ArchData } | { ok: false; error: "not-found" | "no-arch-data" };

export interface IacPayload {
  region: string;
  name: string | undefined;
  resources: Array<{ id: unknown; service: string | undefined; category: unknown; role?: string; config: unknown }>;
  dependencies: Array<{ from: unknown; to: unknown; type?: unknown; via?: string }>;
}

// Pick the English (else Portuguese, else first) text of an author string.
const txt = (v: unknown): string | undefined => {
  if (typeof v === "string") return v;
  const m = v as Record<string, string> | null | undefined;
  return m?.en || m?.pt || (m && Object.values(m)[0]) || undefined;
};

export function createHandoff(deps: AppDeps) {
  const { workspace: ws } = deps;

  function readArchData(diagramPath: string): ArchDataRead {
    const abs = ws.resolve(diagramPath);
    if (!ws.exists(abs)) return { ok: false, error: "not-found" };
    const m = ws.readText(abs).match(/id="arch-data"[^>]*>(.*?)<\/script/);
    if (!m) return { ok: false, error: "no-arch-data" };
    return { ok: true, data: JSON.parse(m[1]) as ArchData };
  }

  return {
    readArchData,
    elements(data: ArchData, region: string): DiagramElements {
      return diagramElementsJson(data, region);
    },
    iac(data: ArchData, region: string): IacPayload {
      const isExternal = (s: { external?: unknown; id?: unknown }) => !!s.external || s.id === "users";
      const resources = (data.services || [])
        .filter(s => !isExternal(s))
        .map(s => ({
          id: s.id,
          service: txt(s.service),
          category: s.category || "general",
          ...(txt(s.role) ? { role: txt(s.role) } : {}),
          config: s.config?.iac || {},
        }));
      const extIds = new Set((data.services || []).filter(isExternal).map(s => s.id));
      const dependencies = (data.connections || [])
        .filter(c => !extIds.has(c.source) && !extIds.has(c.target))
        .map(c => ({ from: c.source, to: c.target, ...(c.type ? { type: c.type } : {}), ...(txt(c.label) ? { via: txt(c.label) } : {}) }));
      return { region, name: txt(data.title), resources, dependencies };
    },
  };
}
export type Handoff = ReturnType<typeof createHandoff>;
