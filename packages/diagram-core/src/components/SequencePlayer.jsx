// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// <SequencePlayer> — the animated UML sequence player of
// @aws-sample-live-diagram/core: one renderer for the MCP (the sequence tab of a
// multi-tab diagram document) and for downstream apps (the slides deck's
// SequenceDiagram block, its editor and read-only viewer).
//
// A React port of the MCP's published standalone sequence player
// (lib/sequence-template.html), on the same schema (lib/sequence-schemas.js)
// and the shared player palette/tokens (tones.js, playerTheme.js).
//
// The port is FAITHFUL: identical geometry (COL/X0/ROW/HEAD_H…), the same UML
// semantics (sync/async/reply arrows, «create» + destroy ✕, found/lost boundary
// dots, stereotypes, auto AND explicit activation bars, alt/opt/loop/par/…
// fragments with dividers, participant grouping boxes), the same narration card
// (badge, title, party chips, flow, markdown description, proof link, code) and
// the same step-following camera with pinned headers plus SVG/PNG export.
// What changes is HOW it is expressed: the imperative createElementNS code
// becomes a pure layout pass (useMemo) + a declarative render, and the arrow
// draw-on uses SVG `pathLength` normalization instead of measuring
// getTotalLength() at build time.
//
// Host contract:
//   seq                 the sequence document ({participants, events, …})
//   cur / onCur         controlled step (index of the current event; -1 = no
//                       event yet, null = overview: everything shown, nothing
//                       dimmed). Omit `cur` and the player keeps its own step,
//                       autoplay and ←/→/space/'/' keys (the MCP's behaviour).
//   iconUrl(ref)        resolve a participant `icon` ref to a URL (or null);
//                       iconFilter(ref) an optional CSS filter for it
//   controls, card      show the pill toolbar / the narration card (default on)
//   theme               'light' | 'dark' to force; else a `.dark` ancestor (or
//                       the MCP's .ld-frame.dark) decides
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { tr } from '../i18n.js';
import { PLAYER_TONES as TONE, AWS_ORANGE } from '../tones.js';
import { playerThemeCss } from '../playerTheme.js';
import * as cardKit from './cardKit.jsx';

