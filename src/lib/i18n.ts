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
type UIKey = "iac" | "pricing" | "architecture" | "restart" | "play" | "pause" | "theme" | "collapse" | "expand" | "language" | "cost";
const UI: Record<UIKey, Record<string, string>> = {
  cost:         { en: "Cost estimate",       pt: "Estimativa de custo", es: "Estimación de costo" },
  iac:          { en: "Configuration (IaC)", pt: "Configuração (IaC)", es: "Configuración (IaC)" },
  pricing:      { en: "Cost / sizing",       pt: "Custo / dimensionamento", es: "Costo / dimensionamiento" },
  architecture: { en: "Architecture",        pt: "Arquitetura",       es: "Arquitectura" },
  restart:      { en: "Restart walkthrough", pt: "Reiniciar apresentação", es: "Reiniciar recorrido" },
  play:         { en: "Play walkthrough",    pt: "Reproduzir apresentação", es: "Reproducir recorrido" },
  pause:        { en: "Pause walkthrough",   pt: "Pausar apresentação", es: "Pausar recorrido" },
  theme:        { en: "Toggle theme",        pt: "Alternar tema",     es: "Cambiar tema" },
  collapse:     { en: "Collapse",            pt: "Recolher",          es: "Contraer" },
  expand:       { en: "Expand",              pt: "Expandir",          es: "Expandir" },
  language:     { en: "Language",            pt: "Idioma",            es: "Idioma" },
};

/** Native display name for a language chip. */
export const LANG_LABEL: Record<string, string> = { en: "EN", pt: "PT", es: "ES", fr: "FR", de: "DE" };

/** Look up a fixed UI-chrome string for the active language (English fallback). */
export function ui(key: UIKey, lang: Lang): string {
  const row = UI[key];
  return row[lang] ?? row.en;
}
