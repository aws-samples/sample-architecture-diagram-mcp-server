// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Language handling for the interactive HTML diagram.
//
// Two layers:
//  1. CONTENT (author-supplied: titles, bodies, bullets, roles, labels…) is
//     resolved via `tr()` — a value is a plain string OR a { <lang>: string }
//     map, e.g. { en: "Overview", pt: "Visão geral" }.
//  2. UI CHROME (fixed strings the components render themselves: modal section
//     headings, toolbar tooltips) — the UI_STRINGS table.
//
// Both now live in @aws-sample-live-diagram/core (single source of truth, also
// consumed by the slides deck); this file re-exports them with the MCP's types.
import { UI_STRINGS, makeUi as coreMakeUi, ui as coreUi } from "@aws-sample-live-diagram/core";

export { tr, LANG_LABEL, makeLangLabel } from "@aws-sample-live-diagram/core";

export type Lang = string;
export type UIKey = keyof typeof UI_STRINGS;
export type UIStrings = Partial<Record<UIKey, Record<string, string>>>;

export const makeUi: (overrides?: UIStrings) => (key: UIKey, lang: Lang) => string = coreMakeUi;
export const ui: (key: UIKey, lang: Lang) => string = coreUi;