// Icon resolution is the host's (the MCP inlines data URIs, the deck serves a
// library); the leaf components read it from here.
// Player styles, scoped to .ld-seqp (lifted from the standalone template).
const SEQ_CSS = `
  /* ── animated UML sequence panel ──
     Lifted from the published standalone player (lib/sequence-template.html) and
     scoped to .ld-seqp so the class names in SequenceDiagram.tsx stay identical
     to the original renderer's. Tokens: the shared player theme (playerTheme.js);
     inside the MCP's .ld-frame the base chrome tokens come from the frame. */
  ${playerThemeCss('.ld-seqp', '.ld-seqp[data-theme="dark"],:where(.dark) .ld-seqp:not([data-theme="light"])')}
  .ld-frame .ld-seqp { --bg: inherit; --txt: inherit; --txt-muted: inherit; --border: inherit; --card-bg: inherit; --dot: inherit; --chip-bg: inherit; --pill-bg: inherit; }

  .ld-seqp { position: relative; flex: 1; min-width: 0; min-height: 0; overflow: hidden; background: var(--bg); }
  .ld-seqp .sq-stage { position: absolute; inset: 0; overflow: hidden; cursor: grab; touch-action: none; }
  .ld-seqp .sq-stage.grabbing { cursor: grabbing; }
  .ld-seqp .sq-stage > svg { transform-origin: 0 0; display: block; }
  .ld-seqp svg text { font-family: inherit; }

  /* lifelines, headers, actors */
  .ld-seqp .lifeline { stroke: var(--txt-muted); stroke-width: 1.2; stroke-dasharray: 3 4; opacity: .5; transition: opacity .3s; }
  .ld-seqp .phead, .ld-seqp .actor { transition: opacity .3s; }
  .ld-seqp .phead rect { fill: var(--navy); stroke: var(--orange); stroke-width: 1.4; transition: fill .25s, stroke .25s; }
  .ld-seqp .phead text { fill: #fff; font-size: 11px; font-weight: 600; }
  .ld-seqp .phead .sub { fill: #cdd6e0; font-size: 9.5px; }
  .ld-seqp .phead .stereo { fill: #aab6c4; font-size: 9.5px; font-style: italic; }
  .ld-seqp .phead.hot rect { fill: var(--orange); }
  .ld-seqp .phead.iconhead rect { fill: #fff; stroke: var(--navy); }
  .ld-seqp .phead.iconhead text { fill: var(--navy); }
  .ld-seqp .phead.iconhead .sub, .ld-seqp .phead.iconhead .stereo { fill: #5f6b7a; }
  .ld-seqp .phead.iconhead.hot rect { fill: #fff3e0; stroke: var(--orange); }
  .ld-seqp .phead.searchhit rect { stroke: var(--info); stroke-width: 2.5px; }
  .ld-seqp .actor line, .ld-seqp .actor circle { stroke: var(--orange); stroke-width: 1.8; fill: none; }
  .ld-seqp .actor .alabel { fill: var(--txt); font-size: 11px; font-weight: 600; stroke: none; }
  .ld-seqp .actor.searchhit circle { stroke: var(--info); stroke-width: 2.5px; }

  /* activation bars + destruction */
  .ld-seqp .exec { transition: opacity .3s; }
  .ld-seqp .exec rect { fill: color-mix(in srgb, var(--info) 20%, var(--card-bg)); stroke: var(--navy); stroke-width: 1; transition: fill .25s, stroke .25s; }
  .ld-seqp .exec.hot rect { fill: color-mix(in srgb, var(--orange) 22%, var(--card-bg)); stroke: var(--orange); }
  .ld-seqp .destroy { transition: opacity .3s; }
  .ld-seqp .destroy line { stroke: var(--danger); stroke-width: 2.6; }
  .ld-seqp .bdot { fill: var(--msg); }

  /* events */
  .ld-seqp .evt { opacity: 0; transition: opacity .3s; }
  .ld-seqp .evt.shown { opacity: 1; }
  .ld-seqp .evt .line { stroke: var(--msg); stroke-width: 2; fill: none; }
  /* pathLength="1" on the <path> normalizes the dash geometry, so one dash of
     length 1 = the whole line and the offset animates the draw-on. */
  .ld-seqp .evt.msg .line { stroke-dasharray: 1; stroke-dashoffset: 1; }
  .ld-seqp .evt.msg.shown .line { stroke-dashoffset: 0; transition: stroke-dashoffset .55s ease; }
  .ld-seqp .evt.ret .line { stroke: var(--ret); stroke-dasharray: 7 5; }
  .ld-seqp .evt .lbl { font-size: 11px; fill: var(--txt); opacity: 0; }
  .ld-seqp .evt.shown .lbl { opacity: 1; transition: opacity .3s .2s; }
  .ld-seqp .evt.active .line { stroke: var(--active, ${AWS_ORANGE}); stroke-width: 3; filter: drop-shadow(0 0 4px rgba(255,153,0,.6)); }
  .ld-seqp .evt.note rect { fill: #fff3e0; stroke: var(--orange); stroke-width: 1.2; }
  .ld-seqp .evt.note text { font-size: 11px; fill: #7a4e00; font-weight: 600; }

  /* combined fragments + participant groups */
  .ld-seqp .frame { transition: opacity .3s; }
  .ld-seqp .frame rect { fill: color-mix(in srgb, var(--msg) 6%, transparent); stroke: var(--txt-muted); stroke-dasharray: 4 3; }
  .ld-seqp .frame .flabel { fill: #fff; font-size: 10.5px; font-weight: 700; }
  .ld-seqp .frame .flabelbg { stroke: none; stroke-dasharray: none; }
  .ld-seqp .frame .elsediv { stroke: var(--txt-muted); stroke-dasharray: 4 3; }
  .ld-seqp .frame .elsetxt { fill: var(--txt-muted); font-size: 10.5px; font-style: italic; }
  .ld-seqp .grp rect { fill: color-mix(in srgb, var(--txt) 3%, transparent); stroke-width: 1.4; }
  .ld-seqp .grp .gtabbg { stroke: none; }
  .ld-seqp .grp .gtab { font-size: 11px; font-weight: 700; fill: #fff; }

  /* narration card — starts BELOW the pinned participant headers (they stay put
     while the band scrolls, so a card at top:14 would sit on top of them). */
  .ld-seqp .sq-card {
    position: absolute; top: 92px; left: 14px; width: 340px; max-height: calc(100% - 174px);
    overflow: auto; padding: 12px 14px 11px; border: 1px solid var(--border); border-radius: 13px;
    background: var(--card-bg); backdrop-filter: blur(9px); box-shadow: 0 8px 26px rgba(0,0,0,.14);
    font-size: 12.5px; z-index: 5;
  }
  .ld-seqp .sq-card .rail { display: flex; gap: 3px; margin-bottom: 9px; }
  .ld-seqp .sq-card .rail i { height: 5px; flex: 1; border-radius: 4px; background: var(--dot); transition: background .25s; }
  .ld-seqp .sq-card .rail i.on { background: var(--orange); }
  .ld-seqp .sq-card .cardhead { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 18px; }
  .ld-seqp .sq-card .counter { font-size: 11px; color: var(--txt-muted); font-variant-numeric: tabular-nums; }
  .ld-seqp .sq-card .badge {
    display: inline-block; padding: 1px 7px; border-radius: 6px;
    font-size: 9.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase;
  }
  .ld-seqp .b-gate { color: var(--warn); background: color-mix(in srgb, var(--warn) 15%, transparent); }
  .ld-seqp .b-keyless { color: var(--success); background: color-mix(in srgb, var(--success) 15%, transparent); }
  .ld-seqp .b-async, .ld-seqp .b-sync, .ld-seqp .b-phase { color: var(--info); background: color-mix(in srgb, var(--info) 15%, transparent); }
  .ld-seqp .b-fail { color: var(--danger); background: color-mix(in srgb, var(--danger) 15%, transparent); }
  .ld-seqp .sq-card .title { margin: 5px 0 6px; font-size: 13.5px; font-weight: 700; line-height: 1.35; }
  .ld-seqp .sq-card .title .stepnum {
    display: inline-block; min-width: 19px; margin-right: 7px; padding: 0 5px; border-radius: 6px;
    background: var(--orange); color: #16191f; font-size: 11px; font-weight: 800; text-align: center;
    vertical-align: 1px; font-variant-numeric: tabular-nums;
  }
  .ld-seqp .sq-card .parties { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-bottom: 7px; }
  .ld-seqp .pchip {
    display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: 7px;
    border: 1px solid var(--border); background: var(--pill-bg);
    font-size: 10.5px; font-weight: 600; color: var(--txt-muted); transition: border-color .2s, color .2s;
  }
  .ld-seqp .pchip.on { border-color: var(--orange); color: var(--txt); }
  .ld-seqp .pchip.bdotc { color: var(--msg); font-size: 9px; padding: 2px 6px; }
  .ld-seqp .pico { width: 13px; height: 13px; object-fit: contain; }
  .ld-seqp svg.pico { fill: none; stroke: currentColor; stroke-width: 1.4; }
  .ld-seqp .parr { color: var(--txt-muted); font-size: 11px; }
  .ld-seqp .sq-card .flow {
    margin-bottom: 6px; font-size: 10.5px; font-weight: 700; letter-spacing: .04em;
    text-transform: uppercase; color: var(--orange);
  }
  .ld-seqp .sq-card .desc { color: var(--txt); line-height: 1.5; }
  .ld-seqp .sq-card .desc code, .ld-seqp .sq-card .proof code {
    padding: 1px 4px; border-radius: 4px; background: var(--chip-bg);
    font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 11px;
  }
  .ld-seqp .sq-card .proof { margin-top: 7px; font-size: 11px; }
  .ld-seqp .sq-card .proof a { color: var(--info); text-decoration: none; }
  .ld-seqp .sq-card .proof a:hover { text-decoration: underline; }
  .ld-seqp .sq-card .codeblk { margin-top: 8px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .ld-seqp .sq-card .codeblk .hd {
    padding: 4px 8px; font-size: 9.5px; font-weight: 800; letter-spacing: .07em;
    text-transform: uppercase; color: var(--txt-muted); background: var(--chip-bg);
  }
  .ld-seqp .sq-card .codeblk pre {
    margin: 0; padding: 8px; max-height: 160px; overflow: auto;
    font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 10.5px; line-height: 1.45;
  }
  .ld-seqp .sq-card .legend {
    display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; padding-top: 9px;
    border-top: 1px solid var(--border); font-size: 10px; color: var(--txt-muted);
  }
  .ld-seqp .sq-card .legend span { display: inline-flex; align-items: center; gap: 4px; }

  /* pill toolbar */
  .ld-seqp .sq-pill {
    position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 5px; max-width: calc(100% - 28px);
    padding: 6px 9px; border: 1px solid var(--border); border-radius: 13px;
    background: var(--pill-bg); backdrop-filter: blur(9px); box-shadow: 0 6px 22px rgba(0,0,0,.16);
    overflow-x: auto; z-index: 6;
  }
  .ld-seqp .sq-pill .pilltitle { min-width: 0; padding: 0 6px 0 3px; }
  .ld-seqp .sq-pill .pilltitle .t { font-size: 12px; font-weight: 700; white-space: nowrap; }
  .ld-seqp .sq-pill .pilltitle .s { font-size: 10px; color: var(--txt-muted); white-space: nowrap; }
  .ld-seqp .sq-pill .sep { width: 1px; height: 18px; flex: 0 0 1px; background: var(--border); }
  .ld-seqp .pbtn {
    width: 28px; height: 28px; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid var(--border); border-radius: 8px; background: transparent; color: var(--txt);
    font: inherit; font-size: 10.5px; font-weight: 700; cursor: pointer;
    transition: background .15s, border-color .15s, color .15s, opacity .15s;
  }
  .ld-seqp .pbtn.wide { width: auto; padding: 0 9px; }
  .ld-seqp .pbtn svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; }
  .ld-seqp .pbtn:hover:not(:disabled) { background: var(--chip-bg); }
  .ld-seqp .pbtn:disabled { opacity: .34; cursor: default; }
  .ld-seqp .pbtn.on { border-color: var(--orange); color: var(--orange); }
  .ld-seqp .pbtn.play { background: var(--orange); border-color: var(--orange); color: #111; }
  .ld-seqp .pbtn.play.attention { animation: ld-seq-pulse 1.9s ease-in-out infinite; }
  @keyframes ld-seq-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,153,0,.5); } 50% { box-shadow: 0 0 0 7px rgba(255,153,0,0); } }
  .ld-seqp .spdwrap { display: inline-flex; align-items: center; gap: 6px; font-size: 10.5px; color: var(--txt-muted); }
  .ld-seqp .spdwrap input { width: 78px; accent-color: var(--orange); }
  .ld-seqp .sq-expand {
    position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%);
    width: 34px; height: 24px; border: 1px solid var(--border); border-radius: 9px;
    background: var(--pill-bg); color: var(--txt-muted); cursor: pointer; z-index: 6;
  }

  /* participant search */
  .ld-seqp .sq-search {
    position: absolute; top: 14px; right: 14px; display: none; align-items: center; gap: 6px;
    padding: 5px 9px; border: 1px solid var(--border); border-radius: 10px;
    background: var(--pill-bg); backdrop-filter: blur(9px); z-index: 6;
  }
  .ld-seqp .sq-search.on { display: flex; }
  .ld-seqp .sq-search input {
    width: 180px; border: none; outline: none; background: transparent;
    color: var(--txt); font: inherit; font-size: 12px;
  }
  .ld-seqp .sq-search .cnt { font-size: 10.5px; color: var(--txt-muted); font-variant-numeric: tabular-nums; min-width: 26px; }

  @media (max-width: 760px) {
    .ld-seqp .sq-card { width: auto; right: 14px; max-height: 40%; }
    .ld-seqp .sq-pill { bottom: 10px; }
  }

`;

