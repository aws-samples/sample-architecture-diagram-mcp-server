// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The self-contained HTML app is now a thin adapter over the shared
// @aws-live-diagram/core LiveDiagram — the SAME component the slides deck
// renders with, so the generated HTML matches that visual language (severed ✕
// edges, edge pills, cardKit walkthrough, node/group/edge renderers).
//
// The MCP injects its own pieces:
//   • McpIcon — resolves icons via window.__ICONS__ (base64-inlined) with the
//     MCP's selective monochrome filter (no *_Dark two-image swap);
//   • the '--*' CSS var namespace + light/dark theme it owns itself (chrome=true,
//     theme='self' → the ZoomBar dock drives play/zoom/theme/language);
//   • the UI-chrome i18n table (ui / LANG_LABEL) for the dock + node modal.
import { useState } from 'react';
import { LiveDiagram } from '@aws-live-diagram/core/react';
import { HORIZONTAL_GEOMETRY } from '@aws-live-diagram/core';
import { makeUi, makeLangLabel } from '@/lib/i18n';
import { McpIcon } from './McpIcon';
import { TabShell } from './TabShell';
import { TAB_STYLE } from './tabStyle';

interface Props {
  data: {
    title?: any;
    subtitle?: any;
    services?: any[];
    connections?: any[];
    groups?: any[];
    direction?: string;
    lang?: string;
    languages?: string[];
    uiStrings?: Record<string, Record<string, string>>;
    langLabels?: Record<string, string>;
    steps?: any[];
    stepFocus?: boolean;
    stepZoom?: boolean;
    flowDots?: boolean;
    flowPeriod?: number;
    // Multi-view document: a tab rail + one panel per view (architecture / the
    // animated UML sequence / prose). Absent => classic single-canvas diagram.
    tabs?: any[];
  };
}

// MCP node look: horizontal card (icon left, label right), '--*' vars, arrow
// marker id, and the LCA edge re-anchor OFF (this build ships elkjs that
// honours edgeCoords:ROOT).
const CHROME_STYLE = `
  html, body, #root { height: 100%; margin: 0; }
  .ld-frame { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .ld-frame.light { --bg: #f8fafc; --surface: #ffffff; --node-bg: #ffffff; --txt: #1e293b; --txt-muted: #64748b; --border: rgba(0,0,0,0.06); --icon-filter: none; --card-bg: rgba(255,255,255,0.96); --card-solid: #ffffff; --dot: rgba(0,0,0,0.12); --chip-bg: rgba(100,116,139,0.1); background: var(--bg); color: var(--txt); }
  .ld-frame.dark { --bg: #0f1117; --surface: #1a1d27; --node-bg: #1e2230; --txt: #e2e8f0; --txt-muted: #94a3b8; --border: rgba(255,255,255,0.06); --icon-filter: brightness(0) invert(1); --card-bg: rgba(24,28,40,0.94); --card-solid: #181c28; --dot: rgba(255,255,255,0.12); --chip-bg: rgba(148,163,184,0.14); background: var(--bg); color: var(--txt); }
  .ld-frame .react-flow__node-group { pointer-events: none; }
  .ld-frame .react-flow__renderer, .ld-frame .react-flow { background: transparent; }
  /* Fluid fold: nodes/containers glide to their new spot when a group collapses
     or expands (re-layout), instead of snapping. */
  .ld-frame .react-flow__node { transition: transform .5s cubic-bezier(.22,.61,.36,1), width .5s cubic-bezier(.22,.61,.36,1), height .5s cubic-bezier(.22,.61,.36,1); }
  .ld-frame.react-flow__pane-moving .react-flow__node { transition: none; }
  /* Pulsing glow on the walkthrough play button before the tour has started,
     to invite the viewer to press it. */
  @keyframes ld-play-pulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(255,153,0,0.55); }
    50%     { box-shadow: 0 0 0 7px rgba(255,153,0,0); }
  }
  .ld-frame .ld-play-attention { animation: ld-play-pulse 1.6s ease-in-out infinite; }

  /* ── Embedded cost panel (AWS-only) ── */
  .ld-frame .ld-cost-panel {
    position: absolute; top: 16px; right: 16px; z-index: 45; width: 300px; max-width: calc(100vw - 32px);
    max-height: calc(100% - 32px); overflow: auto;
    background: var(--card-bg); backdrop-filter: blur(12px);
    border: 1px solid var(--border); border-radius: 14px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.18);
    padding: 16px 16px 14px; font-size: 13px; color: var(--txt);
  }
  .ld-frame .ld-cost-hero { border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 10px; }
  .ld-frame .ld-cost-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--txt-muted); }
  .ld-frame .ld-cost-total { font-size: 30px; font-weight: 800; line-height: 1.1; margin-top: 4px; color: var(--txt); }
  .ld-frame .ld-cost-per { font-size: 14px; font-weight: 600; color: var(--txt-muted); margin-left: 2px; }
  .ld-frame .ld-cost-annual { font-size: 13px; color: var(--txt-muted); margin-top: 2px; }
  .ld-frame .ld-cost-note { font-size: 11.5px; color: var(--txt-muted); margin-top: 6px; font-style: italic; }
  .ld-frame .ld-cost-rows { display: flex; flex-direction: column; gap: 2px; }
  .ld-frame .ld-cost-row { border-top: 1px solid var(--border); }
  .ld-frame .ld-cost-row:first-child { border-top: none; }
  .ld-frame .ld-cost-row-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 7px 0; cursor: pointer; list-style: none; }
  .ld-frame .ld-cost-row-head::-webkit-details-marker { display: none; }
  .ld-frame .ld-cost-row-label { display: flex; flex-direction: column; min-width: 0; }
  .ld-frame .ld-cost-row-svc { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ld-frame .ld-cost-caret { display: inline-block; font-size: 9px; color: var(--txt-muted); margin-right: 5px; transition: transform .15s; }
  .ld-frame details[open] .ld-cost-caret { transform: rotate(90deg); }
  .ld-frame .ld-cost-row-desc { font-size: 11px; color: var(--txt-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ld-frame .ld-cost-row-val { font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
  .ld-frame .ld-cost-config { margin: 0 0 8px; padding: 4px 0 4px 14px; list-style: none; display: flex; flex-direction: column; gap: 3px; }
  .ld-frame .ld-cost-config li { font-size: 11px; color: var(--txt-muted); position: relative; padding-left: 10px; line-height: 1.35; }
  .ld-frame .ld-cost-config li::before { content: "·"; position: absolute; left: 0; }
  .ld-frame .ld-cost-cta {
    display: block; margin-top: 12px; padding: 9px 12px; border-radius: 9px; text-align: center;
    background: #FF9900; color: #111; font-weight: 700; font-size: 12.5px; text-decoration: none;
  }
  .ld-frame .ld-cost-cta:hover { filter: brightness(1.05); }
  .ld-frame .ld-cost-disclaimer { font-size: 10.5px; color: var(--txt-muted); margin: 8px 0 0; line-height: 1.35; }
`;

