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
import { LiveDiagram } from '@aws-live-diagram/core/react';
import { HORIZONTAL_GEOMETRY } from '@aws-live-diagram/core';
import { ui, LANG_LABEL } from '@/lib/i18n';
import { McpIcon } from './McpIcon';

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
    steps?: any[];
    stepFocus?: boolean;
    stepZoom?: boolean;
    flowDots?: boolean;
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
`;

export function StandaloneApp({ data }: Props) {
  return (
    <>
      <style>{CHROME_STYLE}</style>
      <LiveDiagram
        data={data}
        lang={data.lang || 'en'}
        languages={data.languages || []}
        direction={(data.direction as any) || 'LR'}
        steps={data.steps}
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
        ui={ui}
        langLabel={(l: string) => LANG_LABEL[l] || l.toUpperCase()}
      />
    </>
  );
}
