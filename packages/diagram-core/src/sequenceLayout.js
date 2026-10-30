// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// UML sequence layout — the ONE geometry behind both sequence renderers: the
// React <SequencePlayer> (./components/SequencePlayer.jsx) and the MCP's
// self-contained HTML player (lib/sequence-template.html, into which
// lib/sequence-generator.js inlines this file). Same document → same columns,
// rows, activation bars, fragments and arrows.
//
// Kept dependency-free and import-free ON PURPOSE: the generator inlines this
// source into a classic <script> (it strips the `export` keywords), so nothing
// here may import or touch the DOM.

// Longest text a value can render, across EVERY offered language: a { en, pt }
// label must not overlap its neighbour after a language switch either.
function textLen(v) {
  if (v == null) return 0;
  if (typeof v === 'object') return Math.max(0, ...Object.values(v).map(s => String(s ?? '').length));
  return String(v).length;
}

/** Width of a participant's header box — the same formula the renderers draw it with. */
export function sequenceHeadBoxW(p) {
  return Math.max(96, textLen(p?.label) * 6.4 + 18, textLen(p?.sub) * 5.6 + 18, textLen(p?.stereotype) * 5.6 + 22);
}

// ── layout (pure) ───────────────────────────────────────────────────────────
// Everything the SVG needs, derived once per sequence: column/row geometry,
// instance create/destroy rows, activation bars, fragment boxes, group boxes and
// one descriptor per event. `opts.tones` maps a fragment/group tone name to its
// colour (the player palette).
export function layoutSequence(seq, opts) {
  const TONE = (opts && opts.tones) || {};
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
