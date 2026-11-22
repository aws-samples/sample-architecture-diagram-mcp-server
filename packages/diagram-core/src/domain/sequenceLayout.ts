// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// UML sequence layout — the ONE geometry behind both sequence renderers: the
// React <SequencePlayer> (./components/SequencePlayer.jsx) and the MCP's
// self-contained HTML player (server/assets/sequence-template.html, into which
// the sequence renderer inlines this file). Same document → same columns,
// rows, activation bars, fragments and arrows.
//
// Kept dependency-free and import-free ON PURPOSE: the generator inlines this
// source into a classic <script> (it strips the `export` keywords), so nothing
// here may import or touch the DOM.
//
// The input types below describe only what the layout READS (structurally); the
// full document contract is SequenceDoc in ./schemas/sequence — which satisfies
// them. They live here because an inlined module cannot import, not even types.

// Maps keyed by author ids are prototype-free, and the caller's tone table is
// read for own entries only, so an id or tone such as "constructor" or
// "__proto__" is an ordinary key (copied from own.ts: this module is inlined
// into the HTML player and cannot import).
const seqDict = <V>(): Record<string, V> => Object.create(null) as Record<string, V>;
const seqOwn = <V>(table: Record<string, V>, key: string): V | undefined => (Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined);

/** A label as the layout measures it: a string or a per-language map. */
export type SeqLayoutText = string | { [lang: string]: string | null | undefined };
export interface SeqLayoutParticipant {
  id: string;
  label?: SeqLayoutText;
  sub?: SeqLayoutText;
  stereotype?: SeqLayoutText;
  actor?: boolean;
  icon?: string;
}
export interface SeqLayoutEvent {
  kind?: string;
  id?: string;
  from?: string;
  to?: string;
  over?: string[];
  arrow?: string;
  style?: string;
  activate?: boolean;
  deactivate?: boolean;
  create?: boolean;
  destroy?: boolean;
  found?: boolean;
  lost?: boolean;
}
export interface SeqLayoutFragment {
  startId: string;
  endId: string;
  tone?: string;
  dividers?: { beforeId: string; label?: string }[];
}
export interface SeqLayoutGroup {
  label?: string;
  participants?: string[];
  tone?: string;
}
export interface SequenceLayoutInput<P extends SeqLayoutParticipant = SeqLayoutParticipant, E extends SeqLayoutEvent = SeqLayoutEvent, F extends SeqLayoutFragment = SeqLayoutFragment> {
  participants?: P[];
  events?: E[];
  fragments?: F[];
  groups?: SeqLayoutGroup[];
  autoActivate?: boolean;
}
export interface SequenceLayoutOptions {
  /** Fragment / group tone name → colour (the player palette). */
  tones?: Record<string, string>;
}
/** Fields every event geometry carries. */
export interface SeqGeomBase {
  y: number;
  cls: 'note' | 'ret' | 'msg';
  marker: 'aor' | 'ao' | 'ah';
  drawOn: boolean;
}
/** One event's geometry, discriminated by `shape`. */
export type SeqEventGeom = SeqGeomBase & (
  | { shape: 'none' }
  | { shape: 'note'; x1: number; x2: number }
  | { shape: 'boundary'; dotx: number; x1: number; x2: number; mid: number }
  | { shape: 'self'; x: number }
  | { shape: 'arrow'; isCreate: boolean; x1: number; x2: number; mid: number }
);
/** An activation bar: participant column `p`, from event row `from` to `to`. */
export interface SeqActivation { p: number; from: number; to: number }

// Longest text a value can render, across EVERY offered language: a { en, pt }
// label must not overlap its neighbour after a language switch either.
function textLen(v: SeqLayoutText | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === 'object') return Math.max(0, ...Object.values(v).map(s => String(s ?? '').length));
  return String(v).length;
}

/** Width of a participant's header box — the same formula the renderers draw it with. */
export function sequenceHeadBoxW(p: Pick<SeqLayoutParticipant, 'label' | 'sub' | 'stereotype'> | null | undefined): number {
  return Math.max(96, textLen(p?.label) * 6.4 + 18, textLen(p?.sub) * 5.6 + 18, textLen(p?.stereotype) * 5.6 + 22);
}

