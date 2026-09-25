// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Post-generation validation pass over the diagram IR (services + connections +
// groups + steps). Zod (schemas.js) only checks the SHAPE of the tool input;
// this pass checks that the model is well-formed and renderable: dangling
// connection endpoints, duplicate ids, orphan nodes, missing icons, broken
// parent references, group cycles, and unreachable/dangling walkthrough steps.
//
// Every finding carries a STABLE rule code (see RULES) so downstream tooling can
// match on it. Where a fix is unambiguous and non-destructive to intent, the
// pass auto-repairs the IR and logs a receipt of exactly what it changed; the
// repaired IR is what the render tools then hand to the generator.
import { iconResolutionReport } from "./html-generator.js";

// Stable rule codes. Keep these strings frozen — they are a public contract.
export const RULES = {
  DANGLING_ENDPOINT: { severity: "error", repairable: true },
  DUP_SERVICE_ID:    { severity: "error", repairable: false },
  DUP_CONNECTION_ID: { severity: "warning", repairable: true },
  DUP_GROUP_ID:      { severity: "error", repairable: false },
  ORPHAN_NODE:       { severity: "warning", repairable: false },
  MISSING_ICON:      { severity: "warning", repairable: false },
  BAD_PARENT:        { severity: "warning", repairable: true },
  GROUP_CYCLE:       { severity: "error", repairable: true },
  SELF_LOOP:         { severity: "info", repairable: false },
  STEP_BAD_REF:      { severity: "warning", repairable: true },
  UNREACHABLE_STEP:  { severity: "warning", repairable: false },
};

const IMPLICIT_NODE_IDS = new Set(["users"]);

