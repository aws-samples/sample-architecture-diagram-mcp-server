// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Language handling for the interactive HTML diagram.
//
// Two layers:
//  1. CONTENT (author-supplied: titles, bodies, bullets, roles, labels…) is
//     resolved via `tr()` — a value is a plain string OR a { <lang>: string }
//     map, e.g. { en: "Overview", pt: "Visão geral" }.
//  2. UI CHROME (fixed strings this component renders itself: modal section
//     headings, toolbar tooltips) lives in UI_STRINGS below, keyed by language.
//
// The active language is declared by the diagram (`data.lang`, default "en")
// and the set of offered languages by `data.languages`; the toolbar shows a
// language switch only when more than one is available.

export type Lang = string;

// The content resolver `tr()` now lives in the shared @aws-live-diagram/core
// package (single source of truth, also consumed by the slides deck). The UI
// CHROME table below (modal headings, toolbar tooltips) stays MCP-local.
export { tr } from "@aws-live-diagram/core";

// UI chrome strings. Add a language by adding a column; unknown languages fall
// back to English. Keep keys stable — components look them up by key.
type UIKey = "iac" | "pricing" | "architecture" | "restart" | "play" | "pause" | "theme" | "collapse" | "expand" | "language" | "cost" | "textLarger" | "textSmaller" | "exportPng";
const UI: Record<UIKey, Record<string, string>> = {
  cost:         { en: "Cost estimate",       pt: "Estimativa de custo", es: "Estimación de costo" },
  textLarger:   { en: "Larger card text",    pt: "Aumentar texto do cartão", es: "Agrandar texto de la tarjeta" },
  textSmaller:  { en: "Smaller card text",   pt: "Diminuir texto do cartão", es: "Reducir texto de la tarjeta" },
  iac:          { en: "Configuration (IaC)", pt: "Configuração (IaC)", es: "Configuración (IaC)" },
  pricing:      { en: "Cost / sizing",       pt: "Custo / dimensionamento", es: "Costo / dimensionamiento" },
  architecture: { en: "Architecture",        pt: "Arquitetura",       es: "Arquitectura" },
  restart:      { en: "Restart walkthrough", pt: "Reiniciar apresentação", es: "Reiniciar recorrido" },
  play:         { en: "Play walkthrough",    pt: "Reproduzir apresentação", es: "Reproducir recorrido" },
  pause:        { en: "Pause walkthrough",   pt: "Pausar apresentação", es: "Pausar recorrido" },
  theme:        { en: "Toggle theme",        pt: "Alternar tema",     es: "Cambiar tema" },
  exportPng:    { en: "Download PNG",         pt: "Baixar PNG",        es: "Descargar PNG" },
  collapse:     { en: "Collapse",            pt: "Recolher",          es: "Contraer" },
  expand:       { en: "Expand",              pt: "Expandir",          es: "Expandir" },
  language:     { en: "Language",            pt: "Idioma",            es: "Idioma" },
};

/** Native display name for a language chip (built-ins; any other code upper-cases). */
export const LANG_LABEL: Record<string, string> = { en: "EN", pt: "PT", es: "ES", fr: "FR", de: "DE" };

// Author-supplied chrome overrides let ANY language be fully localized, not just
// the en/pt/es baked in above: e.g. uiStrings = { cost: { ja: "料金見積もり" }, … }.
// Resolution order per (key, lang): author override → built-in table → English.
export type UIStrings = Partial<Record<UIKey, Record<string, string>>>;

/** Build a `ui(key, lang)` resolver, layering author overrides over the built-ins. */
export function makeUi(overrides?: UIStrings): (key: UIKey, lang: Lang) => string {
  return (key, lang) => {
    const o = overrides?.[key];
    if (o && o[lang] != null) return o[lang];
    const row = UI[key];
    return row[lang] ?? row.en;
  };
}

/** Default resolver (no author overrides) — built-in table with English fallback. */
export function ui(key: UIKey, lang: Lang): string {
  const row = UI[key];
  return row[lang] ?? row.en;
}

/** Build a language-label resolver: author `langLabels` → built-in → UPPERCASE. */
export function makeLangLabel(labels?: Record<string, string>): (l: string) => string {
  return (l) => labels?.[l] ?? LANG_LABEL[l] ?? (l || "").toUpperCase();
}
