// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Cost estimate links: several estimates, one per environment (pure JS) ───
// The diagram never prices anything; it links to estimates (e.g. AWS Pricing
// Calculator share URLs). A spec may list several — one per sizing scenario or
// environment — and pick which one each beat shows:
//
//   costs: [{ id, env?, label, url, default? }]     the estimates
//   steps[].cost: "<id>"                            this beat's estimate
//   steps[].cost: "@env"                            the selected environment's
//   costUrl / costLabel                             shortcut: one implicit entry
//   steps[].costUrl / costLabel                     shortcut: a beat-local link
//   services[].config.pricing: { <env>: { … } }     modal rows per environment
//
// The dock shows the selected environment's estimate (default entry first). When
// the spec has no top-level estimate, it follows the active beat's link — and,
// on the overview, the first beat that has one (the behavior before `costs`).
import { safeHttpUrl } from "./inline.ts";

/** An authored estimate (`costs[]`). */
export interface CostEntryInput { id: string; env?: string; label?: unknown; url: string; default?: boolean }
/** A resolved estimate link. `label` is author text (string or language map). */
export interface CostEntry { id: string; env: string | undefined; label: unknown; url: string; default?: boolean }
/** The spec fields the cost helpers read. */
export interface CostSpec { costs?: unknown; costUrl?: unknown; costLabel?: unknown; steps?: unknown }
/** A beat's cost fields. */
export interface CostStep { cost?: unknown; costUrl?: unknown; costLabel?: unknown }
/** Node-modal config fields the pricing helpers read. */
export interface PricingConfig { pricing?: unknown; pricingByEnv?: unknown }

type Loose = Record<string, unknown>;
const isObj = (v: unknown): v is Loose => v != null && typeof v === "object";

export const ENV_COST = "@env";

/** The spec's estimates, in order, with the costUrl shortcut as an implicit entry. */
export function resolveCosts(data: CostSpec = {}, { costUrl, costLabel }: { costUrl?: unknown; costLabel?: unknown } = {}): CostEntry[] {
  const list: CostEntry[] = (Array.isArray(data.costs) ? (data.costs as unknown[]) : [])
    .filter((c): c is Loose & { id: string } => isObj(c) && typeof c.id === "string" && !!safeHttpUrl(c.url))
    .map((c) => ({ id: c.id, env: (c.env || undefined) as string | undefined, label: c.label, url: safeHttpUrl(c.url) as string, default: !!c.default }));
  const url = safeHttpUrl(costUrl ?? data.costUrl);
  if (url && !list.some((c) => c.url === url)) {
    list.unshift({ id: "_spec", env: undefined, label: costLabel ?? data.costLabel, url, default: !list.some((c) => c.default) });
  }
  return list;
}

/** Distinct environments, in first-seen order. */
export function costEnvs(list: readonly CostEntry[] | null | undefined): string[] {
  return [...new Set((list || []).map((c) => c.env).filter((e): e is string => !!e))];
}

/** The estimate for an environment: its default entry, else its first; no env → the default entry, else the first. */
export function costForEnv(list: readonly CostEntry[] | null | undefined, env: string | null | undefined): CostEntry | null {
  if (!list?.length) return null;
  if (env) {
    const inEnv = list.filter((c) => c.env === env);
    if (inEnv.length) return inEnv.find((c) => c.default) || inEnv[0];
  }
  return list.find((c) => c.default) || list[0];
}

/** The environment the page opens on: the default entry's, else the first one's. */
export function initialCostEnv(list: readonly CostEntry[] | null | undefined): string | undefined {
  return costForEnv(list, undefined)?.env;
}

/** A beat's estimate: its `cost` id (or "@env"), else its own costUrl; null when it has none. */
export function stepCost(list: readonly CostEntry[] | null | undefined, step: CostStep | null | undefined, env: string | null | undefined): CostEntry | null {
  if (!step) return null;
  if (step.cost === ENV_COST) return costForEnv(list, env);
  if (typeof step.cost === "string") return (list || []).find((c) => c.id === step.cost) || null;
  const url = safeHttpUrl(step.costUrl);
  return url ? { id: "_step", env: undefined, label: step.costLabel, url } : null;
}

/** What the dock's cost button links to. */
export function dockCost(list: readonly CostEntry[] | null | undefined, steps: unknown, activeStep: number, env: string | null | undefined): CostEntry | null {
  if (list?.length) return costForEnv(list, env);
  const walk: (CostStep | null | undefined)[] = Array.isArray(steps) ? steps : [];
  const here = activeStep >= 0 ? stepCost(list, walk[activeStep], env) : null;
  if (here) return here;
  for (const s of walk) { const c = stepCost(list, s, env); if (c) return c; }
  return null;
}

/**
 * Node-modal pricing rows for the environment: config.pricingByEnv[env] when
 * the node has rows for it, else the flat config.pricing.
 */
export function modalPricing(config: PricingConfig | null | undefined, env: string | null | undefined, envs: readonly string[] = []): unknown {
  const byEnv = config?.pricingByEnv;
  if (isObj(byEnv)) {
    const rows = byEnv[String(env)] || (env ? undefined : byEnv[String(envs[0])]);
    if (rows) return rows;
  }
  return pricingForEnv(config?.pricing, env, envs);
}

/** Flat pricing rows, or (tolerated) a pricing object keyed by environment. */
export function pricingForEnv(pricing: unknown, env: string | null | undefined, envs: readonly string[] = []): unknown {
  if (!isObj(pricing)) return pricing;
  const values = Object.values(pricing);
  const keyed = values.length > 0 && values.every((v) => v && typeof v === "object" && !Array.isArray(v));
  if (!keyed) return pricing;
  return pricing[String(env)] || pricing[String(envs[0])] || pricing[Object.keys(pricing)[0]];
}

/** Read / write the selected environment in the URL hash ("#env=prod", or "#tab&env=prod"). */
export function envFromHash(hash: string | null | undefined): string | undefined {
  const parts = String(hash || "").replace(/^#/, "").split("&");
  const p = parts.find((x) => x.startsWith("env="));
  return p ? decodeURIComponent(p.slice(4)) : undefined;
}
export function hashWithEnv(hash: string | null | undefined, env: string | null | undefined): string {
  const parts = String(hash || "").replace(/^#/, "").split("&").filter((x) => x && !x.startsWith("env="));
  if (env) parts.push(`env=${encodeURIComponent(env)}`);
  return parts.length ? `#${parts.join("&")}` : "";
}

/** Problems with a spec's estimates: duplicate ids, several defaults, unknown step refs. */
export function costProblems(data: CostSpec = {}): string[] {
  const problems: string[] = [];
  const list: unknown[] = Array.isArray(data.costs) ? data.costs : [];
  // `x?.field` on untyped author data.
  const field = (x: unknown, k: string): unknown => (x == null ? undefined : (x as Loose)[k]);
  const ids = list.map((c) => field(c, "id"));
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) problems.push(`costs: id "${dup}" listed twice`);
  if (list.filter((c) => field(c, "default")).length > 1) problems.push("costs: more than one entry has default: true");
  ((data.steps || []) as unknown[]).forEach((s, i) => {
    const cost = field(s, "cost");
    if (typeof cost === "string" && cost !== ENV_COST && !ids.includes(cost)) problems.push(`steps.${i}.cost: no estimate with id "${cost}" in costs`);
    if (cost === ENV_COST && !list.length && !data.costUrl) problems.push(`steps.${i}.cost: "@env" needs costs (or costUrl)`);
  });
  return problems;
}
