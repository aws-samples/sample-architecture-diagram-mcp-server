// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Animated UML sequence view — a tab of a multi-tab diagram document.
//
// This is a React port of the published standalone sequence player
// (lib/sequence-template.html) so the animated sequence can live in the SAME
// self-contained React bundle as the architecture canvas: one renderer, one
// schema (lib/sequence-schemas.js), one theme.
//
// The port is FAITHFUL: identical geometry (COL/X0/ROW/HEAD_H…), the same UML
// semantics (sync/async/reply arrows, «create» + destroy ✕, found/lost boundary
// dots, stereotypes, auto AND explicit activation bars, alt/opt/loop/par/…
// fragments with dividers, participant grouping boxes), the same narration card
// (badge, title, party chips, flow, markdown description, proof link, code) and
// the same step-following camera with pinned headers plus SVG/PNG/WebM export.
// What changes is HOW it is expressed: the imperative createElementNS code
// becomes a pure layout pass (useMemo) + a declarative render, and the arrow
// draw-on uses SVG `pathLength` normalization instead of measuring
// getTotalLength() at build time.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tr } from '@aws-live-diagram/core';
import { cardKit } from '@aws-live-diagram/core/react';
import { resolveIcon, iconFilter } from '@/lib/icons';

type Any = any;

// Named accents, matching the player's TONE map (and the CSS custom properties).
const TONE: Record<string, string> = {
  accent: '#ff9900', info: '#2f6fed', success: '#1a7f37',
  warn: '#b7791f', danger: '#d13212', neutral: '#5f6b7a',
};
const BADGE_TXT: Record<string, string> = {
  gate: '◆ GATE', keyless: '● keyless', async: 'async', sync: 'sync', phase: 'PHASE', fail: '✕ fail',
};

// ── proof refs ──────────────────────────────────────────────────────────────
// A step's `proof` is either free text (inline markdown) or a structured,
// verifiable source reference {repo,path,ref,lines,url,text} rendered as a link
// to the exact file@ref#lines — that is what makes a walkthrough auditable.
function lineFrag(lines: Any): string {
  if (lines == null) return '';
  if (Array.isArray(lines)) return lines.length > 1 ? `#L${lines[0]}-L${lines[1]}` : `#L${lines[0]}`;
  const span = String(lines).match(/(\d+)\s*[-–]\s*(\d+)/);
  if (span) return `#L${span[1]}-L${span[2]}`;
  const one = String(lines).match(/\d+/);
  return one ? `#L${one[0]}` : '';
}

function ProofLine({ proof }: Any) {
  if (proof == null) return null;
  if (typeof proof === 'string') return <>{cardKit.mdInline(proof)}</>;
  const path = String(proof.path || ''), frag = lineFrag(proof.lines);
  let url = proof.url || '';
  if (!url && proof.repo && path) {
    url = `${String(proof.repo).replace(/\/+$/, '')}/blob/${proof.ref || 'main'}/${path.replace(/^\/+/, '')}${frag}`;
  }
  const label = proof.text || (path ? path + frag.replace('#L', ':').replace('-L', '-') : url);
  if (!url) return <>{cardKit.mdInline(String(label || ''))}</>;
  return <a href={url} target="_blank" rel="noopener noreferrer"><code>{label}</code></a>;
}

// Longest text a value can render, across EVERY offered language: a { en, pt }
// label must not overlap its neighbour after a language switch either.
function textLen(v: Any): number {
  if (v == null) return 0;
  if (typeof v === 'object') return Math.max(0, ...Object.values(v).map(s => String(s ?? '').length));
  return String(v).length;
}

/** Width of a participant's header box — same formula Head() uses to draw it. */
function headBoxW(p: Any): number {
  return Math.max(96, textLen(p?.label) * 6.4 + 18, textLen(p?.sub) * 5.6 + 18, textLen(p?.stereotype) * 5.6 + 22);
}