// Validate + (optionally) auto-repair a diagram IR.
//   input  : { services, connections, groups?, steps? }
//   options: { repair?: boolean = true }
// returns  : { report, repaired }
//   report  : { ok, summary, findings:[{code,severity,message,ids}], receipts:[{code,action,detail}] }
//   repaired: the (possibly rewritten) IR — identical arrays when nothing changed.
export function validateDiagram(input, options = {}) {
  const repair = options.repair !== false;
  const services = Array.isArray(input.services) ? input.services : [];
  const connections = Array.isArray(input.connections) ? input.connections : [];
  const groups = Array.isArray(input.groups) ? input.groups : [];
  const steps = Array.isArray(input.steps) ? input.steps : [];

  const findings = [];
  const receipts = [];
  const add = (code, message, ids) => findings.push({ code, severity: RULES[code]?.severity || "warning", message, ids });
  const receipt = (code, action, detail) => receipts.push({ code, action, detail });

  // ── Node id universe (services + implicit `users`) ────────────────────────
  const serviceIds = new Set();
  for (const s of services) {
    if (!s || s.id == null) continue;
    if (serviceIds.has(s.id)) add("DUP_SERVICE_ID", `Duplicate service id "${s.id}" — ids must be unique (React keys, connection endpoints). Rename one; not auto-fixed to avoid re-pointing the wrong connections.`, [s.id]);
    serviceIds.add(s.id);
  }
  const nodeIds = new Set([...serviceIds, ...IMPLICIT_NODE_IDS]);

  // ── Group ids + parent references + cycles ────────────────────────────────
  const groupIds = new Set();
  for (const g of groups) {
    if (!g || g.id == null) continue;
    if (groupIds.has(g.id)) add("DUP_GROUP_ID", `Duplicate group id "${g.id}".`, [g.id]);
    groupIds.add(g.id);
  }
  // Repaired copies are built lazily (only when a fix touches them).
  let repairedGroups = groups;
  const rewriteGroup = (id, patch) => {
    repairedGroups = (repairedGroups === groups ? groups.slice() : repairedGroups)
      .map(g => (g && g.id === id ? { ...g, ...patch } : g));
  };
  // Bad group.parent → group points at a non-existent parent.
  for (const g of groups) {
    if (g && g.parent != null && !groupIds.has(g.parent)) {
      add("BAD_PARENT", `Group "${g.id}" has parent "${g.parent}" which is not a declared group.`, [g.id, g.parent]);
      if (repair) { rewriteGroup(g.id, { parent: undefined }); receipt("BAD_PARENT", "cleared-group-parent", `group "${g.id}": dropped missing parent "${g.parent}" (now a root container)`); }
    }
  }
  // Group parent cycles (walk each chain; break the first back-edge we hit).
  const parentOf = new Map(repairedGroups.map(g => [g?.id, g?.parent]));
  for (const g of repairedGroups) {
    if (!g || g.parent == null) continue;
    const seen = new Set([g.id]);
    let p = g.parent;
    while (p != null && parentOf.has(p)) {
      if (seen.has(p)) {
        add("GROUP_CYCLE", `Group "${g.id}" is part of a parent cycle (…→ "${p}" →…).`, [g.id, p]);
        if (repair) { rewriteGroup(g.id, { parent: undefined }); parentOf.set(g.id, undefined); receipt("GROUP_CYCLE", "broke-cycle", `group "${g.id}": cleared parent to break a containment cycle`); }
        break;
      }
      seen.add(p);
      p = parentOf.get(p);
    }
  }

  // ── Service parentId references ───────────────────────────────────────────
  let repairedServices = services;
  const rewriteService = (id, patch) => {
    repairedServices = (repairedServices === services ? services.slice() : repairedServices)
      .map(s => (s && s.id === id ? { ...s, ...patch } : s));
  };
  const validGroupIds = new Set(repairedGroups.map(g => g?.id));
  for (const s of services) {
    if (s && s.parentId != null && !validGroupIds.has(s.parentId)) {
      add("BAD_PARENT", `Service "${s.id}" has parentId "${s.parentId}" which is not a declared group.`, [s.id, s.parentId]);
      if (repair) { rewriteService(s.id, { parentId: undefined }); receipt("BAD_PARENT", "cleared-parentId", `service "${s.id}": dropped missing parentId "${s.parentId}"`); }
    }
  }

  // ── Connections: dangling endpoints, self-loops, duplicate ids ────────────
  const touched = new Set();      // node ids that appear on at least one kept edge
  const seenConnIds = new Set();
  const usedConnIds = new Set(connections.map(c => c?.id).filter(Boolean));
  let repairedConnections = connections;
  let connMutated = false;
  const keptConnections = [];
  for (const c of connections) {
    if (!c) { continue; }
    const badSource = c.source != null && !nodeIds.has(c.source);
    const badTarget = c.target != null && !nodeIds.has(c.target);
    if (badSource || badTarget) {
      const which = [badSource ? `source "${c.source}"` : null, badTarget ? `target "${c.target}"` : null].filter(Boolean).join(" and ");
      add("DANGLING_ENDPOINT", `Connection "${c.id}" has dangling ${which} (no such node).`, [c.id, badSource ? c.source : null, badTarget ? c.target : null].filter(Boolean));
      if (repair) { connMutated = true; receipt("DANGLING_ENDPOINT", "dropped-connection", `connection "${c.id}": removed — ${which} does not resolve to a node`); continue; }
      keptConnections.push(c);
      continue;
    }
    if (c.source != null && c.source === c.target) add("SELF_LOOP", `Connection "${c.id}" is a self-loop (source === target === "${c.source}").`, [c.id, c.source]);
    // Duplicate connection id → collides as a React key. Suffix-rename the dup.
    let outC = c;
    if (c.id != null && seenConnIds.has(c.id)) {
      let n = 2, nid = `${c.id}-${n}`;
      while (usedConnIds.has(nid) || seenConnIds.has(nid)) { n += 1; nid = `${c.id}-${n}`; }
      add("DUP_CONNECTION_ID", `Duplicate connection id "${c.id}".`, [c.id]);
      if (repair) { outC = { ...c, id: nid }; usedConnIds.add(nid); connMutated = true; receipt("DUP_CONNECTION_ID", "renamed-connection", `connection "${c.id}" → "${nid}" (unique id)`); }
    }
    if (outC.id != null) seenConnIds.add(outC.id);
    if (outC.source != null) touched.add(outC.source);
    if (outC.target != null) touched.add(outC.target);
    keptConnections.push(outC);
  }
  if (connMutated) repairedConnections = keptConnections;

  // ── Orphan nodes (a real service touched by no connection) ────────────────
  for (const s of services) {
    if (!s || s.id == null || IMPLICIT_NODE_IDS.has(s.id)) continue;
    if (!touched.has(s.id)) add("ORPHAN_NODE", `Service "${s.id}" is not referenced by any connection (isolated node).`, [s.id]);
  }

  // ── Missing icons (reuse the generator's resolver) ────────────────────────
  for (const u of iconResolutionReport(repairedServices)) {
    add("MISSING_ICON", `Service "${u.id}" (service: ${JSON.stringify(u.service)}) resolves to NO icon and renders as a plain initial. Give it a canonical AWS service name or an explicit \`icon\`.`, [u.id]);
  }

  // ── Walkthrough steps: bad refs + unreachable beats ───────────────────────
  const validEdgeIds = new Set(repairedConnections.map(c => c?.id).filter(Boolean));
  let repairedSteps = steps;
  let stepsMutated = false;
  const outSteps = steps.map((st, i) => {
    if (!st) return st;
    let step = st, changed = false;
    const label = st.title || st.eyebrow || `#${i + 1}`;
    const filterRefs = (key, valid, kind) => {
      const arr = st[key];
      if (!Array.isArray(arr)) return;
      const bad = arr.filter(id => !valid.has(id));
      if (!bad.length) return;
      add("STEP_BAD_REF", `Step ${i + 1} ("${typeof label === "string" ? label : "step"}") references missing ${kind}: ${bad.map(x => `"${x}"`).join(", ")}.`, bad);
      if (repair) {
        step = { ...step, [key]: arr.filter(id => valid.has(id)) };
        changed = true;
        receipt("STEP_BAD_REF", "dropped-step-refs", `step ${i + 1}: removed missing ${kind} ${bad.map(x => `"${x}"`).join(", ")}`);
      }
    };
    filterRefs("nodes", nodeIds, "node id(s)");
    filterRefs("edges", validEdgeIds, "edge id(s)");
    filterRefs("groups", validGroupIds, "group id(s)");
    filterRefs("zoom", new Set([...nodeIds, ...validGroupIds]), "zoom target(s)");
    if (changed) stepsMutated = true;
    // Unreachable: after cleanup, the beat highlights/frames nothing at all.
    const src = repair ? step : st;
    const nothing = !(src.nodes?.length) && !(src.edges?.length) && !(src.groups?.length) && !(Array.isArray(src.zoom) ? src.zoom.length : false);
    if (nothing && (Array.isArray(st.nodes) || Array.isArray(st.edges) || Array.isArray(st.groups) || Array.isArray(st.zoom))) {
      add("UNREACHABLE_STEP", `Step ${i + 1} ("${typeof label === "string" ? label : "step"}") highlights/frames no valid element — the beat is a no-op focus. Add at least one node/edge/group, or an intro beat (cardSide:'full').`, []);
    }
    return step;
  });
  if (stepsMutated) repairedSteps = outSteps;

  // ── Summary ───────────────────────────────────────────────────────────────
  const counts = { error: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity] = (counts[f.severity] || 0) + 1;
  const report = {
    ok: counts.error === 0,
    summary: `${findings.length} finding(s): ${counts.error} error, ${counts.warning} warning, ${counts.info} info; ${receipts.length} auto-repair(s).`,
    counts,
    findings,
    receipts,
  };
  const repaired = {
    services: repairedServices,
    connections: repairedConnections,
    groups: repairedGroups,
    steps: repairedSteps,
  };
  return { report, repaired };
}

// Render a compact human-readable block for the MCP tool text result.
export function formatValidationReport(report) {
  if (!report) return "";
  if (!report.findings.length) return "\n\n✅ Validation: no issues found.";
  const order = { error: 0, warning: 1, info: 2 };
  const lines = report.findings
    .slice()
    .sort((a, b) => (order[a.severity] - order[b.severity]))
    .map(f => `  [${f.severity.toUpperCase()}] ${f.code}: ${f.message}`);
  let out = `\n\n🔎 Validation — ${report.summary}\n${lines.join("\n")}`;
  if (report.receipts.length) {
    out += `\n\n🔧 Auto-repairs applied:\n${report.receipts.map(r => `  • ${r.code} — ${r.detail}`).join("\n")}`;
  }
  return out;
}
