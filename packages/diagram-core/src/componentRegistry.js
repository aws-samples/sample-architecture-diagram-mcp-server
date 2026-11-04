// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Runtime registry of user components a layout can mount into a slot (dock,
// stepCard, nodeModal, header). The built-in components are rendered by their
// hosts directly; this registry only holds the EXTRA ones a custom bundle adds
// (see lib/layouts.js buildBundle), so the default page carries no extra code.
const registry = new Map();

/** Register a component for a layout id like "my.badge". Returns the id. */
export function registerComponent(id, Component, meta = {}) {
  if (typeof id !== "string" || !id) throw new Error("registerComponent: id required");
  registry.set(id, { Component, meta });
  return id;
}

/** The registered component for an id, or undefined. */
export function getRegisteredComponent(id) {
  return registry.get(id)?.Component;
}

/** Ids of every registered component (for diagnostics). */
export function registeredComponentIds() {
  return [...registry.keys()];
}

// A layout slot entry is "id" or { component: "id", props?, id? }. Ids may be
// written with or without the slot prefix ("dock.cost" or "cost").
export function normalizeSlotEntries(entries, prefix) {
  if (!Array.isArray(entries)) return undefined;
  return entries.map((e) => {
    const o = typeof e === "string" ? { component: e } : (e && typeof e === "object" ? e : null);
    if (!o || typeof o.component !== "string") return null;
    const short = o.component.startsWith(prefix + ".") ? o.component.slice(prefix.length + 1) : o.component;
    return { component: o.component, key: short, props: o.props || {} };
  }).filter(Boolean);
}
