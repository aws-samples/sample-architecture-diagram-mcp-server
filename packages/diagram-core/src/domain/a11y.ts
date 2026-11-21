// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Plain-text summaries of a diagram for assistive technology and exports — the
// accessible description of <LiveDiagram> / <SequencePlayer>, an export's
// <desc>, an image's alt text. Pure; en / pt / es. (Typed diagrams: each spec's
// describe, via describeTypedDiagram.)
import { tr } from "./i18n.ts";

/** Options of the plain-text summaries. */
export interface DescribeOptions { lang?: string; max?: number }

// Untyped author documents: a field of an object, or undefined.
type Loose = Record<string, unknown>;
// `x.k` (throws on null, like the JS original) and `x?.k`.
const field = (x: unknown, k: string): unknown => (x as Loose)[k];
const opt = (x: unknown, k: string): unknown => (x == null ? undefined : (x as Loose)[k]);

const T: Record<string, Record<string, string>> = {
  en: { arch: "Architecture diagram", seq: "Sequence diagram", with: "with", comps: "component(s)", conns: "connection(s)", groups: "group(s)",
        parts: "participant(s)", steps: "step(s)", and: "and", G: "Groups", C: "Components", L: "Connections", P: "Participants", S: "Steps" },
  pt: { arch: "Diagrama de arquitetura", seq: "Diagrama de sequência", with: "com", comps: "componente(s)", conns: "conexão(ões)", groups: "agrupamento(s)",
        parts: "participante(s)", steps: "passo(s)", and: "e", G: "Agrupamentos", C: "Componentes", L: "Conexões", P: "Participantes", S: "Passos" },
  es: { arch: "Diagrama de arquitectura", seq: "Diagrama de secuencia", with: "con", comps: "componente(s)", conns: "conexión(es)", groups: "agrupación(es)",
        parts: "participante(s)", steps: "paso(s)", and: "y", G: "Agrupaciones", C: "Componentes", L: "Conexiones", P: "Participantes", S: "Pasos" },
};
const words = (lang: string): Record<string, string> => T[lang] || T.en;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** "Architecture diagram "X" with 4 component(s), 3 connection(s) and 1 group(s). Groups: …" */
export function describeArchitecture(data: unknown, { lang = "en", max = 40 }: DescribeOptions = {}): string {
  if (!data) return "";
  const w = words(lang), t = (v: unknown) => tr(v, lang) || "";
  const S = arr(field(data, "services")), C = arr(field(data, "connections")), G = arr(field(data, "groups"));
  // Names render through template strings, so a non-string id prints as in JS.
  const name = (s: unknown) => (t(opt(opt(s, "config"), "label")) || t(opt(s, "label")) || t(opt(s, "name")) || t(opt(s, "service")) || opt(s, "id")) as string;
  const gname = (g: unknown) => (t(opt(g, "label")) || t(opt(opt(g, "config"), "label")) || opt(g, "variant") || opt(g, "id")) as string;
  const byId: Record<string, unknown> = Object.fromEntries(S.map(s => [field(s, "id"), s]));
  const at = (k: unknown): unknown => byId[String(k)];
  const title = t(field(data, "title"));
  const parts = [`${w.arch}${title ? ` "${title}"` : ""} ${w.with} ${S.length} ${w.comps}, ${C.length} ${w.conns} ${w.and} ${G.length} ${w.groups}.`];
  if (G.length) parts.push(`${w.G}: ${G.slice(0, max).map(g => {
    const inside = S.filter(s => field(s, "parentId") === field(g, "id")).map(name);
    return inside.length ? `${gname(g)} (${inside.join(", ")})` : gname(g);
  }).join("; ")}.`);
  const loose = S.filter(s => !field(s, "parentId")).map(name);
  if (loose.length) parts.push(`${w.C}: ${loose.slice(0, max).join(", ")}.`);
  if (C.length) parts.push(`${w.L}: ${C.slice(0, max).map(c => `${name(at(field(c, "source"))) || field(c, "source")} → ${name(at(field(c, "target"))) || field(c, "target")}${t(field(c, "label")) ? ` (${t(field(c, "label"))})` : ""}`).join("; ")}.`);
  return parts.join(" ");
}

/** "Sequence diagram "X" with 3 participant(s) and 4 step(s). Participants: … Steps: A → B: call; …" */
export function describeSequence(seq: unknown, { lang = "en", max = 40 }: DescribeOptions = {}): string {
  if (!seq) return "";
  const w = words(lang), t = (v: unknown) => tr(v, lang) || "";
  const P = arr(field(seq, "participants")), E = arr(field(seq, "events"));
  const byId: Record<string, unknown> = Object.fromEntries(P.map(p => [field(p, "id"), t(field(p, "label")) || field(p, "id")]));
  const at = (k: unknown): unknown => byId[String(k)];
  const title = t(field(seq, "title"));
  const parts = [`${w.seq}${title ? ` "${title}"` : ""} ${w.with} ${P.length} ${w.parts} ${w.and} ${E.length} ${w.steps}.`];
  if (P.length) parts.push(`${w.P}: ${P.slice(0, max).map(p => at(field(p, "id"))).join(", ")}.`);
  if (E.length) parts.push(`${w.S}: ${E.slice(0, max).map(e => field(e, "kind") === "note"
    ? `[${arr(field(e, "over")).map(o => at(o) || o).join("–")}] ${t(field(e, "label"))}`
    : `${at(field(e, "from")) || field(e, "from")} → ${at(field(e, "to")) || field(e, "to")}${t(field(e, "label")) ? `: ${t(field(e, "label"))}` : ""}`).join("; ")}.`);
  return parts.join(" ");
}

// Visually hidden but read by assistive technology.
export const SR_ONLY_STYLE: { position: "absolute"; width: number; height: number; padding: number; margin: number; overflow: "hidden"; clip: string; whiteSpace: "nowrap"; border: number } = { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 };