const IconCtx = createContext({ url: () => null, filter: () => 'none' });

const BADGE_TXT = {
  gate: '◆ GATE', keyless: '● keyless', async: 'async', sync: 'sync', phase: 'PHASE', fail: '✕ fail',
};

// ── proof refs ──────────────────────────────────────────────────────────────
// A step's `proof` is either free text (inline markdown) or a structured,
// verifiable source reference {repo,path,ref,lines,url,text} rendered as a link
// to the exact file@ref#lines — that is what makes a walkthrough auditable.
function lineFrag(lines) {
  if (lines == null) return '';
  if (Array.isArray(lines)) return lines.length > 1 ? `#L${lines[0]}-L${lines[1]}` : `#L${lines[0]}`;
  const span = String(lines).match(/(\d+)\s*[-–]\s*(\d+)/);
  if (span) return `#L${span[1]}-L${span[2]}`;
  const one = String(lines).match(/\d+/);
  return one ? `#L${one[0]}` : '';
}

// Only http(s)/mailto proof links become anchors: React escapes the attribute,
// but a `javascript:` URL still runs on click in a file the reader just opened.
const safeUrl = (u) => (/^(https?:|mailto:)/i.test(String(u || '').trim()) ? String(u).trim() : '');

function ProofLine({ proof }) {
  if (proof == null) return null;
  if (typeof proof === 'string') return <>{cardKit.mdInline(proof)}</>;
  const path = String(proof.path || ''), frag = lineFrag(proof.lines);
  let url = proof.url || '';
  if (!url && proof.repo && path) {
    url = `${String(proof.repo).replace(/\/+$/, '')}/blob/${proof.ref || 'main'}/${path.replace(/^\/+/, '')}${frag}`;
  }
  const label = proof.text || (path ? path + frag.replace('#L', ':').replace('-L', '-') : url);
  url = safeUrl(url);
  if (!url) return <>{cardKit.mdInline(String(label || ''))}</>;
  return <a href={url} target="_blank" rel="noopener noreferrer"><code>{label}</code></a>;
}

// Longest text a value can render, across EVERY offered language: a { en, pt }
// label must not overlap its neighbour after a language switch either.
function textLen(v) {
  if (v == null) return 0;
  if (typeof v === 'object') return Math.max(0, ...Object.values(v).map(s => String(s ?? '').length));
  return String(v).length;
}

/** Width of a participant's header box — same formula Head() uses to draw it. */
function headBoxW(p) {
  return Math.max(96, textLen(p?.label) * 6.4 + 18, textLen(p?.sub) * 5.6 + 18, textLen(p?.stereotype) * 5.6 + 22);
}

