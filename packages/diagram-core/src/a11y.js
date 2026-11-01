// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Plain-text summaries of a diagram for assistive technology and exports — the
// accessible description of <LiveDiagram> / <SequencePlayer>, an export's
// <desc>, an image's alt text. Pure; en / pt / es. (Typed diagrams: each spec's
// describe, via describeTypedDiagram.)
import { tr } from "./i18n.js";

const T = {
  en: { arch: "Architecture diagram", seq: "Sequence diagram", with: "with", comps: "component(s)", conns: "connection(s)", groups: "group(s)",
        parts: "participant(s)", steps: "step(s)", and: "and", G: "Groups", C: "Components", L: "Connections", P: "Participants", S: "Steps" },
  pt: { arch: "Diagrama de arquitetura", seq: "Diagrama de sequência", with: "com", comps: "componente(s)", conns: "conexão(ões)", groups: "agrupamento(s)",
        parts: "participante(s)", steps: "passo(s)", and: "e", G: "Agrupamentos", C: "Componentes", L: "Conexões", P: "Participantes", S: "Passos" },
  es: { arch: "Diagrama de arquitectura", seq: "Diagrama de secuencia", with: "con", comps: "componente(s)", conns: "conexión(es)", groups: "agrupación(es)",
        parts: "participante(s)", steps: "paso(s)", and: "y", G: "Agrupaciones", C: "Componentes", L: "Conexiones", P: "Participantes", S: "Pasos" },
};
const words = (lang) => T[lang] || T.en;
const arr = (v) => (Array.isArray(v) ? v : []);

/** "Architecture diagram "X" with 4 component(s), 3 connection(s) and 1 group(s). Groups: …" */
export function describeArchitecture(data, { lang = "en", max = 40 } = {}) {
  if (!data) return "";
  const w = words(lang), t = (v) => tr(v, lang) || "";
  const S = arr(data.services), C = arr(data.connections), G = arr(data.groups);
  const name = (s) => t(s?.config?.label) || t(s?.label) || t(s?.name) || t(s?.service) || s?.id;
  const gname = (g) => t(g?.label) || t(g?.config?.label) || g?.variant || g?.id;
  const byId = Object.fromEntries(S.map(s => [s.id, s]));
  const title = t(data.title);
  const parts = [`${w.arch}${title ? ` "${title}"` : ""} ${w.with} ${S.length} ${w.comps}, ${C.length} ${w.conns} ${w.and} ${G.length} ${w.groups}.`];
  if (G.length) parts.push(`${w.G}: ${G.slice(0, max).map(g => {
    const inside = S.filter(s => s.parentId === g.id).map(name);
    return inside.length ? `${gname(g)} (${inside.join(", ")})` : gname(g);
  }).join("; ")}.`);
  const loose = S.filter(s => !s.parentId).map(name);
  if (loose.length) parts.push(`${w.C}: ${loose.slice(0, max).join(", ")}.`);
  if (C.length) parts.push(`${w.L}: ${C.slice(0, max).map(c => `${name(byId[c.source]) || c.source} → ${name(byId[c.target]) || c.target}${t(c.label) ? ` (${t(c.label)})` : ""}`).join("; ")}.`);
  return parts.join(" ");
}

/** "Sequence diagram "X" with 3 participant(s) and 4 step(s). Participants: … Steps: A → B: call; …" */
export function describeSequence(seq, { lang = "en", max = 40 } = {}) {
  if (!seq) return "";
  const w = words(lang), t = (v) => tr(v, lang) || "";
  const P = arr(seq.participants), E = arr(seq.events);
  const byId = Object.fromEntries(P.map(p => [p.id, t(p.label) || p.id]));
  const title = t(seq.title);
  const parts = [`${w.seq}${title ? ` "${title}"` : ""} ${w.with} ${P.length} ${w.parts} ${w.and} ${E.length} ${w.steps}.`];
  if (P.length) parts.push(`${w.P}: ${P.slice(0, max).map(p => byId[p.id]).join(", ")}.`);
  if (E.length) parts.push(`${w.S}: ${E.slice(0, max).map(e => e.kind === "note"
    ? `[${arr(e.over).map(o => byId[o] || o).join("–")}] ${t(e.label)}`
    : `${byId[e.from] || e.from} → ${byId[e.to] || e.to}${t(e.label) ? `: ${t(e.label)}` : ""}`).join("; ")}.`);
  return parts.join(" ");
}

// Visually hidden but read by assistive technology.
export const SR_ONLY_STYLE = { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 };