// ── layout (pure) ───────────────────────────────────────────────────────────
// Everything the SVG needs, derived once per sequence: column/row geometry,
// instance create/destroy rows, activation bars, fragment boxes, group boxes and
// one descriptor per event. Mirrors the layout pass of sequence-template.html.
function buildLayout(seq: Any) {
  const P: Any[] = seq?.participants || [];
  const EV: Any[] = seq?.events || [];
  const FRAGS: Any[] = seq?.fragments || [];
  const GROUPS: Any[] = seq?.groups || [];

  const idx: Record<string, number> = {};
  P.forEach((p, i) => { if (p?.id != null) idx[p.id] = i; });
  const evIndexById: Record<string, number> = {};
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
  const groupOf: (number | null)[] = P.map(p => {
    const gi = GROUPS.findIndex((gr: Any) => (gr?.participants || []).includes(p?.id));
    return gi < 0 ? null : gi;
  });
  const XS: number[] = [];
  let shift = 0;
  P.forEach((_, i) => {
    if (i > 0 && groupOf[i] !== groupOf[i - 1]) shift += GUT;
    XS.push(X0 + i * COL + shift);
  });
  const cx = (i: number) => (XS[i] != null ? XS[i] : X0 + i * COL);
  const W = (XS.length ? XS[XS.length - 1] : X0) + 95;
  const H = ROW0 + EV.length * ROW + 40;
  const rowY = (n: number) => ROW0 + n * ROW;

  // UML instance creation / destruction rows, per participant id.
  const createRow: Record<string, number> = {}, destroyRow: Record<string, number> = {};
  EV.forEach((e, n) => {
    if (e?.kind !== 'message') return;
    if (e.create && e.to != null) createRow[e.to] = n;
    if (e.destroy && e.to != null) destroyRow[e.to] = n;
  });
  const pStartStep = P.map(p => (createRow[p.id] != null ? createRow[p.id] : -1));
  const pEndStep = P.map(p => (destroyRow[p.id] != null ? destroyRow[p.id] : -1));
  // A created object's box sits ON the creating row; a destroyed one's lifeline
  // stops at the ✕ instead of running to the bottom.
  const headTopOf = (i: number) => (pStartStep[i] >= 0 ? rowY(pStartStep[i]) - HEAD_H / 2 : HEAD_Y);
  const lifeTopOf = (i: number) => (pStartStep[i] >= 0 ? rowY(pStartStep[i]) + HEAD_H / 2 : LIFE_TOP);
  const lifeBotOf = (i: number) => (pEndStep[i] >= 0 ? rowY(pEndStep[i]) : H - 24);

  // Which lifelines an event touches (a note spans `over`; a message is from→to
  // minus the boundary end of a found/lost message, which has no lifeline).
  const eventParticipants = (e: Any): number[] => {
    if (!e) return [];
    const s = new Set<number>();
    if (e.kind === 'note') (e.over || []).forEach((o: string) => { if (idx[o] != null) s.add(idx[o]); });
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
      const stacks: Record<number, Any[]> = {}, out: Any[] = [];
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
    const raw: Any[] = [];
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
    const byP: Record<number, Any[]> = {};
    raw.forEach(a => { (byP[a.p] = byP[a.p] || []).push(a); });
    const merged: Any[] = [];
    Object.keys(byP).forEach(k => {
      let run: Any = null;
      byP[+k].sort((a, b) => a.from - b.from).forEach(a => {
        if (run && a.from <= run.to) run.to = Math.max(run.to, a.to);
        else { run = { p: +k, from: a.from, to: a.to }; merged.push(run); }
      });
    });
    return merged;
  })();

  // Combined fragments: the horizontal span comes from the enclosed events.
  const frames = FRAGS.map((fr: Any) => {
    const start = evIndexById[fr.startId], end = evIndexById[fr.endId];
    if (start == null || end == null) return null;
    const parts = new Set<number>();
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
        .map((d: Any) => ({ at: evIndexById[d.beforeId], label: d.label }))
        .filter((d: Any) => d.at != null),
    };
  }).filter(Boolean) as Any[];

  // Participant grouping boxes (PlantUML `box`), drawn behind the lifelines.
  const groupBoxes = GROUPS.map((gr: Any) => {
    const cols = (gr.participants || []).map((id: string) => idx[id]).filter((v: Any) => v != null);
    if (!cols.length) return null;
    const a = Math.min(...cols), b = Math.max(...cols);
    const label = String(gr.label || '');
    return {
      label, color: TONE[gr.tone] || '#8593a3',
      x: cx(a) - COL * 0.44, w: cx(b) - cx(a) + COL * 0.88,
      tw: Math.max(60, label.length * 6.6 + 16),
    };
  }).filter(Boolean) as Any[];

  // One geometry descriptor per event, so the render pass stays a plain map.
  const evGeom = EV.map((e: Any, n: number) => {
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
      const cols = (e.over || []).map((id: string) => idx[id]).filter((v: Any) => v != null);
      if (!cols.length) return { ...base, shape: 'none' as const };
      return { ...base, shape: 'note' as const, x1: cx(Math.min(...cols)) - 56, x2: cx(Math.max(...cols)) + 56 };
    }
    if (e?.found || e?.lost) {
      const ai = idx[e.found ? e.to : e.from];
      if (ai == null) return { ...base, shape: 'none' as const };
      const side = ai === 0 ? 1 : -1;                  // dot on the outward side
      const dotx = cx(ai) + side * 64;
      const xa = e.found ? dotx : cx(ai), xb = e.found ? cx(ai) : dotx;
      const dir = xb > xa ? 1 : -1;
      return { ...base, shape: 'boundary' as const, dotx, x1: xa, x2: xb - dir * 6, mid: (xa + xb) / 2 };
    }
    if (e?.from === e?.to) {
      const i = idx[e.from];
      if (i == null) return { ...base, shape: 'none' as const };
      return { ...base, shape: 'self' as const, x: cx(i) };
    }
    const ia = idx[e.from], ib = idx[e.to];
    if (ia == null || ib == null) return { ...base, shape: 'none' as const };
    const xa = cx(ia), xb = cx(ib), dir = xb > xa ? 1 : -1;
    return {
      ...base, shape: 'arrow' as const, isCreate,
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
function Head({ p, i, L, lang }: Any) {
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
  const uri = p.icon ? resolveIcon(String(p.icon)) : null;
  const ty = stereo ? top + (sub ? 34 : 36) : top + (sub ? 20 : 27);
  return (
    <>
      <rect x={x - w / 2} y={top} width={w} height={HEAD_H} rx={7} />
      {stereo && <text className="stereo" x={x} y={top + 12} textAnchor="middle">{`«${stereo}»`}</text>}
      {uri ? (
        <>
          <image href={uri} x={x - 14} y={top + (stereo ? 18 : 5)} width={28} height={28}
            style={{ filter: iconFilter(String(p.icon)) }} />
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
function Parties({ e, L, involved, lang }: Any) {
  const { P, idx, eventParticipants } = L;
  if (!e) return null;
  const chip = (i: number, key: Any) => {
    const p = P[i], uri = p?.icon ? resolveIcon(String(p.icon)) : null;
    return (
      <span key={key} className={`pchip${involved?.has(i) ? ' on' : ''}`}>
        {uri ? <img className="pico" src={uri} alt="" style={{ filter: iconFilter(String(p.icon)) }} />
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
  const arr = (t: string, key: Any) => <span key={key} className="parr">{t}</span>;

  if (e.kind === 'note') {
    return <>{eventParticipants(e).flatMap((i: number, k: number) => (k ? [arr('·', `s${k}`), chip(i, k)] : [chip(i, k)]))}</>;
  }
  if (e.from === e.to) {
    const i = idx[e.from];
    return i == null ? null : <>{chip(i, 'a')}{arr('↻', 'r')}</>;
  }
  const dir = (e.arrow === 'reply' || e.style === 'dashed') ? '⇢' : '→';
  // A found/lost message has no counterpart lifeline — show the boundary dot.
  const boundary = (key: Any) => <span key={key} className="pchip bdotc">●</span>;
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
export function SequenceDiagram({ seq, lang = 'en', active = true, ui }: Any) {
  const L = useMemo(() => buildLayout(seq), [seq]);
  const { P, EV, W, H, cx, rowY, eventParticipants } = L;

  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(!!seq?.autoplay);
  const [speed, setSpeed] = useState(Number.isInteger(seq?.stepMs) ? seq.stepMs : 1300);
  const [dockVisible, setDockVisible] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [recording, setRecording] = useState(false);
  const [recLabel, setRecLabel] = useState('REC');

  const stageRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const headLayerRef = useRef<SVGGElement | null>(null);
  const headBgRef = useRef<SVGRectElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const viewRef = useRef({ zoom: 1, tx: 368, ty: 12 });

  const e = EV[cur];
  const involved = useMemo(() => (e ? new Set<number>(eventParticipants(e)) : null), [e, eventParticipants]);
  const t = (k: string, fb: string) => (ui ? (ui(k, lang) || fb) : fb);

  // Participants whose label / sub / service matches the search box.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as number[];
    return P
      .map((p: Any, i: number) => ({ p, i }))
      .filter(({ p }: Any) => `${tr(p.label, lang) || ''} ${tr(p.sub, lang) || ''} ${p.service || ''}`.toLowerCase().includes(q))
      .map(({ i }: Any) => i);
  }, [query, P, lang]);
  const hits = useMemo(() => new Set(matches), [matches]);

  // ── camera ────────────────────────────────────────────────────────────────
  // Transform-based pan/zoom. A left gutter is reserved for the floating card so
  // framed content is never hidden behind it; the view auto-follows the step.
  const GUTTER = 368;                                  // card 340 + 14 inset + 14
  const gutter = () => ((stageRef.current?.clientWidth || 0) > 760 ? GUTTER : 24);
  const clampZoom = (z: number) => Math.max(0.25, Math.min(3, z));

  // Keep the participant headers readable: when their natural position would
  // scroll above the panel's top edge, push the layer down just enough and fade
  // in its background band so they stay legible over the rows behind them.
  const pinHeaders = useCallback((animate: boolean) => {
    const layer = headLayerRef.current;
    if (!layer) return;
    const { zoom, ty } = viewRef.current;
    const d = Math.max(0, (6 - ty) / zoom - L.HEAD_Y);
    layer.style.transition = (animate && !PREFERS_REDUCED) ? 'transform .45s cubic-bezier(.4,0,.2,1)' : 'none';
    layer.style.transform = d ? `translateY(${d}px)` : '';
    if (headBgRef.current) headBgRef.current.style.opacity = d > 1 ? '1' : '0';
  }, [L.HEAD_Y]);

  const applyView = useCallback((animate: boolean) => {
    const svg = svgRef.current;
    if (!svg) return;
    const { zoom, tx, ty } = viewRef.current;
    svg.style.transition = (animate && !PREFERS_REDUCED) ? 'transform .45s cubic-bezier(.4,0,.2,1)' : 'none';
    svg.style.transform = `translate(${tx}px,${ty}px) scale(${zoom})`;
    pinHeaders(animate);
  }, [pinHeaders]);

  // Frame the active step: horizontally the lifelines it touches, vertically a
  // band of context rows around it. Falls back to a whole-diagram fit.
  const frameStep = useCallback((animate: boolean) => {
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

  const frameParticipant = useCallback((i: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const g = gutter();
    const availW = Math.max(120, stage.clientWidth - g - 30);
    const zoom = clampZoom(Math.min(1.6, availW / (L.COL * 2.4)));
    viewRef.current = { zoom, tx: g + availW / 2 - cx(i) * zoom, ty: 12 };
    applyView(true);
  }, [L.COL, cx, applyView]);

  const zoomAtPoint = useCallback((nz: number, px: number, py: number) => {
    const v = viewRef.current, zoom = clampZoom(nz);
    const sx = (px - v.tx) / v.zoom, sy = (py - v.ty) / v.zoom;
    viewRef.current = { zoom, tx: px - sx * zoom, ty: py - sy * zoom };
    applyView(false);
  }, [applyView]);
  const zoomCentre = (f: number) => {
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
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const r = stage.getBoundingClientRect();
      zoomAtPoint(viewRef.current.zoom * (ev.deltaY < 0 ? 1.12 : 1 / 1.12), ev.clientX - r.left, ev.clientY - r.top);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [zoomAtPoint]);

  const drag = useRef<Any>(null);
  const onPointerDown = (ev: React.PointerEvent) => {
    if (ev.button !== 0 || (ev.target as Element).closest?.('.sq-pill,.sq-card,.sq-expand,.sq-search')) return;
    drag.current = { sx: ev.clientX, sy: ev.clientY, tx: viewRef.current.tx, ty: viewRef.current.ty };
    stageRef.current?.classList.add('grabbing');
    try { (ev.currentTarget as Element).setPointerCapture(ev.pointerId); } catch { /* not captured — drag still works */ }
  };
  const onPointerMove = (ev: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    viewRef.current = { ...viewRef.current, tx: d.tx + (ev.clientX - d.sx), ty: d.ty + (ev.clientY - d.sy) };
    applyView(false);
  };
  const endDrag = () => { if (drag.current) { drag.current = null; stageRef.current?.classList.remove('grabbing'); } };

  // ── player ────────────────────────────────────────────────────────────────
  const step = (d: number) => setCur(c => Math.max(0, Math.min(EV.length - 1, c + d)));
  const playToggle = () => {
    if (!playing && cur >= EV.length - 1) setCur(0);
    setPlaying(p => !p);
  };
  useEffect(() => {
    if (!playing || recording) return;
    if (cur >= EV.length - 1) { setPlaying(false); return; }
    const timer = setTimeout(() => setCur(c => Math.min(EV.length - 1, c + 1)), speed);
    return () => clearTimeout(timer);
  }, [playing, cur, speed, EV.length, recording]);

  useEffect(() => {
    if (!active) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && searchOpen) { ev.preventDefault(); setSearchOpen(false); setQuery(''); return; }
      if ((ev.target as HTMLElement)?.tagName === 'INPUT') return;
      if (ev.key === '/') { ev.preventDefault(); setSearchOpen(true); setTimeout(() => searchRef.current?.select(), 0); }
      else if (ev.key === 'ArrowRight') { ev.preventDefault(); setPlaying(false); step(1); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); setPlaying(false); step(-1); }
      else if (ev.key === ' ') { ev.preventDefault(); playToggle(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, searchOpen, cur, playing, EV.length]);

  // ── exports ───────────────────────────────────────────────────────────────
  // The SVG is a real DOM node, so the published serializer ports as-is: clear
  // the view transform, un-pin the headers, inline the resolved theme vars plus
  // the document's stylesheets (the SVG is standalone once downloaded).
  const serializeSvg = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return '';
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    clone.removeAttribute('style');
    const hl = clone.querySelector('.seq-headlayer') as HTMLElement | null;
    if (hl) hl.style.transform = '';
    const hbg = clone.querySelector('.headerbg') as HTMLElement | null;
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

  const download = (name: string, blob: Blob) => {
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

  const pickMime = () => {
    for (const m of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
      try { if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m; } catch { /* probe failed */ }
    }
    return '';
  };
  const canRecord = EV.length > 0 && typeof MediaRecorder !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream && !!pickMime();

  // WebM walkthrough: rasterize each beat's SVG onto an offscreen canvas whose
  // stream MediaRecorder captures, with a caption bar per beat. The button is
  // DISABLED (not silently broken) when the browser lacks the pieces.
  const recordWalkthrough = async () => {
    const mime = pickMime();
    if (recording || !mime) return;
    setPlaying(false);
    setRecording(true);
    const savedCur = cur;
    const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
    // Two frames: let React commit the new step before the SVG is rasterized.
    const settle = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
    const clip = (ctx: CanvasRenderingContext2D, s: Any, max: number) => {
      let out = String(s == null ? '' : s);
      if (ctx.measureText(out).width <= max) return out;
      while (out.length && ctx.measureText(`${out}…`).width > max) out = out.slice(0, -1);
      return `${out}…`;
    };
    const scale = Math.max(1, Math.min(2, 1600 / Math.max(W, H)));
    const cw = Math.round(W * scale), ch = Math.round(H * scale);
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const ctx = cv.getContext('2d')!;
    const bg = (svgRef.current ? getComputedStyle(svgRef.current).getPropertyValue('--bg').trim() : '') || '#0f1117';
    const stream = cv.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = ev => { if (ev.data && ev.data.size) chunks.push(ev.data); };
    const stopped = new Promise(res => { rec.onstop = res; });
    let img: HTMLImageElement | null = null;
    const load = () => new Promise<void>(res => {
      const im = new Image();
      im.onload = () => { img = im; res(); };
      im.onerror = () => res();
      im.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serializeSvg())}`;
    });
    const paint = (i: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cw, ch);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      if (img) ctx.drawImage(img, 0, 0);
      const ev = EV[i] || {}, barH = Math.max(56, Math.round(H * 0.15)), y = H - barH, pad = 18;
      ctx.fillStyle = 'rgba(9,11,17,0.82)';
      ctx.fillRect(0, y, W, barH);
      ctx.fillStyle = '#ff9900';
      ctx.fillRect(0, y, 6, barH);
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${Math.round(barH * 0.28)}px 'Amazon Ember','Helvetica Neue',Arial,sans-serif`;
      ctx.fillText(clip(ctx, `${i + 1} / ${EV.length}   ${tr(ev.title, lang) || tr(ev.label, lang) || ''}`, W - 2 * pad), pad, y + barH * 0.16);
      const d = String(tr(ev.desc, lang) || '').replace(/[*`_]/g, '');
      if (d) {
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.font = `400 ${Math.round(barH * 0.22)}px 'Amazon Ember','Helvetica Neue',Arial,sans-serif`;
        ctx.fillText(clip(ctx, d, W - 2 * pad), pad, y + barH * 0.56);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };
    const hold = async (i: number, ms: number) => {
      const end = performance.now() + ms;
      while (performance.now() < end) { paint(i); await wait(1000 / 30); }
    };
    rec.start();
    try {
      setCur(0); await settle(); await load(); await hold(0, 300);
      for (let i = 0; i < EV.length; i++) {
        setCur(i);
        setRecLabel(`REC ${i + 1}/${EV.length}`);
        await settle(); await load(); await hold(i, Math.max(900, speed));
      }
      await wait(250);
    } finally {
      rec.stop();
      await stopped;
      try { download('sequence-walkthrough.webm', new Blob(chunks, { type: mime })); } catch { /* nothing captured */ }
      stream.getTracks().forEach(tk => tk.stop());
      setRecLabel('REC');
      setRecording(false);
      setCur(savedCur);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────
  const activeColor = (e?.tone && TONE[e.tone]) || '#ff9900';
  const title = tr(seq?.title, lang) || '';
  const subtitle = tr(seq?.subtitle, lang) || '';

  return (
    <div className="ld-seqp" style={{ ['--active' as Any]: activeColor }}>
      <div ref={stageRef} className="sq-stage"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={endDrag} onPointerCancel={endDrag}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width={W} height={H} xmlns="http://www.w3.org/2000/svg">
          <defs>
            {/* filled heads = synchronous call */}
            {[['ah', 'var(--msg)'], ['ahr', 'var(--ret)'], ['aha', '#ff9900']].map(([id, c]) => (
              <marker key={id} id={`sq-${id}`} markerWidth={12} markerHeight={12} refX={9} refY={4}
                orient="auto" markerUnits="userSpaceOnUse">
                <path d="M0,0 L10,4 L0,8 z" fill={c} />
              </marker>
            ))}
            {/* open heads = async / reply / create */}
            {[['ao', 'var(--msg)'], ['aor', 'var(--ret)'], ['aoa', '#ff9900']].map(([id, c]) => (
              <marker key={id} id={`sq-${id}`} markerWidth={14} markerHeight={12} refX={9} refY={4}
                orient="auto" markerUnits="userSpaceOnUse">
                <path d="M0,0 L10,4 L0,8" fill="none" stroke={c} strokeWidth={1.6} />
              </marker>
            ))}
          </defs>

          {/* participant grouping boxes */}
          {L.groupBoxes.map((g: Any, i: number) => (
            <g key={`g${i}`} className="grp">
              <rect x={g.x} y={8} width={g.w} height={H - 8 - 14} rx={8} stroke={g.color} />
              {/* inline style, not a `fill` attribute: the `.grp rect` rule would
                  otherwise win over it and leave white label text on a pale box. */}
              <rect className="gtabbg" x={g.x} y={8} width={g.tw} height={18} rx={4} style={{ fill: g.color }} />
              <text className="gtab" x={g.x + 8} y={21}>{g.label}</text>
            </g>
          ))}

          {/* lifelines — dimmed when the step does not touch them */}
          {P.map((p: Any, i: number) => {
            const shown = L.pStartStep[i] < 0 || cur >= L.pStartStep[i];
            const dim = shown && involved && !involved.has(i);
            return (
              <line key={`l${i}`} className="lifeline" x1={cx(i)} y1={L.lifeTopOf(i)} x2={cx(i)} y2={L.lifeBotOf(i)}
                style={{ opacity: !shown ? 0 : dim ? 0.12 : 1 }} />
            );
          })}
          {P.map((p: Any, i: number) => (L.pEndStep[i] >= 0 ? (
            <g key={`x${i}`} className="destroy" style={{ opacity: cur >= L.pEndStep[i] ? 1 : 0 }}>
              <line x1={cx(i) - 8} y1={L.lifeBotOf(i) - 8} x2={cx(i) + 8} y2={L.lifeBotOf(i) + 8} />
              <line x1={cx(i) - 8} y1={L.lifeBotOf(i) + 8} x2={cx(i) + 8} y2={L.lifeBotOf(i) - 8} />
            </g>
          ) : null))}

          {/* activation / execution bars */}
          {L.acts.map((a: Any, i: number) => (
            <g key={`a${i}`} className={`exec${cur >= a.from && cur <= a.to ? ' hot' : ''}`}
              style={{ opacity: cur >= a.from ? 1 : 0 }}>
              <rect x={cx(a.p) - 4.5} y={rowY(a.from) - 8} width={9}
                height={Math.max(18, rowY(a.to) - rowY(a.from) + 16)} rx={2} />
            </g>
          ))}

          {/* combined fragments (alt/opt/loop/par/…) with their dividers */}
          {L.frames.map((f: Any, i: number) => (
            <g key={`f${i}`} className="frame" style={{ opacity: cur >= f.start ? 1 : 0 }}>
              <rect x={f.xmin} y={f.y1} width={f.xmax - f.xmin} height={f.y2 - f.y1} rx={6} stroke={f.color} />
              <rect className="flabelbg" x={f.xmin} y={f.y1} height={17} style={{ fill: f.color }}
                width={Math.max(70, (String(f.fr.kind).length + String(f.fr.label || '').length) * 6 + 24)} />
              <text className="flabel" x={f.xmin + 7} y={f.y1 + 13}>{`${f.fr.kind}  ${f.fr.label || ''}`}</text>
              {f.dividers.map((d: Any, k: number) => (
                <g key={k} style={{ opacity: cur >= d.at ? 1 : 0 }}>
                  <line className="elsediv" x1={f.xmin} y1={rowY(d.at) - 32} x2={f.xmax} y2={rowY(d.at) - 32} />
                  <text className="elsetxt" x={f.xmin + 7} y={rowY(d.at) - 36}>{d.label}</text>
                </g>
              ))}
            </g>
          ))}

          {/* events: notes + messages, revealed up to the current step */}
          {L.evGeom.map((g: Any, n: number) => {
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
            {P.map((p: Any, i: number) => {
              const shown = L.pStartStep[i] < 0 || cur >= L.pStartStep[i];
              const dim = shown && involved && !involved.has(i);
              const cls = `${p.actor ? 'actor' : 'phead'}`
                + `${!p.actor && p.icon && resolveIcon(String(p.icon)) ? ' iconhead' : ''}`
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
      <div className="sq-card">
        <div className="rail">{EV.map((_: Any, i: number) => <i key={i} className={i <= cur ? 'on' : ''} />)}</div>
        <div className="cardhead">
          <span>{e?.badge ? <span className={`badge b-${e.badge}`}>{BADGE_TXT[e.badge] || e.badge}</span> : null}</span>
          <span className="counter">{`${cur + 1} / ${EV.length}`}</span>
        </div>
        {/* Step number BEFORE the step: the reader sees where they are without
            hunting for the counter in the corner. */}
        <div className="title">
          {e && <span className="stepnum">{cur + 1}</span>}
          {e ? (tr(e.title, lang) || tr(e.label, lang) || '') : ''}
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
      </div>

      {/* floating pill toolbar */}
      {dockVisible ? (
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
          <button className={`pbtn wide${recording ? ' on' : ''}`} onClick={recordWalkthrough}
            disabled={!canRecord || recording}
            title={canRecord ? 'Record walkthrough (WebM)' : 'WebM recording is not supported in this browser'}>{recLabel}</button>
          <span className="sep" />
          <button className="pbtn" onClick={() => setDockVisible(false)} title={t('hideControls', 'Hide controls')} aria-label="hide controls">
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </button>
        </div>
      ) : (
        <button className="sq-expand" onClick={() => setDockVisible(true)} title={t('showControls', 'Show controls')} aria-label="show controls">▲</button>
      )}
    </div>
  );
}

export default SequenceDiagram;