// ── layout (pure) ───────────────────────────────────────────────────────────
// Everything the SVG needs, derived once per sequence: column/row geometry,
// instance create/destroy rows, activation bars, fragment boxes, group boxes and
// one descriptor per event. Mirrors the layout pass of sequence-template.html.
function buildLayout(seq) {
  const P = seq?.participants || [];
  const EV = seq?.events || [];
  const FRAGS = seq?.fragments || [];
  const GROUPS = seq?.groups || [];

  const idx = {};
  P.forEach((p, i) => { if (p?.id != null) idx[p.id] = i; });
  const evIndexById = {};
  EV.forEach((e, i) => { if (e?.id != null) evIndexById[e.id] = i; });

  const HAS_GROUPS = GROUPS.length > 0;
  const HAS_STEREO = P.some(p => p.stereotype && !p.actor);
  // Column pitch has to clear the WIDEST header box, or two long labels
  // ("Developer Hub (ns rhdh)" next to "Keycloak (fonte-da-verdade)") overlap.
  // Measured over every offered language, so a language switch cannot break the
  // spacing either — `w` in Head() uses the same formula on the active language.
  const HEAD_W = Math.max(0, ...P.filter(p => !p?.actor).map(headBoxW));
  const COL = Math.max(150, Math.min(190, 1300 / Math.max(P.length, 1)), HEAD_W + 16);
  const X0 = 95, TOPPAD = HAS_GROUPS ? 26 : 0, HEAD_Y = 16 + TOPPAD;
  const HEAD_H = P.some(p => p.icon) ? (HAS_STEREO ? 64 : 58) : (HAS_STEREO ? 52 : 46);
  const LIFE_TOP = HEAD_Y + HEAD_H, ROW0 = LIFE_TOP + 52, ROW = 62;

  // Group gutter: like the architecture containers, two adjacent group boxes get
  // air between them instead of sharing an edge, so the columns are not a single
  // undifferentiated strip. Crossing a group boundary (or leaving/entering one)
  // shifts every column to its right by GUT.
  const GUT = 34;
  const groupOf = P.map(p => {
    const gi = GROUPS.findIndex((gr) => (gr?.participants || []).includes(p?.id));
    return gi < 0 ? null : gi;
  });
  const XS = [];
  let shift = 0;
  P.forEach((_, i) => {
    if (i > 0 && groupOf[i] !== groupOf[i - 1]) shift += GUT;
    XS.push(X0 + i * COL + shift);
  });
  const cx = (i) => (XS[i] != null ? XS[i] : X0 + i * COL);
  const W = (XS.length ? XS[XS.length - 1] : X0) + 95;
  const H = ROW0 + EV.length * ROW + 40;
  const rowY = (n) => ROW0 + n * ROW;

  // UML instance creation / destruction rows, per participant id.
  const createRow = {}, destroyRow = {};
  EV.forEach((e, n) => {
    if (e?.kind !== 'message') return;
    if (e.create && e.to != null) createRow[e.to] = n;
    if (e.destroy && e.to != null) destroyRow[e.to] = n;
  });
  const pStartStep = P.map(p => (createRow[p.id] != null ? createRow[p.id] : -1));
  const pEndStep = P.map(p => (destroyRow[p.id] != null ? destroyRow[p.id] : -1));
  // A created object's box sits ON the creating row; a destroyed one's lifeline
  // stops at the ✕ instead of running to the bottom.
  const headTopOf = (i) => (pStartStep[i] >= 0 ? rowY(pStartStep[i]) - HEAD_H / 2 : HEAD_Y);
  const lifeTopOf = (i) => (pStartStep[i] >= 0 ? rowY(pStartStep[i]) + HEAD_H / 2 : LIFE_TOP);
  const lifeBotOf = (i) => (pEndStep[i] >= 0 ? rowY(pEndStep[i]) : H - 24);

  // Which lifelines an event touches (a note spans `over`; a message is from→to
  // minus the boundary end of a found/lost message, which has no lifeline).
  const eventParticipants = (e) => {
    if (!e) return [];
    const s = new Set();
    if (e.kind === 'note') (e.over || []).forEach((o) => { if (idx[o] != null) s.add(idx[o]); });
    else {
      if (!e.found && idx[e.from] != null) s.add(idx[e.from]);
      if (!e.lost && idx[e.to] != null) s.add(idx[e.to]);
    }
    return [...s];
  };

  // Activation (execution) bars. Explicit mode as soon as ANY message carries
  // activate/deactivate (a stack per participant, leftovers closing at the end);
  // otherwise auto-derived — an incoming call stays active until its target
  // answers — then merged per column so overlapping runs become one bar.
  const acts = (() => {
    const explicit = EV.some(e => e?.kind === 'message' && (e.activate || e.deactivate));
    if (explicit) {
      const stacks = {}, out = [];
      EV.forEach((e, n) => {
        if (e?.kind !== 'message') return;
        if (e.activate && idx[e.to] != null) {
          const p = idx[e.to];
          (stacks[p] = stacks[p] || []).push({ p, from: n, to: n });
        }
        if (e.deactivate && idx[e.from] != null) {
          const st = stacks[idx[e.from]];
          if (st && st.length) { const a = st.pop(); a.to = n; out.push(a); }
        }
      });
      Object.values(stacks).forEach(st => st.forEach(a => { a.to = EV.length - 1; out.push(a); }));
      return out;
    }
    if (seq?.autoActivate === false) return [];
    const raw = [];
    EV.forEach((e, n) => {
      if (e?.kind !== 'message' || e.found || e.from === e.to) return;
      const p = idx[e.to];
      if (p == null) return;
      let end = n;
      for (let m = n + 1; m < EV.length; m++) {
        const e2 = EV[m];
        if (e2?.kind === 'message' && idx[e2.from] === p) { end = m; break; }
      }
      raw.push({ p, from: n, to: end });
    });
    const byP = {};
    raw.forEach(a => { (byP[a.p] = byP[a.p] || []).push(a); });
    const merged = [];
    Object.keys(byP).forEach(k => {
      let run = null;
      byP[+k].sort((a, b) => a.from - b.from).forEach(a => {
        if (run && a.from <= run.to) run.to = Math.max(run.to, a.to);
        else { run = { p: +k, from: a.from, to: a.to }; merged.push(run); }
      });
    });
    return merged;
  })();

  // Combined fragments: the horizontal span comes from the enclosed events.
  const frames = FRAGS.map((fr) => {
    const start = evIndexById[fr.startId], end = evIndexById[fr.endId];
    if (start == null || end == null) return null;
    const parts = new Set();
    for (let i = start; i <= end; i++) eventParticipants(EV[i]).forEach(p => parts.add(p));
    if (!parts.size) return null;
    const cols = [...parts];
    return {
      fr, start,
      color: TONE[fr.tone] || '#5f6b7a',
      xmin: cx(Math.min(...cols)) - 48,
      xmax: cx(Math.max(...cols)) + 48,
      y1: rowY(start) - 32,
      y2: rowY(end) + 22,
      dividers: (fr.dividers || [])
        .map((d) => ({ at: evIndexById[d.beforeId], label: d.label }))
        .filter((d) => d.at != null),
    };
  }).filter(Boolean);

  // Participant grouping boxes (PlantUML `box`), drawn behind the lifelines.
  const groupBoxes = GROUPS.map((gr) => {
    const cols = (gr.participants || []).map((id) => idx[id]).filter((v) => v != null);
    if (!cols.length) return null;
    const a = Math.min(...cols), b = Math.max(...cols);
    const label = String(gr.label || '');
    return {
      label, color: TONE[gr.tone] || '#8593a3',
      x: cx(a) - COL * 0.44, w: cx(b) - cx(a) + COL * 0.88,
      tw: Math.max(60, label.length * 6.6 + 16),
    };
  }).filter(Boolean);

  // One geometry descriptor per event, so the render pass stays a plain map.
  const evGeom = EV.map((e, n) => {
    const y = rowY(n);
    const kind = e?.kind === 'message' ? (e.arrow || (e.style === 'dashed' ? 'reply' : 'sync')) : null;
    const isReply = kind === 'reply';
    const isCreate = e?.kind === 'message' && !!e.create;
    // UML: a «create» message is drawn like a reply (open head onto the new
    // object's box), not as a solid call.
    const cls = e?.kind === 'note' ? 'note' : (isReply || isCreate ? 'ret' : 'msg');
    const marker = (isReply || isCreate) ? 'aor' : (kind === 'async' ? 'ao' : 'ah');
    const base = { y, cls, marker, drawOn: cls === 'msg' };

    if (e?.kind === 'note') {
      // `over` is a SET of lifelines, not a range: take the leftmost/rightmost
      // column so a note authored as ['cb','new'] still gets a positive width.
      const cols = (e.over || []).map((id) => idx[id]).filter((v) => v != null);
      if (!cols.length) return { ...base, shape: 'none' };
      return { ...base, shape: 'note', x1: cx(Math.min(...cols)) - 56, x2: cx(Math.max(...cols)) + 56 };
    }
    if (e?.found || e?.lost) {
      const ai = idx[e.found ? e.to : e.from];
      if (ai == null) return { ...base, shape: 'none' };
      const side = ai === 0 ? 1 : -1;                  // dot on the outward side
      const dotx = cx(ai) + side * 64;
      const xa = e.found ? dotx : cx(ai), xb = e.found ? cx(ai) : dotx;
      const dir = xb > xa ? 1 : -1;
      return { ...base, shape: 'boundary', dotx, x1: xa, x2: xb - dir * 6, mid: (xa + xb) / 2 };
    }
    if (e?.from === e?.to) {
      const i = idx[e.from];
      if (i == null) return { ...base, shape: 'none' };
      return { ...base, shape: 'self', x: cx(i) };
    }
    const ia = idx[e.from], ib = idx[e.to];
    if (ia == null || ib == null) return { ...base, shape: 'none' };
    const xa = cx(ia), xb = cx(ib), dir = xb > xa ? 1 : -1;
    return {
      ...base, shape: 'arrow', isCreate,
      x1: xa + dir * 4,
      x2: xb - dir * (e.create ? 46 : 5),   // stop at the activation / created box
      mid: (xa + xb) / 2,
    };
  });

  return {
    P, EV, idx, COL, X0, HEAD_Y, HEAD_H, LIFE_TOP, ROW0, ROW, W, H,
    cx, rowY, pStartStep, pEndStep, headTopOf, lifeTopOf, lifeBotOf,
    eventParticipants, acts, frames, groupBoxes, evGeom,
  };
}