export function StandaloneApp({ data }: Props) {
  // The language switch is host-driven: LiveDiagram renders the EN/PT buttons but
  // delegates the active language to the host via lang + onLangChange, so we hold
  // it in state here and re-render the whole diagram in the picked language.
  const [lang, setLang] = useState(data.lang || 'en');
  // Chrome i18n resolvers, layering any author-supplied overrides over the
  // built-in en/pt/es table — so a diagram authored in any language (ja, fr, …)
  // can fully localize the toolbar/modal, not just its content.
  const uiResolver = makeUi(data.uiStrings as any);
  const langLabel = makeLangLabel(data.langLabels);
  // In multi-tab mode the SHELL owns the theme (the sequence/doc panels live
  // outside the diagram's own .ld-frame, so the vars must come from an ancestor),
  // and LiveDiagram runs in its controlled-theme mode: `dark` + onThemeChange, so
  // its dock's theme button still flips both.
  const tabs = data.tabs || [];
  const tabbed = tabs.length > 1;
  const [dark, setDark] = useState(false);
  const diagram = (
    <LiveDiagram
      {...(tabbed ? { dark, onThemeChange: setDark } : {})}
        data={data}
        lang={lang}
        onLangChange={setLang}
        languages={data.languages || []}
        direction={(data.direction as any) || 'LR'}
        steps={data.steps}
        startStep={(data as any).startStep}
        startCardScale={(data as any).startCardScale}
        stepFocus={data.stepFocus}
        stepZoom={data.stepZoom}
        flowDots={data.flowDots}
        title={data.title}
        subtitle={data.subtitle}
        // MCP wiring
        Icon={McpIcon}
        nodeLayout="horizontal"
        geometry={HORIZONTAL_GEOMETRY}
        markerId="arrow"
        reanchorEdges={false}
        control="auto"
        chrome
        nodeModal={false}
        theme="self"
        zoomOnScroll
        collapsible={(data as any).collapsible !== false}
        defaultCollapsed={(data as any).defaultCollapsed || []}
        ui={uiResolver}
        langLabel={langLabel}
      />
  );
  return (
    <>
      <style>{CHROME_STYLE}</style>
      {tabbed ? (
        <>
          <style>{TAB_STYLE}</style>
          <div className={`ld-frame ld-shell ${dark ? 'dark' : 'light'}`}>
            <TabShell tabs={tabs} lang={lang} ui={uiResolver} ArchSlot={() => diagram} />
          </div>
        </>
      ) : diagram}
    </>
  );
}
