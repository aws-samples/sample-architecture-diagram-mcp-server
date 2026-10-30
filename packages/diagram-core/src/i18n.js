// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Content language resolver. An author value is a plain string OR a per-language
// map, e.g. { en: "Overview", pt: "Visão geral" }.

/** Resolve an author value that may be a plain string or a per-language map.
 *  Fallback order: lang → `fallback` (default "en") → first available value → "".
 */
export function tr(val, lang, fallback = "en") {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") return val[lang] ?? val[fallback] ?? Object.values(val)[0] ?? "";
  return String(val);
}

/** Every language variant of an author value, space-joined. For search haystacks,
 *  where a match in ANY offered language should count regardless of which one is
 *  currently displayed. */
export function trAll(val) {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") return Object.values(val).filter((v) => typeof v === "string").join(" ");
  return String(val);
}

/** Back-compat alias for the slides `i18n(val, lang)` call site: same intent,
 *  with the historical en→pt fallback chain. Prefer `tr` in new code. */
export const i18n = (val, lang) => {
  if (val == null) return "";
  if (typeof val === "string") return val;
  return val[lang] || val.en || val.pt || "";
};

// ── UI chrome ─────────────────────────────────────────────────────────────
// Fixed strings the renderers draw themselves (modal headings, toolbar and
// player tooltips), keyed by language. Shared by the MCP's HTML and any app
// using the core components. Add a language by adding a column; unknown
// languages fall back to English. Keep keys stable — components look them up.
export const UI_STRINGS = {
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
  shareCard:    { en: "Share card (1200×630)", pt: "Cartão de compartilhamento (1200×630)", es: "Tarjeta para compartir (1200×630)" },
  collapse:     { en: "Collapse",            pt: "Recolher",          es: "Contraer" },
  expand:       { en: "Expand",              pt: "Expandir",          es: "Expandir" },
  language:     { en: "Language",            pt: "Idioma",            es: "Idioma" },
  prev:         { en: "Previous step",       pt: "Passo anterior",    es: "Paso anterior" },
  next:         { en: "Next step",           pt: "Próximo passo",     es: "Paso siguiente" },
  fit:          { en: "Fit to view",         pt: "Ajustar à tela",    es: "Ajustar a la vista" },
  zoomIn:       { en: "Zoom in",             pt: "Aproximar",         es: "Acercar" },
  zoomOut:      { en: "Zoom out",            pt: "Afastar",           es: "Alejar" },
  searchPlaceholder: { en: "search participants…", pt: "buscar participantes…", es: "buscar participantes…" },
  hideControls: { en: "Hide controls",       pt: "Ocultar controles", es: "Ocultar controles" },
  showControls: { en: "Show controls",       pt: "Mostrar controles", es: "Mostrar controles" },
};

/** Native display name for a language chip (built-ins; any other code upper-cases). */
export const LANG_LABEL = { en: "EN", pt: "PT", es: "ES", fr: "FR", de: "DE" };

// Author-supplied chrome overrides let ANY language be fully localized, not just
// the en/pt/es baked in above: e.g. uiStrings = { cost: { ja: "料金見積もり" }, … }.
// Resolution order per (key, lang): author override → built-in table → English.
/** Build a `ui(key, lang)` resolver, layering author overrides over the built-ins. */
export function makeUi(overrides) {
  return (key, lang) => {
    const o = overrides?.[key];
    if (o && o[lang] != null) return o[lang];
    return ui(key, lang);
  };
}

/** Default resolver (no author overrides) — built-in table with English fallback.
 *  An UNKNOWN key returns "" instead of throwing, so a component that asks for a
 *  key this table does not carry falls back to its own inline literal. */
export function ui(key, lang) {
  const row = UI_STRINGS[key];
  if (!row) return "";
  return row[lang] ?? row.en;
}

/** Build a language-label resolver: author `langLabels` → built-in → UPPERCASE. */
export function makeLangLabel(labels) {
  return (l) => labels?.[l] ?? LANG_LABEL[l] ?? (l || "").toUpperCase();
}