// ── header entity (boxed service, or stick-figure actor) ────────────────────
function Head({ p, i, L, lang }) {
  const icons = useContext(IconCtx);
  const { cx, HEAD_H, headTopOf } = L;
  const top = headTopOf(i), x = cx(i);
  const label = tr(p.label, lang) || '';
  const sub = tr(p.sub, lang) || '';
  const stereo = tr(p.stereotype, lang) || '';

  if (p.actor) {
    const hy = top + 8;
    return (
      <>
        <circle cx={x} cy={hy} r={7} />
        <line x1={x} y1={hy + 7} x2={x} y2={hy + 22} />
        <line x1={x - 9} y1={hy + 13} x2={x + 9} y2={hy + 13} />
        <line x1={x} y1={hy + 22} x2={x - 8} y2={hy + 33} />
        <line x1={x} y1={hy + 22} x2={x + 8} y2={hy + 33} />
        <text className="alabel" x={x} y={top + HEAD_H + 2} textAnchor="middle">{label}</text>
      </>
    );
  }

  const w = Math.max(96, label.length * 6.4 + 18, sub.length * 5.6 + 18, stereo.length * 5.6 + 22);
  const uri = p.icon ? icons.url(String(p.icon)) : null;
  const ty = stereo ? top + (sub ? 34 : 36) : top + (sub ? 20 : 27);
  return (
    <>
      <rect x={x - w / 2} y={top} width={w} height={HEAD_H} rx={7} />
      {stereo && <text className="stereo" x={x} y={top + 12} textAnchor="middle">{`«${stereo}»`}</text>}
      {uri ? (
        <>
          <image href={uri} x={x - 14} y={top + (stereo ? 18 : 5)} width={28} height={28}
            style={{ filter: icons.filter(String(p.icon)) }} />
          <text x={x} y={top + (stereo ? 54 : 45)} textAnchor="middle">{label}</text>
          {sub && <text className="sub" x={x} y={top + (stereo ? 62 : 55)} textAnchor="middle">{sub}</text>}
        </>
      ) : (
        <>
          <text x={x} y={ty} textAnchor="middle">{label}</text>
          {sub && <text className="sub" x={x} y={ty + 14} textAnchor="middle">{sub}</text>}
        </>
      )}
    </>
  );
}

// ── narration card: who takes part in the active step ───────────────────────
function Parties({ e, L, involved, lang }) {
  const icons = useContext(IconCtx);
  const { P, idx, eventParticipants } = L;
  if (!e) return null;
  const chip = (i, key) => {
    const p = P[i], uri = p?.icon ? icons.url(String(p.icon)) : null;
    return (
      <span key={key} className={`pchip${involved?.has(i) ? ' on' : ''}`}>
        {uri ? <img className="pico" src={uri} alt="" style={{ filter: icons.filter(String(p.icon)) }} />
          : p?.actor ? (
            <svg className="pico" viewBox="0 0 16 16">
              <circle cx="8" cy="3.4" r="2.2" />
              <path d="M8 5.6V10.5M4.6 7.6h6.8M8 10.5l-2.4 3.4M8 10.5l2.4 3.4" />
            </svg>
          ) : null}
        {tr(p?.label, lang)}
      </span>
    );
  };
  const arr = (t, key) => <span key={key} className="parr">{t}</span>;

  if (e.kind === 'note') {
    return <>{eventParticipants(e).flatMap((i, k) => (k ? [arr('·', `s${k}`), chip(i, k)] : [chip(i, k)]))}</>;
  }
  if (e.from === e.to) {
    const i = idx[e.from];
    return i == null ? null : <>{chip(i, 'a')}{arr('↻', 'r')}</>;
  }
  const dir = (e.arrow === 'reply' || e.style === 'dashed') ? '⇢' : '→';
  // A found/lost message has no counterpart lifeline — show the boundary dot.
  const boundary = (key) => <span key={key} className="pchip bdotc">●</span>;
  return (
    <>
      {e.found ? boundary('l') : (idx[e.from] != null ? chip(idx[e.from], 'l') : null)}
      {arr(dir, 'd')}
      {e.lost ? boundary('r') : (idx[e.to] != null ? chip(idx[e.to], 'r') : null)}
    </>
  );
}

const LEGEND = (
  <>
    <span><svg width="30" height="10"><line x1="0" y1="5" x2="22" y2="5" stroke="currentColor" strokeWidth="2" /><path d="M22,1 L30,5 L22,9 z" fill="currentColor" /></svg> sync</span>
    <span><svg width="30" height="10"><line x1="0" y1="5" x2="22" y2="5" stroke="currentColor" strokeWidth="2" /><path d="M22,1 L30,5 L22,9" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg> async</span>
    <span><svg width="30" height="10"><line x1="0" y1="5" x2="22" y2="5" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" /><path d="M22,1 L30,5 L22,9" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg> reply</span>
    <span><svg width="14" height="16"><rect x="4" y="0" width="6" height="16" fill="none" stroke="currentColor" /></svg> activation</span>
    <span>«create» / <b style={{ color: 'var(--danger)' }}>✕</b> destroy</span>
  </>
);

const PREFERS_REDUCED = typeof window !== 'undefined' && !!window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Animated UML sequence panel.
 * @param seq    sequence payload (lib/sequence-schemas.js shape)
 * @param active whether this tab is the visible one (gates the keyboard map)
 */
