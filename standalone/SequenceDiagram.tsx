// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Animated UML sequence view — the second tab of a multi-tab diagram document.
//
// Why hand-rolled instead of Mermaid: the generated HTML must stay a SINGLE
// self-contained file (no CDN, works under file://), it has to share the same
// tone vocabulary / icon set / light-dark vars as the architecture canvas, and
// it has to ANIMATE beat by beat like the walkthrough does (reveal + highlight +
// auto-scroll), which a static Mermaid render cannot do.
//
// Input shape: lib/schemas.js → sequenceSchema (participants + a FLAT event list
// with explicit fragment/else/end markers, i.e. the Mermaid mental model).
import { useEffect, useMemo, useRef, useState } from 'react';
import { tr, resolveToneColor } from '@aws-live-diagram/core';
import { McpIcon } from './McpIcon';

// ── layout constants (px) ──
const COL_W = 214;       // one participant column
const PAD_X = 34;        // canvas side padding
const TOP_PAD = 26;      // gap between the header row and the first beat
const BOT_PAD = 46;
const ROW = { message: 64, self: 92, note: 74, fragment: 46, else: 38, end: 22 };
const LINE_H = 17;       // extra height per additional label line

type Any = any;

// Strip the inline-markdown markers: SVG <text> has no bold/code spans, so the
// canvas shows clean text and the caption strip below renders the rich version.
const plain = (s: string) => String(s || '').replace(/\*\*|`|\*/g, '');
const lines = (s: string) => plain(s).split('\n').filter(Boolean);

function kindOf(e: Any) {
  return e?.kind || 'message';
}

/** Pre-compute y positions, fragment boxes and per-event geometry. */
function useGeometry(seq: Any, lang: string) {
  return useMemo(() => {
    const parts: Any[] = seq?.participants || [];
    const xOf: Record<string, number> = {};
    parts.forEach((p, i) => { xOf[p.id] = PAD_X + COL_W * i + COL_W / 2; });
    const idxOf: Record<string, number> = {};
    parts.forEach((p, i) => { idxOf[p.id] = i; });

    const events: Any[] = seq?.events || [];
    const rows: Any[] = [];
    const frames: Any[] = [];   // fragment boxes {op, cond, top, bottom, x1, x2, elses[]}
    const stack: Any[] = [];
    let y = TOP_PAD;
    let num = 0;

    const spanOf = (ids?: string[]) => {
      const list = (ids || []).filter(id => xOf[id] != null);
      if (!list.length) return null;
      const xs = list.map(id => xOf[id]);
      return { x1: Math.min(...xs), x2: Math.max(...xs) };
    };

    events.forEach((e, i) => {
      const k = kindOf(e);
      const label = tr(e.label, lang);
      const nLines = Math.max(1, lines(label).length);
      const extra = (nLines - 1) * LINE_H;

      if (k === 'fragment') {
        const f = {
          op: e.fragment || 'alt',
          cond: tr(e.condition, lang),
          top: y,
          bottom: y + ROW.fragment,
          over: e.over,
          members: new Set<string>(e.over || []),
          elses: [] as Any[],
          tone: e.tone,
          color: e.color,
          index: i,
        };
        stack.push(f);
        frames.push(f);
        rows.push({ i, k, y, h: ROW.fragment, frame: f });
        y += ROW.fragment;
        return;
      }
      if (k === 'else') {
        const f = stack[stack.length - 1];
        const row = { i, k, y, h: ROW.else + extra, cond: tr(e.condition, lang) || label, frame: f };
        if (f) f.elses.push(row);
        rows.push(row);
        y += row.h;
        return;
      }
      if (k === 'end') {
        const f = stack.pop();
        if (f) f.bottom = y + ROW.end;
        rows.push({ i, k, y, h: ROW.end, frame: f });
        y += ROW.end;
        return;
      }
      if (k === 'note') {
        const span = spanOf(e.over && e.over.length ? e.over : parts.map(p => p.id));
        const h = ROW.note + extra;
        rows.push({ i, k, y, h, span, label, nLines });
        for (const id of e.over || []) stack.forEach(f => f.members.add(id));
        y += h;
        return;
      }
      // message
      const self = e.from && e.to && e.from === e.to;
      const h = (self ? ROW.self : ROW.message) + extra;
      num += 1;
      rows.push({
        i, k: 'message', y, h, self, label, nLines, num,
        x1: xOf[e.from], x2: xOf[e.to],
        from: e.from, to: e.to,
      });
      for (const id of [e.from, e.to]) if (id) stack.forEach(f => f.members.add(id));
      y += h;
    });

    // Fragments with no explicit `over` span every lifeline they contain.
    for (const f of frames) {
      const s = spanOf(f.over && f.over.length ? f.over : Array.from(f.members));
      f.x1 = s ? s.x1 : PAD_X + COL_W / 2;
      f.x2 = s ? s.x2 : PAD_X + COL_W * Math.max(0, parts.length - 1) + COL_W / 2;
    }

    return {
      parts, xOf, idxOf, rows, frames,
      width: PAD_X * 2 + COL_W * Math.max(1, parts.length),
      height: y + BOT_PAD,
      messageCount: num,
    };
  }, [seq, lang]);
}

function Arrow({ x1, x2, y, color, dashed, async: asyncArrow, strong }: Any) {
  const dir = x2 >= x1 ? 1 : -1;
  const tip = x2 - dir * 4;
  const head = asyncArrow
    ? <path d={`M ${tip} ${y} L ${tip - dir * 9} ${y - 5} M ${tip} ${y} L ${tip - dir * 9} ${y + 5}`}
        stroke={color} strokeWidth={strong ? 2 : 1.4} fill="none" strokeLinecap="round" />
    : <path d={`M ${tip} ${y} L ${tip - dir * 10} ${y - 4.6} L ${tip - dir * 10} ${y + 4.6} Z`} fill={color} />;
  return (
    <>
      <line x1={x1 + dir * 4} y1={y} x2={tip - dir * 2} y2={y}
        stroke={color} strokeWidth={strong ? 2.1 : 1.4}
        strokeDasharray={dashed ? '6 4' : undefined} strokeLinecap="round" />
      {head}
    </>
  );
}

function SelfArrow({ x, y, color, dashed, strong }: Any) {
  const w = 62, h = 26;
  return (
    <>
      <path d={`M ${x + 4} ${y} H ${x + w} V ${y + h} H ${x + 12}`}
        stroke={color} strokeWidth={strong ? 2.1 : 1.4} fill="none"
        strokeDasharray={dashed ? '6 4' : undefined} strokeLinejoin="round" />
      <path d={`M ${x + 6} ${y + h} L ${x + 16} ${y + h - 4.6} L ${x + 16} ${y + h + 4.6} Z`} fill={color} />
    </>
  );
}

export function SequenceDiagram({ seq, lang = 'en', active = true, ui }: Any) {
  const g = useGeometry(seq, lang);
  const events: Any[] = seq?.events || [];
  const autonumber = seq?.autonumber !== false;

  // idx = last revealed beat. -1 = nothing revealed yet (invite to press play).
  const [idx, setIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const last = events.length - 1;
  const step = (d: number) => { setPlaying(false); setIdx(v => Math.max(-1, Math.min(last, v + d))); };

  // Autoplay: a beat every ~1.6s (scaled by speed); stops at the end.
  useEffect(() => {
    if (!playing) return;
    if (idx >= last) { setPlaying(false); return; }
    const t = setTimeout(() => setIdx(v => Math.min(last, v + 1)), 1600 / speed);
    return () => clearTimeout(t);
  }, [playing, idx, last, speed]);

  // Keyboard only while this tab is the visible one (the architecture tab owns
  // the arrow keys otherwise).
  useEffect(() => {
    if (!active) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') { ev.preventDefault(); step(1); }
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') { ev.preventDefault(); step(-1); }
      else if (ev.key === ' ') { ev.preventDefault(); setPlaying(p => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, last]);

  // Keep the active beat in view.
  useEffect(() => {
    const el = scrollRef.current;
    const row = g.rows.find((r: Any) => r.i === idx);
    if (!el || !row) return;
    const target = row.y - el.clientHeight * 0.45 + 90;
    el.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [idx, g.rows]);

  const visible = (i: number) => showAll || i <= idx;
  const activeEv = idx >= 0 ? events[idx] : null;
  const activeRow = g.rows.find((r: Any) => r.i === idx);

  const t = (k: string, fb: string) => (ui ? ui(k, lang) || fb : fb);

  return (
    <div className="ld-seq">
      {(seq?.title || seq?.subtitle) && (
        <div className="ld-seq-head">
          {seq?.title && <h2>{tr(seq.title, lang)}</h2>}
          {seq?.subtitle && <p>{tr(seq.subtitle, lang)}</p>}
        </div>
      )}

      {/* controls */}
      <div className="ld-seq-bar">
        <button className="ld-seq-btn" onClick={() => { setPlaying(false); setIdx(-1); }} title={t('restart', 'Restart')}>⟲</button>
        <button className="ld-seq-btn" onClick={() => step(-1)} disabled={idx < 0} title="←">◀</button>
        <button className={`ld-seq-btn ld-seq-play${!playing && idx < 0 ? ' ld-play-attention' : ''}`}
          onClick={() => { if (idx >= last) setIdx(-1); setPlaying(p => !p); }}
          title={playing ? t('pause', 'Pause') : t('play', 'Play')}>{playing ? '❙❙' : '▶'}</button>
        <button className="ld-seq-btn" onClick={() => step(1)} disabled={idx >= last} title="→">▶</button>
        <span className="ld-seq-count">{Math.max(0, idx + 1)} / {events.length}</span>
        <div className="ld-seq-progress"><i style={{ width: `${((idx + 1) / Math.max(1, events.length)) * 100}%` }} /></div>
        <button className="ld-seq-btn ld-seq-wide" onClick={() => setSpeed(s => (s === 1 ? 2 : s === 2 ? 0.5 : 1))}>{speed}×</button>
        <button className={`ld-seq-btn ld-seq-wide${showAll ? ' on' : ''}`} onClick={() => setShowAll(v => !v)}>
          {showAll ? t('seqStep', 'step') : t('seqAll', 'all')}
        </button>
      </div>

      <div className="ld-seq-scroll" ref={scrollRef}>
        <div style={{ width: g.width, position: 'relative' }}>
          {/* participant headers — sticky so the columns stay labeled while scrolling */}
          <div className="ld-seq-heads" style={{ width: g.width }}>
            {g.parts.map((p: Any) => {
              const c = p.color || 'var(--txt)';
              const on = activeEv && (activeEv.from === p.id || activeEv.to === p.id || (activeEv.over || []).includes(p.id));
              return (
                <div key={p.id} className={`ld-seq-head-cell${on ? ' on' : ''}`} style={{ width: COL_W }}>
                  <div className="ld-seq-head-box" style={on ? { borderColor: resolveToneColor(activeEv?.tone, activeEv?.color) } : undefined}>
                    {p.icon
                      ? <McpIcon src={p.icon} size={22} alt={tr(p.label, lang)} />
                      : <span className="ld-seq-glyph">{p.kind === 'actor' ? '☖' : '▣'}</span>}
                    <span className="ld-seq-head-txt" style={{ color: p.color || undefined }}>
                      {plain(tr(p.label, lang)).split('\n').map((l, i) => <span key={i}>{l}</span>)}
                    </span>
                  </div>
                  {p.pill && <span className="ld-seq-pill">{tr(p.pill, lang)}</span>}
                </div>
              );
            })}
          </div>

          <svg width={g.width} height={g.height} className="ld-seq-svg">
            {/* fragment boxes (behind everything) */}
            {g.frames.map((f: Any, i: number) => {
              const vis = visible(f.index);
              const col = resolveToneColor(f.tone, f.color);
              const x1 = Math.max(10, f.x1 - 92), x2 = Math.min(g.width - 10, f.x2 + 92);
              const opTxt = `${f.op}${f.cond ? ` [${f.cond}]` : ''}`;
              return (
                <g key={`f${i}`} opacity={vis ? 1 : 0.07} style={{ transition: 'opacity .35s' }}>
                  <rect x={x1} y={f.top} width={x2 - x1} height={Math.max(24, f.bottom - f.top)}
                    rx={8} fill="none" stroke={col} strokeOpacity={0.45} strokeDasharray="5 4" />
                  <path d={`M ${x1} ${f.top} h ${Math.min(x2 - x1, 46 + opTxt.length * 6)} l -12 18 H ${x1} Z`}
                    fill={col} fillOpacity={0.14} stroke={col} strokeOpacity={0.4} />
                  <text x={x1 + 9} y={f.top + 13.5} className="ld-seq-frag" fill={col}>{opTxt}</text>
                  {f.elses.map((el: Any, j: number) => (
                    <g key={j}>
                      <line x1={x1} y1={el.y + 6} x2={x2} y2={el.y + 6} stroke={col} strokeOpacity={0.35} strokeDasharray="5 4" />
                      <text x={x1 + 9} y={el.y + 22} className="ld-seq-frag" fill={col}>[{el.cond}]</text>
                    </g>
                  ))}
                </g>
              );
            })}

            {/* lifelines */}
            {g.parts.map((p: Any) => (
              <line key={p.id} x1={g.xOf[p.id]} y1={0} x2={g.xOf[p.id]} y2={g.height - 18}
                stroke={p.color || 'var(--border-strong, rgba(120,130,150,0.45))'}
                strokeWidth={1} strokeDasharray="4 5" />
            ))}

            {/* beats */}
            {g.rows.map((r: Any) => {
              const e = events[r.i];
              if (!e || r.k === 'end' || r.k === 'else' || r.k === 'fragment') return null;
              const vis = visible(r.i);
              const isActive = r.i === idx;
              const col = resolveToneColor(e.tone, e.color);
              const gate = !!e.gate;
              const op = vis ? (showAll || isActive ? 1 : 0.62) : 0.07;

              if (r.k === 'note') {
                const x1 = Math.max(12, (r.span?.x1 ?? PAD_X) - 78);
                const x2 = Math.min(g.width - 12, (r.span?.x2 ?? g.width) + 78);
                return (
                  <g key={r.i} opacity={op} style={{ transition: 'opacity .35s' }}>
                    <rect x={x1} y={r.y + 6} width={x2 - x1} height={r.h - 18} rx={7}
                      fill={col} fillOpacity={isActive ? 0.18 : 0.1} stroke={col} strokeOpacity={0.55} />
                    {lines(r.label).map((l, k) => (
                      <text key={k} x={(x1 + x2) / 2} y={r.y + 28 + k * LINE_H} textAnchor="middle"
                        className="ld-seq-note" fill="var(--txt)">{l}</text>
                    ))}
                  </g>
                );
              }

              // message
              const dashed = !!(e.dashed || e.reply);
              const yArrow = r.y + 14 + (r.nLines - 1) * LINE_H;
              const labelY = r.y + 8 + (r.nLines - 1) * LINE_H;
              const mid = r.self ? r.x1 + 34 : (r.x1 + r.x2) / 2;
              return (
                <g key={r.i} opacity={op} style={{ transition: 'opacity .35s' }}>
                  {isActive && !r.self && (
                    <line x1={Math.min(r.x1, r.x2)} y1={yArrow} x2={Math.max(r.x1, r.x2)} y2={yArrow}
                      stroke={col} strokeOpacity={0.18} strokeWidth={12} strokeLinecap="round" />
                  )}
                  {r.self
                    ? <SelfArrow x={r.x1} y={yArrow} color={col} dashed={dashed} strong={isActive} />
                    : <Arrow x1={r.x1} x2={r.x2} y={yArrow} color={col} dashed={dashed} async={e.async} strong={isActive} />}
                  {lines(r.label).map((l, k) => (
                    <text key={k} x={r.self ? r.x1 + 74 : mid} y={labelY - (r.nLines - 1 - k) * LINE_H}
                      textAnchor={r.self ? 'start' : 'middle'}
                      className={`ld-seq-msg${isActive ? ' on' : ''}`} fill="var(--txt)">
                      {k === 0 && autonumber ? `${r.num}. ${l}` : l}
                    </text>
                  ))}
                  {gate && (
                    <g>
                      <rect x={mid - 24} y={yArrow + 7} width={48} height={15} rx={7.5} fill={col} fillOpacity={0.9} />
                      <text x={mid} y={yArrow + 18} textAnchor="middle" className="ld-seq-badge" fill="#111">GATE</text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* caption strip: the active beat in rich text */}
      <div className="ld-seq-caption">
        {activeEv ? (
          <>
            <span className="ld-seq-cap-dot" style={{ background: resolveToneColor(activeEv.tone, activeEv.color) }} />
            <span className="ld-seq-cap-main">
              {autonumber && activeRow?.num ? <b>{activeRow.num}. </b> : null}
              {tr(activeEv.label, lang)}
            </span>
            {activeEv.note && <span className="ld-seq-cap-note">{tr(activeEv.note, lang)}</span>}
          </>
        ) : (
          <span className="ld-seq-cap-note">
            {t('seqHint', lang === 'pt' ? 'Pressione ▶ (ou →) para percorrer o fluxo.' : 'Press ▶ (or →) to walk through the flow.')}
          </span>
        )}
      </div>

      {seq?.legend?.length ? (
        <div className="ld-seq-legend">
          {seq.legend.map((l: Any, i: number) => (
            <span key={i}><i style={{ background: resolveToneColor(l.tone, l.color) }} />{tr(l.label, lang)}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default SequenceDiagram;
