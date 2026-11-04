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
import { safeHttpUrl } from "./inline.js";

export const ENV_COST = "@env";

/** The spec's estimates, in order, with the costUrl shortcut as an implicit entry. */
export function resolveCosts(data = {}, { costUrl, costLabel } = {}) {
  const list = (Array.isArray(data.costs) ? data.costs : [])
    .filter((c) => c && typeof c.id === "string" && safeHttpUrl(c.url))
    .map((c) => ({ id: c.id, env: c.env || undefined, label: c.label, url: safeHttpUrl(c.url), default: !!c.default }));
  const url = safeHttpUrl(costUrl ?? data.costUrl);
  if (url && !list.some((c) => c.url === url)) {
    list.unshift({ id: "_spec", env: undefined, label: costLabel ?? data.costLabel, url, default: !list.some((c) => c.default) });
  }
  return list;
}

/** Distinct environments, in first-seen order. */
export function costEnvs(list) {
  return [...new Set((list || []).map((c) => c.env).filter(Boolean))];
}

/** The estimate for an environment: its default entry, else its first; no env → the default entry, else the first. */
export function costForEnv(list, env) {
  if (!list?.length) return null;
  if (env) {
    const inEnv = list.filter((c) => c.env === env);
    if (inEnv.length) return inEnv.find((c) => c.default) || inEnv[0];
  }
  return list.find((c) => c.default) || list[0];
}

/** The environment the page opens on: the default entry's, else the first one's. */
export function initialCostEnv(list) {
  return costForEnv(list, undefined)?.env;
}

/** A beat's estimate: its `cost` id (or "@env"), else its own costUrl; null when it has none. */
export function stepCost(list, step, env) {
  if (!step) return null;
  if (step.cost === ENV_COST) return costForEnv(list, env);
  if (typeof step.cost === "string") return (list || []).find((c) => c.id === step.cost) || null;
  const url = safeHttpUrl(step.costUrl);
  return url ? { id: "_step", env: undefined, label: step.costLabel, url } : null;
}

/** What the dock's cost button links to. */
export function dockCost(list, steps, activeStep, env) {
  if (list?.length) return costForEnv(list, env);
  const walk = Array.isArray(steps) ? steps : [];
  const here = activeStep >= 0 ? stepCost(list, walk[activeStep], env) : null;
  if (here) return here;
  for (const s of walk) { const c = stepCost(list, s, env); if (c) return c; }
  return null;
}

/**
 * Node-modal pricing rows for the environment: config.pricingByEnv[env] when
 * the node has rows for it, else the flat config.pricing.
 */
export function modalPricing(config, env, envs = []) {
  const byEnv = config?.pricingByEnv;
  if (byEnv && typeof byEnv === "object") {
    const rows = byEnv[env] || (env ? undefined : byEnv[envs[0]]);
    if (rows) return rows;
  }
  return pricingForEnv(config?.pricing, env, envs);
}

/** Flat pricing rows, or (tolerated) a pricing object keyed by environment. */
export function pricingForEnv(pricing, env, envs = []) {
  if (!pricing || typeof pricing !== "object") return pricing;
  const values = Object.values(pricing);
  const keyed = values.length > 0 && values.every((v) => v && typeof v === "object" && !Array.isArray(v));
  if (!keyed) return pricing;
  return pricing[env] || pricing[envs[0]] || pricing[Object.keys(pricing)[0]];
}

/** Read / write the selected environment in the URL hash ("#env=prod", or "#tab&env=prod"). */
export function envFromHash(hash) {
  const parts = String(hash || "").replace(/^#/, "").split("&");
  const p = parts.find((x) => x.startsWith("env="));
  return p ? decodeURIComponent(p.slice(4)) : undefined;
}
export function hashWithEnv(hash, env) {
  const parts = String(hash || "").replace(/^#/, "").split("&").filter((x) => x && !x.startsWith("env="));
  if (env) parts.push(`env=${encodeURIComponent(env)}`);
  return parts.length ? `#${parts.join("&")}` : "";
}

/** Problems with a spec's estimates: duplicate ids, several defaults, unknown step refs. */
export function costProblems(data = {}) {
  const problems = [];
  const list = Array.isArray(data.costs) ? data.costs : [];
  const ids = list.map((c) => c?.id);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) problems.push(`costs: id "${dup}" listed twice`);
  if (list.filter((c) => c?.default).length > 1) problems.push("costs: more than one entry has default: true");
  (data.steps || []).forEach((s, i) => {
    if (typeof s?.cost === "string" && s.cost !== ENV_COST && !ids.includes(s.cost)) problems.push(`steps.${i}.cost: no estimate with id "${s.cost}" in costs`);
    if (s?.cost === ENV_COST && !list.length && !data.costUrl) problems.push(`steps.${i}.cost: "@env" needs costs (or costUrl)`);
  });
  return problems;
}