// ── layout (pure) ───────────────────────────────────────────────────────────
// Everything the SVG needs, derived once per sequence: column/row geometry,
// instance create/destroy rows, activation bars, fragment boxes, group boxes and
// one descriptor per event. `opts.tones` maps a fragment/group tone name to its
// colour (the player palette).
export function layoutSequence<P extends SeqLayoutParticipant = SeqLayoutParticipant, E extends SeqLayoutEvent = SeqLayoutEvent, F extends SeqLayoutFragment = SeqLayoutFragment>(
  seq: SequenceLayoutInput<P, E, F> | null | undefined, opts?: SequenceLayoutOptions | null,
) {
  const TONE: Record<string, string> = (opts && opts.tones) || {};
  const toneOf = (t: unknown): string | undefined => seqOwn(TONE, String(t));
  const P = seq?.participants || [];
  const EV = seq?.events || [];
  const FRAGS = seq?.fragments || [];
  const GROUPS = seq?.groups || [];

  const idx: Record<string, number> = seqDict();
  // Column of a participant id (any value: property-key coercion, as in JS).
  const ix = (id: unknown): number | undefined => idx[String(id)];
  P.forEach((p, i) => { if (p?.id != null) idx[p.id] = i; });
  const evIndexById: Record<string, number> = seqDict();
  const evAt = (id: unknown): number | undefined => evIndexById[String(id)];
  EV.forEach((e, i) => { if (e?.id != null) evIndexById[e.id] = i; });

  const HAS_GROUPS = GROUPS.length > 0;
  const HAS_STEREO = P.some(p => p.stereotype && !p.actor);
  // Column pitch has to clear the WIDEST header box, or two long labels
  // ("Developer Hub (ns rhdh)" next to "Keycloak (fonte-da-verdade)") overlap.
  // Measured over every offered language, so a language switch cannot break the
  // spacing either — `w` in Head() uses the same formula on the active language.
  const HEAD_W = Math.max(0, ...P.filter(p => !p?.actor).map(sequenceHeadBoxW));
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
  const XS: number[] = [];
  let shift = 0;
  P.forEach((_, i) => {
    if (i > 0 && groupOf[i] !== groupOf[i - 1]) shift += GUT;
    XS.push(X0 + i * COL + shift);
  });
  const cx = (i: number): number => (XS[i] != null ? XS[i] : X0 + i * COL);
  const W = (XS.length ? XS[XS.length - 1] : X0) + 95;
  const H = ROW0 + EV.length * ROW + 40;
  const rowY = (n: number): number => ROW0 + n * ROW;

  // UML instance creation / destruction rows, per participant id.
  const createRow: Record<string, number> = seqDict(), destroyRow: Record<string, number> = seqDict();
  EV.forEach((e, n) => {
    if (e?.kind !== 'message') return;
    if (e.create && e.to != null) createRow[e.to] = n;
    if (e.destroy && e.to != null) destroyRow[e.to] = n;
  });
  const pStartStep = P.map(p => (createRow[p.id] != null ? createRow[p.id] : -1));
  const pEndStep = P.map(p => (destroyRow[p.id] != null ? destroyRow[p.id] : -1));
  // A created object's box sits ON the creating row; a destroyed one's lifeline
  // stops at the ✕ instead of running to the bottom.
  const headTopOf = (i: number): number => (pStartStep[i] >= 0 ? rowY(pStartStep[i]) - HEAD_H / 2 : HEAD_Y);
  const lifeTopOf = (i: number): number => (pStartStep[i] >= 0 ? rowY(pStartStep[i]) + HEAD_H / 2 : LIFE_TOP);
  const lifeBotOf = (i: number): number => (pEndStep[i] >= 0 ? rowY(pEndStep[i]) : H - 24);

  // Which lifelines an event touches (a note spans `over`; a message is from→to
  // minus the boundary end of a found/lost message, which has no lifeline).
  const eventParticipants = (e: E | null | undefined): number[] => {
    if (!e) return [];
    const s = new Set<number>();
    const add = (i: number | undefined) => { if (i != null) s.add(i); };
    if (e.kind === 'note') (e.over || []).forEach((o) => add(ix(o)));
    else {
      if (!e.found) add(ix(e.from));
      if (!e.lost) add(ix(e.to));
    }
    return [...s];
  };

  // Activation (execution) bars. Explicit mode as soon as ANY message carries
  // activate/deactivate (a stack per participant, leftovers closing at the end);
  // otherwise auto-derived — an incoming call stays active until its target
  // answers — then merged per column so overlapping runs become one bar.
  const acts = ((): SeqActivation[] => {
    const explicit = EV.some(e => e?.kind === 'message' && (e.activate || e.deactivate));
    if (explicit) {
      const stacks: Record<number, SeqActivation[]> = {}, out: SeqActivation[] = [];
      EV.forEach((e, n) => {
        if (e?.kind !== 'message') return;
        const pTo = ix(e.to), pFrom = ix(e.from);
        if (e.activate && pTo != null) {
          const p = pTo;
          (stacks[p] = stacks[p] || []).push({ p, from: n, to: n });
        }
        if (e.deactivate && pFrom != null) {
          const st = stacks[pFrom];
          const a = st && st.pop();
          if (a) { a.to = n; out.push(a); }
        }
      });
      Object.values(stacks).forEach(st => st.forEach(a => { a.to = EV.length - 1; out.push(a); }));
      return out;
    }
    if (seq?.autoActivate === false) return [];
    const raw: SeqActivation[] = [];
    EV.forEach((e, n) => {
      if (e?.kind !== 'message' || e.found || e.from === e.to) return;
      const p = ix(e.to);
      if (p == null) return;
      let end = n;
      for (let m = n + 1; m < EV.length; m++) {
        const e2 = EV[m];
        if (e2?.kind === 'message' && ix(e2.from) === p) { end = m; break; }
      }
      raw.push({ p, from: n, to: end });
    });
    const byP: Record<number, SeqActivation[]> = {};
    raw.forEach(a => { (byP[a.p] = byP[a.p] || []).push(a); });
    const merged: SeqActivation[] = [];
    Object.keys(byP).forEach(k => {
      let run: SeqActivation | null = null;
      byP[+k].sort((a, b) => a.from - b.from).forEach(a => {
        if (run && a.from <= run.to) run.to = Math.max(run.to, a.to);
        else { run = { p: +k, from: a.from, to: a.to }; merged.push(run); }
      });
    });
    return merged;
  })();

  // Combined fragments: the horizontal span comes from the enclosed events.
  const frames = FRAGS.map((fr) => {
    const start = evAt(fr.startId), end = evAt(fr.endId);
    if (start == null || end == null) return null;
    const parts = new Set<number>();
    for (let i = start; i <= end; i++) eventParticipants(EV[i]).forEach(p => parts.add(p));
    if (!parts.size) return null;
    const cols = [...parts];
    return {
      fr, start,
      color: toneOf(fr.tone) || '#5f6b7a',
      xmin: cx(Math.min(...cols)) - 48,
      xmax: cx(Math.max(...cols)) + 48,
      y1: rowY(start) - 32,
      y2: rowY(end) + 22,
      dividers: (fr.dividers || [])
        .map((d) => ({ at: evAt(d.beforeId), label: d.label }))
        .filter((d): d is { at: number; label: string | undefined } => d.at != null),
    };
  }).filter(<T>(x: T | null): x is T => x != null);

  // Participant grouping boxes (PlantUML `box`), drawn behind the lifelines.
  const groupBoxes = GROUPS.map((gr) => {
    const cols = (gr.participants || []).map((id) => ix(id)).filter((v): v is number => v != null);
    if (!cols.length) return null;
    const a = Math.min(...cols), b = Math.max(...cols);
    const label = String(gr.label || '');
    return {
      label, color: toneOf(gr.tone) || '#8593a3',
      x: cx(a) - COL * 0.44, w: cx(b) - cx(a) + COL * 0.88,
      tw: Math.max(60, label.length * 6.6 + 16),
    };
  }).filter(<T>(x: T | null): x is T => x != null);

  // One geometry descriptor per event, so the render pass stays a plain map.
  const evGeom = EV.map((e, n): SeqEventGeom => {
    const y = rowY(n);
    const kind = e?.kind === 'message' ? (e.arrow || (e.style === 'dashed' ? 'reply' : 'sync')) : null;
    const isReply = kind === 'reply';
    const isCreate = e?.kind === 'message' && !!e.create;
    // UML: a «create» message is drawn like a reply (open head onto the new
    // object's box), not as a solid call.
    const cls = e?.kind === 'note' ? 'note' : (isReply || isCreate ? 'ret' : 'msg');
    const marker = (isReply || isCreate) ? 'aor' : (kind === 'async' ? 'ao' : 'ah');
    const base: SeqGeomBase = { y, cls, marker, drawOn: cls === 'msg' };

    if (e?.kind === 'note') {
      // `over` is a SET of lifelines, not a range: take the leftmost/rightmost
      // column so a note authored as ['cb','new'] still gets a positive width.
      const cols = (e.over || []).map((id) => ix(id)).filter((v): v is number => v != null);
      if (!cols.length) return { ...base, shape: 'none' };
      return { ...base, shape: 'note', x1: cx(Math.min(...cols)) - 56, x2: cx(Math.max(...cols)) + 56 };
    }
    if (e?.found || e?.lost) {
      const ai = ix(e.found ? e.to : e.from);
      if (ai == null) return { ...base, shape: 'none' };
      const side = ai === 0 ? 1 : -1;                  // dot on the outward side
      const dotx = cx(ai) + side * 64;
      const xa = e.found ? dotx : cx(ai), xb = e.found ? cx(ai) : dotx;
      const dir = xb > xa ? 1 : -1;
      return { ...base, shape: 'boundary', dotx, x1: xa, x2: xb - dir * 6, mid: (xa + xb) / 2 };
    }
    if (e?.from === e?.to) {
      const i = ix(e.from);
      if (i == null) return { ...base, shape: 'none' };
      return { ...base, shape: 'self', x: cx(i) };
    }
    const ia = ix(e.from), ib = ix(e.to);
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

/** The geometry layoutSequence returns (default input types). */
export type SequenceLayout = ReturnType<typeof layoutSequence>;