export function SequencePlayer({
  seq, lang = 'en', active = true, ui, cur: curProp, onCur,
  iconUrl, iconFilter, controls = true, card = true, theme, className = '', style,
}) {
  const L = useMemo(() => buildLayout(seq), [seq]);
  const { P, EV, W, H, cx, rowY, eventParticipants } = L;
  const icons = useMemo(() => ({ url: iconUrl || (() => null), filter: iconFilter || (() => 'none') }), [iconUrl, iconFilter]);

  // Controlled (`cur` given: a deck's reveal, an editor's selection) or the
  // player's own step. null = overview (every event shown, none current).
  const controlled = curProp !== undefined;
  const [ownCur, setOwnCur] = useState(0);
  const cur = controlled ? (curProp == null ? EV.length : curProp) : ownCur;
  const overview = controlled && curProp == null;
  const setCur = (v) => {
    const next = typeof v === 'function' ? v(cur) : v;
    if (controlled) onCur?.(next); else setOwnCur(next);
  };
  const [playing, setPlaying] = useState(!!seq?.autoplay);
  const [speed, setSpeed] = useState(Number.isInteger(seq?.stepMs) ? seq.stepMs : 1300);
  const [dockVisible, setDockVisible] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const stageRef = useRef(null);
  const svgRef = useRef(null);
  const headLayerRef = useRef(null);
  const headBgRef = useRef(null);
  const searchRef = useRef(null);
  const viewRef = useRef({ zoom: 1, tx: 368, ty: 12 });

  const e = EV[cur];
  const involved = useMemo(() => (e ? new Set(eventParticipants(e)) : null), [e, eventParticipants]);
  const t = (k, fb) => (ui ? (ui(k, lang) || fb) : fb);

  // Participants whose label / sub / service matches the search box.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return P
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => `${tr(p.label, lang) || ''} ${tr(p.sub, lang) || ''} ${p.service || ''}`.toLowerCase().includes(q))
      .map(({ i }) => i);
  }, [query, P, lang]);
  const hits = useMemo(() => new Set(matches), [matches]);

  // ── camera ────────────────────────────────────────────────────────────────
  // Transform-based pan/zoom. A left gutter is reserved for the floating card so
  // framed content is never hidden behind it; the view auto-follows the step.
  const GUTTER = 368;                                  // card 340 + 14 inset + 14
  const gutter = () => ((stageRef.current?.clientWidth || 0) > 760 ? GUTTER : 24);
  const clampZoom = (z) => Math.max(0.25, Math.min(3, z));

  // Keep the participant headers readable: when their natural position would
  // scroll above the panel's top edge, push the layer down just enough and fade
  // in its background band so they stay legible over the rows behind them.
  const pinHeaders = useCallback((animate) => {
    const layer = headLayerRef.current;
    if (!layer) return;
    const { zoom, ty } = viewRef.current;
    const d = Math.max(0, (6 - ty) / zoom - L.HEAD_Y);
    layer.style.transition = (animate && !PREFERS_REDUCED) ? 'transform .45s cubic-bezier(.4,0,.2,1)' : 'none';
    layer.style.transform = d ? `translateY(${d}px)` : '';
    if (headBgRef.current) headBgRef.current.style.opacity = d > 1 ? '1' : '0';
  }, [L.HEAD_Y]);

  const applyView = useCallback((animate) => {
    const svg = svgRef.current;
    if (!svg) return;
    const { zoom, tx, ty } = viewRef.current;
    svg.style.transition = (animate && !PREFERS_REDUCED) ? 'transform .45s cubic-bezier(.4,0,.2,1)' : 'none';
    svg.style.transform = `translate(${tx}px,${ty}px) scale(${zoom})`;
    pinHeaders(animate);
  }, [pinHeaders]);

  // Frame the active step: horizontally the lifelines it touches, vertically a
  // band of context rows around it. Falls back to a whole-diagram fit.
  const frameStep = useCallback((animate) => {
    const stage = stageRef.current;
    if (!stage) return;
    const g = gutter();
    const availW = Math.max(120, stage.clientWidth - g - 30);
    const availH = Math.max(120, stage.clientHeight - 40);
    const ev = EV[cur], parts = ev ? eventParticipants(ev) : [];
    if (!ev || !parts.length) {
      viewRef.current = { zoom: Math.max(0.25, Math.min(1, availW / W)), tx: g, ty: 12 };
      applyView(animate);
      return;
    }
    const padX = L.COL * 0.6, CTX = 2.2;
    const x0 = Math.max(0, cx(Math.min(...parts)) - padX);
    const x1 = Math.min(W, cx(Math.max(...parts)) + padX);
    const y0 = Math.max(0, rowY(cur) - L.ROW * CTX);
    const y1 = Math.min(H, rowY(cur) + L.ROW * CTX);
    const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);
    const zoom = clampZoom(Math.min(1.8, Math.min(availW / bw, availH / bh)));
    viewRef.current = {
      zoom,
      tx: g + (availW - bw * zoom) / 2 - x0 * zoom,
      // Centre the band vertically, but never push the diagram BELOW its natural
      // top: on the first steps y0 is 0 and centring would leave a dead band
      // above the participant headers.
      ty: Math.min(20, 20 + (availH - bh * zoom) / 2 - y0 * zoom),
    };
    applyView(animate);
  }, [cur, EV, W, H, cx, rowY, L.COL, L.ROW, eventParticipants, applyView]);

  const fit = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const g = gutter();
    viewRef.current = { zoom: Math.max(0.25, Math.min(1, (stage.clientWidth - g - 30) / W)), tx: g, ty: 12 };
    applyView(true);
  }, [W, applyView]);

  const frameParticipant = useCallback((i) => {
    const stage = stageRef.current;
    if (!stage) return;
    const g = gutter();
    const availW = Math.max(120, stage.clientWidth - g - 30);
    const zoom = clampZoom(Math.min(1.6, availW / (L.COL * 2.4)));
    viewRef.current = { zoom, tx: g + availW / 2 - cx(i) * zoom, ty: 12 };
    applyView(true);
  }, [L.COL, cx, applyView]);

  const zoomAtPoint = useCallback((nz, px, py) => {
    const v = viewRef.current, zoom = clampZoom(nz);
    const sx = (px - v.tx) / v.zoom, sy = (py - v.ty) / v.zoom;
    viewRef.current = { zoom, tx: px - sx * zoom, ty: py - sy * zoom };
    applyView(false);
  }, [applyView]);
  const zoomCentre = (f) => {
    const stage = stageRef.current;
    if (!stage) return;
    zoomAtPoint(viewRef.current.zoom * f, stage.clientWidth / 2, stage.clientHeight / 2);
  };

  // Follow the step; re-frame on resize and when the tab becomes visible.
  useEffect(() => { if (active) frameStep(true); }, [frameStep, active]);
  useEffect(() => {
    const onResize = () => frameStep(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [frameStep]);

  // wheel = zoom toward the cursor (non-passive, so the page does not scroll)
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (ev) => {
      ev.preventDefault();
      const r = stage.getBoundingClientRect();
      zoomAtPoint(viewRef.current.zoom * (ev.deltaY < 0 ? 1.12 : 1 / 1.12), ev.clientX - r.left, ev.clientY - r.top);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [zoomAtPoint]);

  const drag = useRef(null);
  const onPointerDown = (ev) => {
    if (ev.button !== 0 || ev.target.closest?.('.sq-pill,.sq-card,.sq-expand,.sq-search')) return;
    drag.current = { sx: ev.clientX, sy: ev.clientY, tx: viewRef.current.tx, ty: viewRef.current.ty };
    stageRef.current?.classList.add('grabbing');
    try { (ev.currentTarget).setPointerCapture(ev.pointerId); } catch { /* not captured — drag still works */ }
  };
  const onPointerMove = (ev) => {
    const d = drag.current;
    if (!d) return;
    viewRef.current = { ...viewRef.current, tx: d.tx + (ev.clientX - d.sx), ty: d.ty + (ev.clientY - d.sy) };
    applyView(false);
  };
  const endDrag = () => { if (drag.current) { drag.current = null; stageRef.current?.classList.remove('grabbing'); } };

  // ── player ────────────────────────────────────────────────────────────────
  const step = (d) => setCur(c => Math.max(0, Math.min(EV.length - 1, c + d)));
  const playToggle = () => {
    if (!playing && cur >= EV.length - 1) setCur(0);
    setPlaying(p => !p);
  };
  useEffect(() => {
    if (!playing) return;
    if (cur >= EV.length - 1) { setPlaying(false); return; }
    const timer = setTimeout(() => setCur(c => Math.min(EV.length - 1, c + 1)), speed);
    return () => clearTimeout(timer);
  }, [playing, cur, speed, EV.length]);

  useEffect(() => {
    if (!active || controlled) return; // a controlled host owns the keys
    const onKey = (ev) => {
      if (ev.key === 'Escape' && searchOpen) { ev.preventDefault(); setSearchOpen(false); setQuery(''); return; }
      if (ev.target?.tagName === 'INPUT') return;
      if (ev.key === '/') { ev.preventDefault(); setSearchOpen(true); setTimeout(() => searchRef.current?.select(), 0); }
      else if (ev.key === 'ArrowRight') { ev.preventDefault(); setPlaying(false); step(1); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); setPlaying(false); step(-1); }
      else if (ev.key === ' ') { ev.preventDefault(); playToggle(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, controlled, searchOpen, cur, playing, EV.length]);

  // ── exports ───────────────────────────────────────────────────────────────
  // The SVG is a real DOM node, so the published serializer ports as-is: clear
  // the view transform, un-pin the headers, inline the resolved theme vars plus
  // the document's stylesheets (the SVG is standalone once downloaded).
  const serializeSvg = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return '';
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    clone.removeAttribute('style');
    const hl = clone.querySelector('.seq-headlayer');
    if (hl) hl.style.transform = '';
    const hbg = clone.querySelector('.headerbg');
    if (hbg) hbg.style.opacity = '0';
    // The theme tokens live on .ld-frame, not :root — read them off the SVG
    // itself (computed style resolves inherited custom properties) and pin them
    // on the clone so the downloaded file renders standalone.
    const cs = getComputedStyle(svg);
    const vars = ['--navy', '--orange', '--txt', '--txt-muted', '--border', '--bg', '--card-bg', '--chip-bg',
      '--dot', '--pill-bg', '--msg', '--ret', '--accent', '--info', '--success', '--warn', '--danger', '--neutral', '--active'];
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `svg{${vars.map(v => `${v}:${cs.getPropertyValue(v).trim()};`).join('')}}`
      // Un-scope `.ld-seqp X` → `X`: in the exported file the SVG is the root, so
      // the panel ancestor the live rules hang off no longer exists.
      + [...document.querySelectorAll('style')].map(s => s.textContent || '').join('\n').replace(/\.ld-seqp\s+/g, '');
    clone.insertBefore(style, clone.firstChild);
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
  }, []);

  const download = (name, blob) => {
    const u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  };
  const dlSvg = () => download('sequence-diagram.svg', new Blob([serializeSvg()], { type: 'image/svg+xml' }));
  const dlPng = () => {
    const scale = 2, img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = W * scale; c.height = H * scale;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = (svgRef.current ? getComputedStyle(svgRef.current).getPropertyValue('--bg').trim() : '') || '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      c.toBlob(b => b && download('sequence-diagram.png', b), 'image/png');
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serializeSvg())}`;
  };

  // ── render ────────────────────────────────────────────────────────────────
  const activeColor = (e?.tone && TONE[e.tone]) || AWS_ORANGE;
  const title = tr(seq?.title, lang) || '';
  const subtitle = tr(seq?.subtitle, lang) || '';

  return (
    <IconCtx.Provider value={icons}>
    <div className={`ld-seqp ${className}`} data-theme={theme} style={{ ['--active']: activeColor, ...style }}>
      <style>{SEQ_CSS}</style>
      <div ref={stageRef} className="sq-stage"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={endDrag} onPointerCancel={endDrag}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width={W} height={H} xmlns="http://www.w3.org/2000/svg">
          <defs>
            {/* filled heads = synchronous call */}
            {[['ah', 'var(--msg)'], ['ahr', 'var(--ret)'], ['aha', AWS_ORANGE]].map(([id, c]) => (
              <marker key={id} id={`sq-${id}`} markerWidth={12} markerHeight={12} refX={9} refY={4}
                orient="auto" markerUnits="userSpaceOnUse">
                <path d="M0,0 L10,4 L0,8 z" fill={c} />
              </marker>
            ))}
            {/* open heads = async / reply / create */}
            {[['ao', 'var(--msg)'], ['aor', 'var(--ret)'], ['aoa', AWS_ORANGE]].map(([id, c]) => (
              <marker key={id} id={`sq-${id}`} markerWidth={14} markerHeight={12} refX={9} refY={4}
                orient="auto" markerUnits="userSpaceOnUse">
                <path d="M0,0 L10,4 L0,8" fill="none" stroke={c} strokeWidth={1.6} />
              </marker>
            ))}
          </defs>

          {/* participant grouping boxes */}
          {L.groupBoxes.map((g, i) => (
            <g key={`g${i}`} className="grp">
              <rect x={g.x} y={8} width={g.w} height={H - 8 - 14} rx={8} stroke={g.color} />
              {/* inline style, not a `fill` attribute: the `.grp rect` rule would
                  otherwise win over it and leave white label text on a pale box. */}
              <rect className="gtabbg" x={g.x} y={8} width={g.tw} height={18} rx={4} style={{ fill: g.color }} />
              <text className="gtab" x={g.x + 8} y={21}>{g.label}</text>
            </g>
          ))}

          {/* lifelines — dimmed when the step does not touch them */}
          {P.map((p, i) => {
            const shown = L.pStartStep[i] < 0 || cur >= L.pStartStep[i];
            const dim = shown && involved && !involved.has(i);
            return (
              <line key={`l${i}`} className="lifeline" x1={cx(i)} y1={L.lifeTopOf(i)} x2={cx(i)} y2={L.lifeBotOf(i)}
                style={{ opacity: !shown ? 0 : dim ? 0.12 : 1 }} />
            );
          })}
          {P.map((p, i) => (L.pEndStep[i] >= 0 ? (
            <g key={`x${i}`} className="destroy" style={{ opacity: cur >= L.pEndStep[i] ? 1 : 0 }}>
              <line x1={cx(i) - 8} y1={L.lifeBotOf(i) - 8} x2={cx(i) + 8} y2={L.lifeBotOf(i) + 8} />
              <line x1={cx(i) - 8} y1={L.lifeBotOf(i) + 8} x2={cx(i) + 8} y2={L.lifeBotOf(i) - 8} />
            </g>
          ) : null))}

          {/* activation / execution bars */}
          {L.acts.map((a, i) => (
            <g key={`a${i}`} className={`exec${cur >= a.from && cur <= a.to ? ' hot' : ''}`}
              style={{ opacity: cur >= a.from ? 1 : 0 }}>
              <rect x={cx(a.p) - 4.5} y={rowY(a.from) - 8} width={9}
                height={Math.max(18, rowY(a.to) - rowY(a.from) + 16)} rx={2} />
            </g>
          ))}

          {/* combined fragments (alt/opt/loop/par/…) with their dividers */}
          {L.frames.map((f, i) => (
            <g key={`f${i}`} className="frame" style={{ opacity: cur >= f.start ? 1 : 0 }}>
              <rect x={f.xmin} y={f.y1} width={f.xmax - f.xmin} height={f.y2 - f.y1} rx={6} stroke={f.color} />
              <rect className="flabelbg" x={f.xmin} y={f.y1} height={17} style={{ fill: f.color }}
                width={Math.max(70, (String(f.fr.kind).length + String(f.fr.label || '').length) * 6 + 24)} />
              <text className="flabel" x={f.xmin + 7} y={f.y1 + 13}>{`${f.fr.kind}  ${f.fr.label || ''}`}</text>
              {f.dividers.map((d, k) => (
                <g key={k} style={{ opacity: cur >= d.at ? 1 : 0 }}>
                  <line className="elsediv" x1={f.xmin} y1={rowY(d.at) - 32} x2={f.xmax} y2={rowY(d.at) - 32} />
                  <text className="elsetxt" x={f.xmin + 7} y={rowY(d.at) - 36}>{d.label}</text>
                </g>
              ))}
            </g>
          ))}

          {/* events: notes + messages, revealed up to the current step */}
          {L.evGeom.map((g, n) => {
            const ev = EV[n];
            const cls = `evt ${g.cls}${n <= cur ? ' shown' : ''}${n === cur ? ' active' : ''}`;
            const label = tr(ev?.label, lang) || '';
            // pathLength=1 normalizes the dash geometry so the CSS draw-on works
            // without measuring the path (the vanilla player read
            // getTotalLength() into a --len custom property).
            const draw = g.drawOn ? { pathLength: 1 } : {};
            if (g.shape === 'none') return <g key={n} className={cls} />;
            if (g.shape === 'note') {
              return (
                <g key={n} className={cls}>
                  <rect x={g.x1} y={g.y - 15} width={g.x2 - g.x1} height={26} rx={5} />
                  <text x={(g.x1 + g.x2) / 2} y={g.y + 2} textAnchor="middle">{label}</text>
                </g>
              );
            }
            if (g.shape === 'boundary') {
              return (
                <g key={n} className={cls}>
                  <circle className="bdot" cx={g.dotx} cy={g.y} r={5} />
                  <path className="line" {...draw} d={`M${g.x1},${g.y} L${g.x2},${g.y}`} markerEnd={`url(#sq-${g.marker})`} />
                  <text className="lbl" x={g.mid} y={g.y - 6} textAnchor="middle">{label}</text>
                </g>
              );
            }
            if (g.shape === 'self') {
              return (
                <g key={n} className={cls}>
                  <path className="line" {...draw} d={`M${g.x + 4},${g.y} h34 v20 h-34`} markerEnd={`url(#sq-${g.marker})`} />
                  <text className="lbl" x={g.x + 46} y={g.y + 13}>{label}</text>
                </g>
              );
            }
            return (
              <g key={n} className={cls}>
                <path className="line" {...draw} d={`M${g.x1},${g.y} L${g.x2},${g.y}`} markerEnd={`url(#sq-${g.marker})`} />
                <text className="lbl" x={g.mid} y={g.y - 6} textAnchor="middle">{label}</text>
                {g.isCreate && (
                  <text className="lbl" x={g.mid} y={g.y + 11} textAnchor="middle" fontStyle="italic" fill="currentColor">«create»</text>
                )}
              </g>
            );
          })}

          {/* headers last so they sit above the bars and arrows */}
          <g className="seq-headlayer" ref={headLayerRef}>
            <rect ref={headBgRef} className="headerbg" x={0} y={L.HEAD_Y - 8} width={W} height={L.HEAD_H + 16}
              fill="var(--bg)" style={{ opacity: 0 }} />
            {P.map((p, i) => {
              const shown = L.pStartStep[i] < 0 || cur >= L.pStartStep[i];
              const dim = shown && involved && !involved.has(i);
              const cls = `${p.actor ? 'actor' : 'phead'}`
                + `${!p.actor && p.icon && icons.url(String(p.icon)) ? ' iconhead' : ''}`
                + `${involved?.has(i) ? ' hot' : ''}${hits.has(i) ? ' searchhit' : ''}`;
              return (
                <g key={`h${i}`} className={cls} style={{ opacity: !shown ? 0 : dim ? 0.26 : 1 }}>
                  <Head p={p} i={i} L={L} lang={lang} />
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* participant search ('/') */}
      <div className={`sq-search${searchOpen ? ' on' : ''}`}>
        <input ref={searchRef} type="text" value={query} aria-label="search participants"
          placeholder={t('searchPlaceholder', 'search participants…')}
          onChange={ev => setQuery(ev.target.value)}
          onKeyDown={ev => {
            if (ev.key === 'Enter') { ev.preventDefault(); if (matches.length) frameParticipant(matches[0]); }
            else if (ev.key === 'Escape') { ev.preventDefault(); setSearchOpen(false); setQuery(''); }
          }} />
        <span className="cnt">{query.trim() ? (matches.length ? `1/${matches.length}` : '0') : ''}</span>
      </div>

      {/* floating narration card */}
      {card && <div className="sq-card">
        <div className="rail">{EV.map((_, i) => <i key={i} className={i <= cur ? 'on' : ''} />)}</div>
        <div className="cardhead">
          <span>{e?.badge ? <span className={`badge b-${e.badge}`}>{BADGE_TXT[e.badge] || e.badge}</span> : null}</span>
          {!overview && <span className="counter">{`${Math.max(0, cur + 1)} / ${EV.length}`}</span>}
        </div>
        {/* Step number BEFORE the step: the reader sees where they are without
            hunting for the counter in the corner. */}
        <div className="title">
          {e && <span className="stepnum">{cur + 1}</span>}
          {e ? (tr(e.title, lang) || tr(e.label, lang) || '') : overview ? (tr(seq?.title, lang) || '') : ''}
        </div>
        {e && <div className="parties"><Parties e={e} L={L} involved={involved} lang={lang} /></div>}
        {e?.flow && <div className="flow">{tr(e.flow, lang)}</div>}
        {e?.desc && <div className="desc">{cardKit.mdInline(tr(e.desc, lang) || '')}</div>}
        {e?.proof && <div className="proof"><ProofLine proof={e.proof} /></div>}
        {e?.code && (
          <div className="codeblk">
            <div className="hd">{tr(e.codeLabel, lang) || 'code'}</div>
            <pre>{e.code}</pre>
          </div>
        )}
        <div className="legend">{LEGEND}</div>
      </div>}

      {/* floating pill toolbar */}
      {!controls ? null : dockVisible ? (
        <div className="sq-pill">
          <div className="pilltitle">
            {title && <div className="t">{title}</div>}
            {subtitle && <div className="s">{subtitle}</div>}
          </div>
          <span className="sep" />
          <button className="pbtn" onClick={() => zoomCentre(1 / 1.15)} title={t('zoomOut', 'Zoom out')} aria-label="zoom out">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3M8 11h6" /></svg>
          </button>
          <button className="pbtn" onClick={fit} title={t('fit', 'Fit')} aria-label="fit">
            <svg viewBox="0 0 24 24"><path d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m11.25-5.25v4.5m0-4.5h-4.5m4.5 0L15 9m-11.25 11.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 5.25v-4.5m0 4.5h-4.5m4.5 0L15 15" /></svg>
          </button>
          <button className="pbtn" onClick={() => zoomCentre(1.15)} title={t('zoomIn', 'Zoom in')} aria-label="zoom in">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3M11 8v6m-3-3h6" /></svg>
          </button>
          <span className="sep" />
          <button className="pbtn" disabled={cur <= 0} onClick={() => { setPlaying(false); step(-1); }}
            title={t('prev', 'Previous')} aria-label="previous">
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button className={`pbtn play${playing ? ' on' : ''}${!playing && cur <= 0 ? ' attention' : ''}`}
            onClick={playToggle} title={playing ? t('pause', 'Pause') : t('play', 'Play')} aria-label="play">
            {playing
              ? <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
              : <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z" /></svg>}
          </button>
          <button className="pbtn" disabled={cur >= EV.length - 1} onClick={() => { setPlaying(false); step(1); }}
            title={t('next', 'Next')} aria-label="next">
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>
          <button className="pbtn" onClick={() => { setPlaying(false); setCur(0); }} title={t('restart', 'Restart')} aria-label="restart">
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
          </button>
          <span className="sep" />
          <span className="spdwrap">
            <input type="range" min={400} max={2600} step={100} value={speed}
              aria-label="step duration" onChange={ev => setSpeed(+ev.target.value)} />
            <span>{`${(speed / 1000).toFixed(1)}s`}</span>
          </span>
          <span className="sep" />
          <button className="pbtn wide" onClick={dlSvg} title="Download SVG">SVG</button>
          <button className="pbtn wide" onClick={dlPng} title="Download PNG">PNG</button>
          <span className="sep" />
          <button className="pbtn" onClick={() => setDockVisible(false)} title={t('hideControls', 'Hide controls')} aria-label="hide controls">
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </button>
        </div>
      ) : (
        <button className="sq-expand" onClick={() => setDockVisible(true)} title={t('showControls', 'Show controls')} aria-label="show controls">▲</button>
      )}
    </div>
    </IconCtx.Provider>
  );
}

export default SequencePlayer;
