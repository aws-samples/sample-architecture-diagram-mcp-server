// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Architecture delta: diff two diagram IRs (a "before" and an "after") into ONE
// merged IR where every service / connection / group carries a `delta` status —
// "added" | "removed" | "changed" | "unchanged" — plus, for changed items, the
// list of fields that differ. The merged IR is the UNION of both sides (removed
// items are kept so the Before/Delta views can still show them), which also means
// layout is computed once and node positions stay STABLE as the viewer toggles
// Before ↔ Delta ↔ After — the whole point of a delta view.
//
// Matching is by `id` on each collection. Field comparison is a stable-key JSON
// equality over the fields that actually affect the rendered node/edge/group, so
// cosmetic-only object key reordering doesn't register as a change.

/** Delta status of one merged item. */
export type DeltaStatus = "added" | "removed" | "changed" | "unchanged";
export interface DeltaCounts { added: number; removed: number; changed: number; unchanged: number }
/** Anything with an id (services, connections, groups of either IR). */
export interface Identified { id?: string | number | null; [field: string]: unknown }
export type DeltaItem<T> = T & { delta: DeltaStatus; deltaFields?: string[] };
export interface DeltaIR<S = Identified, C = Identified, G = Identified> {
  services?: readonly (S | null | undefined)[];
  connections?: readonly (C | null | undefined)[];
  groups?: readonly (G | null | undefined)[];
}
export interface DeltaSummary { services: DeltaCounts; connections: DeltaCounts; groups: DeltaCounts; total: DeltaCounts }
export interface DeltaResult<S, C, G> {
  services: DeltaItem<S>[];
  connections: DeltaItem<C>[];
  groups: DeltaItem<G>[];
  summary: DeltaSummary;
}

// Fields whose change makes a node/edge/group visually or semantically different.
const SERVICE_FIELDS = ["service", "shape", "category", "label", "role", "parentId", "subnet", "external", "isApi", "pill", "icon", "config"];
const CONNECTION_FIELDS = ["source", "target", "label", "type", "bidirectional", "dashed"];
const GROUP_FIELDS = ["label", "parent", "variant", "icon", "pill"];

// Stable stringify (sorted keys, recursive) so { a:1, b:2 } === { b:2, a:1 }.
function stable(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map(k => `${JSON.stringify(k)}:${stable(o[k])}`).join(",")}}`;
}

// Which of `fields` differ between two items (either may be undefined).
function changedFields(a: Identified | undefined, b: Identified, fields: readonly string[]): string[] {
  const diff: string[] = [];
  for (const f of fields) {
    if (stable(a?.[f]) !== stable(b?.[f])) diff.push(f);
  }
  return diff;
}

// Diff one collection (before[] vs after[]) by id. Returns { merged, counts }.
// merged items are the after-side object when present (else the before-side, for
// removed), decorated with { delta, deltaFields? }. `order` keeps a stable output
// order: after's order first, then any before-only (removed) items appended.
function diffCollection<T extends Identified>(before: readonly (T | null | undefined)[] | undefined, after: readonly (T | null | undefined)[] | undefined, fields: readonly string[]): { merged: DeltaItem<T>[]; counts: DeltaCounts } {
  const beforeById = new Map<Identified["id"], T>();
  for (const x of before || []) if (x && x.id != null) beforeById.set(x.id, x);
  const afterById = new Map<Identified["id"], T>();
  for (const x of after || []) if (x && x.id != null) afterById.set(x.id, x);

  const counts: DeltaCounts = { added: 0, removed: 0, changed: 0, unchanged: 0 };
  const merged: DeltaItem<T>[] = [];
  const seen = new Set<Identified["id"]>();

  for (const x of after || []) {
    if (!x || x.id == null) continue;
    seen.add(x.id);
    const prev = beforeById.get(x.id);
    if (!prev) { merged.push({ ...x, delta: "added" }); counts.added++; continue; }
    const df = changedFields(prev, x, fields);
    if (df.length) { merged.push({ ...x, delta: "changed", deltaFields: df }); counts.changed++; }
    else { merged.push({ ...x, delta: "unchanged" }); counts.unchanged++; }
  }
  for (const x of before || []) {
    if (!x || x.id == null || seen.has(x.id)) continue;
    merged.push({ ...x, delta: "removed" }); counts.removed++;
  }
  return { merged, counts };
}

// Compute the delta between two IRs.
//   before / after : { services, connections, groups? }
// returns { services, connections, groups, summary }
//   summary : { services:{added,removed,changed,unchanged}, connections:{…}, groups:{…}, total:{…} }
export function computeDelta<S extends Identified, C extends Identified, G extends Identified>(before: DeltaIR<S, C, G> = {}, after: DeltaIR<S, C, G> = {}): DeltaResult<S, C, G> {
  const svc = diffCollection(before.services, after.services, SERVICE_FIELDS);
  const con = diffCollection(before.connections, after.connections, CONNECTION_FIELDS);
  const grp = diffCollection(before.groups, after.groups, GROUP_FIELDS);

  const total: DeltaCounts = { added: 0, removed: 0, changed: 0, unchanged: 0 };
  for (const c of [svc.counts, con.counts, grp.counts]) {
    for (const k of Object.keys(total) as (keyof DeltaCounts)[]) total[k] += c[k];
  }
  return {
    services: svc.merged,
    connections: con.merged,
    groups: grp.merged,
    summary: { services: svc.counts, connections: con.counts, groups: grp.counts, total },
  };
}

// One-line human summary for the MCP tool text result.
export function formatDeltaSummary(summary: DeltaSummary | null | undefined): string {
  if (!summary) return "";
  const t = summary.total;
  return `Delta — +${t.added} added, −${t.removed} removed, ~${t.changed} changed, ${t.unchanged} unchanged `
    + `(services +${summary.services.added}/−${summary.services.removed}/~${summary.services.changed}, `
    + `connections +${summary.connections.added}/−${summary.connections.removed}/~${summary.connections.changed}, `
    + `groups +${summary.groups.added}/−${summary.groups.removed}/~${summary.groups.changed}).`;
}
