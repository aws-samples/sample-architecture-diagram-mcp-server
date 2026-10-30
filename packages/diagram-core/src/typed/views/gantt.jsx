// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── View: gantt ───
// Rows: tasks without a section first, then each section (header band + its
// tasks). Left column = task label + progress % (or milestone date); right =
// time axis (UTC day numbers → x via a linear scale). Axis ticks adapt to the
// span: weeks (≤ ~11 weeks), months, or years when months get too narrow.
// Dependencies are finish→start orthogonal arrows; when the successor starts
// before the predecessor's end (+gap) the arrow drops to the row boundary,
// runs back left and enters from the left.
import { DiagramSvg, toneColor, paletteColor, wrapText, textW, useSvgIds } from './DiagramSvg.jsx'
import { describeTypedDiagram } from '../index.js'

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const DAY = 86400000
const M = 24, CHW = 780, SEC_H = 30, BAR_H = 18, LS = 13, LLH = 16

const parse = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''))
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY : null
}
const ymd = (d) => { const t = new Date(d * DAY); return [t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()] }
const dm = (d) => { const [, mo, da] = ymd(d); return `${String(da).padStart(2, '0')}/${String(mo + 1).padStart(2, '0')}` }

function layout(doc) {
  const sections = doc.sections || []
  const secIdx = new Map(sections.map((s, i) => [s.id, i]))
  const tasks = (doc.tasks || []).map((t, i) => {
    const s = parse(t.start)
    let e = t.milestone ? s : parse(t.end)
    if (s != null && !t.milestone) e = e != null ? Math.max(e + 1, s + 1) : s + Math.max(1, Number(t.durationDays) || 1)
    return { t, i, s, e, sec: secIdx.has(t.section) ? secIdx.get(t.section) : -1 }
  })
  const dated = tasks.filter(x => x.s != null)
  const today = parse(doc.today)
  let lo = Math.min(...dated.map(x => x.s)), hi = Math.max(...dated.map(x => x.e))
  if (!dated.length) { lo = parse('2026-01-01'); hi = lo + 30 }
  if (today != null && today >= lo - 60 && today <= hi + 60) { lo = Math.min(lo, today); hi = Math.max(hi, today + 1) }
  const span0 = Math.max(7, hi - lo)
  const pad = Math.max(2, Math.round(span0 * 0.025))
  lo -= pad; hi += pad
  const span = hi - lo
  const weekly = span <= 80
  const LW = 300
  const X0 = M + LW
  const X = (d) => X0 + ((d - lo) / span) * CHW
  // rows
  const rows = []
  const add = (x) => {
    const lines = wrapText(x.t.label, LW - 78, LS)
    rows.push({ type: 'task', x, lines, h: Math.max(36, lines.length * LLH + 16) })
  }
  tasks.filter(x => x.sec < 0).forEach(add)
  sections.forEach((s, si) => {
    rows.push({ type: 'section', s, si, h: SEC_H })
    tasks.filter(x => x.sec === si).forEach(add)
  })
  const HDR = weekly ? 50 : 32
  let y = M + HDR
  for (const r of rows) { r.y = y; y += r.h }
  const H = y + M
  const W = X0 + CHW + M
  // axis segments
  const months = []
  { let [yy, mm] = ymd(lo); for (;;) { const a = Date.UTC(yy, mm, 1) / DAY; if (a >= hi) break; const b = Date.UTC(yy, mm + 1, 1) / DAY; months.push({ a, b, yy, mm }); mm++; if (mm > 11) { mm = 0; yy++ } } }
  const monthPx = CHW * 30.4 / span
  const years = []
  if (monthPx < 34) { const [y0] = ymd(lo), [y1] = ymd(hi); for (let yy = y0; yy <= y1; yy++) years.push({ a: Date.UTC(yy, 0, 1) / DAY, b: Date.UTC(yy + 1, 0, 1) / DAY, yy }) }
  const weeks = []
  if (weekly) { let d = Math.ceil(lo); while (((d % 7) + 7 + 4) % 7 !== 1) d++; for (; d < hi; d += 7) weeks.push(d) } // Mondays (epoch day 0 = Thursday)
  const rowOf = new Map(rows.filter(r => r.type === 'task').map(r => [r.x.t.id, r]))
  return { rows, rowOf, W, H, HDR, X, X0, lo, hi, months, years, weeks, monthPx, today, weekly }
}

export default function GanttView({ doc, step = null, fit }) {
  const ids = useSvgIds()
  const L = layout(doc)
  const shown = (i) => step == null || i < step
  const colorOf = (x) => (x.t.tone ? toneColor(x.t.tone) : x.sec >= 0 ? paletteColor(x.sec) : toneColor('accent'))
  const clampX = (v) => Math.max(L.X0, Math.min(L.X0 + CHW, v))
  const seg = (a, b) => [clampX(L.X(a)), clampX(L.X(b))]
  const top = M, chartTop = M + L.HDR, chartBot = L.H - M
  // dependency paths
  const deps = []
  for (const r of L.rows) {
    if (r.type !== 'task' || r.x.s == null) continue
    for (const pid of r.x.t.dependsOn || []) {
      const pr = L.rowOf.get(pid)
      if (!pr || pr.x.s == null) continue
      const ms = !!pr.x.t.milestone, mt = !!r.x.t.milestone
      const x1 = L.X(pr.x.e) + (ms ? 9 : 0), y1 = pr.y + pr.h / 2
      const x2 = L.X(r.x.s) - (mt ? 9 : 0) - 1, y2 = r.y + r.h / 2
      const dir = y2 > y1 ? 1 : -1
      let d
      if (x2 - x1 >= 16) {
        const vx = x1 + 8
        d = `M${x1},${y1} H${vx} V${y2} H${x2}`
      } else {
        const by = dir > 0 ? r.y : r.y + r.h // row boundary next to the successor
        d = `M${x1},${y1} H${x1 + 8} V${by} H${x2 - 10} V${y2} H${x2}`
      }
      deps.push({ key: `${pid}-${r.x.t.id}`, d, on: shown(pr.x.i) && shown(r.x.i) })
    }
  }
  return (
    <DiagramSvg width={L.W} height={L.H} title={doc.title || 'Gantt'} desc={describeTypedDiagram(doc)} fit={fit}>
      <defs>
        <marker id={ids('arr')} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--dg-muted)" />
        </marker>
      </defs>
      {/* section bands */}
      {L.rows.filter(r => r.type === 'section').map(r => (
        <g key={`s${r.si}`}>
          <rect x={M} y={r.y} width={L.W - M * 2} height={r.h} fill="var(--dg-panel)" />
        </g>
      ))}
      {/* grid: weeks, months, years */}
      {L.weeks.map(d => <line key={`w${d}`} x1={L.X(d)} y1={chartTop} x2={L.X(d)} y2={chartBot} stroke="var(--dg-grid)" strokeWidth="1.2" />)}
      {L.months.map(m => m.a > L.lo && <line key={`m${m.a}`} x1={L.X(m.a)} y1={top} x2={L.X(m.a)} y2={chartBot} stroke={L.years.length && m.mm !== 0 ? 'var(--dg-grid)' : 'var(--dg-line)'} strokeWidth="1.2" />)}
      <line x1={L.X0} y1={chartTop} x2={L.X0 + CHW} y2={chartTop} stroke="var(--dg-line)" strokeWidth="1.2" />
      <line x1={L.X0} y1={top} x2={L.X0} y2={chartBot} stroke="var(--dg-line)" strokeWidth="1.2" />
      {/* section labels (over the grid, on a band-coloured backing) */}
      {L.rows.filter(r => r.type === 'section').map(r => (
        <g key={`sl${r.si}`}>
          <rect x={M} y={r.y + 1} width={Math.min(L.W - M * 2, textW(r.s.label, 13.5) + 28)} height={r.h - 2} fill="var(--dg-panel)" />
          <rect x={M} y={r.y + 6} width="4" height={r.h - 12} rx="2" fill={paletteColor(r.si)} />
          <text x={M + 14} y={r.y + r.h / 2 + 5} fontSize="13.5" fontWeight="700">{r.s.label}</text>
        </g>
      ))}
      {/* header labels */}
      {L.years.length
        ? L.years.map(yv => { const [a, b] = seg(yv.a, yv.b); return b - a > 40 && <text key={`y${yv.yy}`} x={(a + b) / 2} y={top + 20} fontSize="13" fontWeight="700" textAnchor="middle" className="dg-muted">{yv.yy}</text> })
        : L.months.map(m => {
          const [a, b] = seg(m.a, m.b), w = b - a
          const lab = w >= 62 ? `${MES[m.mm]} ${m.yy}` : w >= 30 ? MES[m.mm] : ''
          return lab && <text key={`ml${m.a}`} x={(a + b) / 2} y={top + 20} fontSize="13" fontWeight="700" textAnchor="middle" className="dg-muted">{lab}</text>
        })}
      {L.weekly && L.weeks.map(d => L.X(d) + 30 < L.X0 + CHW && (
        <text key={`wl${d}`} x={L.X(d) + 4} y={top + 42} fontSize="11" className="dg-muted">{dm(d)}</text>
      ))}
      {/* today */}
      {L.today != null && L.today >= L.lo && L.today <= L.hi && (
        <g>
          <line x1={L.X(L.today)} y1={chartTop} x2={L.X(L.today)} y2={chartBot} stroke="var(--dg-accent)" strokeWidth="1.6" strokeDasharray="5 4" />
          <rect x={L.X(L.today) - 22} y={chartBot + 2} width="44" height="18" rx="9" fill="var(--dg-accent)" />
          <text x={L.X(L.today)} y={chartBot + 15} fontSize="11" fontWeight="700" textAnchor="middle" style={{ fill: '#fff' }}>hoje</text>
        </g>
      )}
      {/* dependencies */}
      {deps.map(e => (
        <path key={e.key} d={e.d} fill="none" stroke="var(--dg-muted)" strokeWidth="1.3" markerEnd={`url(#${ids('arr')})`} className="dg-step" style={{ opacity: e.on ? 0.85 : 0 }} />
      ))}
      {/* tasks */}
      {L.rows.filter(r => r.type === 'task').map(r => {
        const { x } = r, c = colorOf(x), cy = r.y + r.h / 2
        const meta = x.t.milestone ? (x.s != null ? dm(x.s) : '') : x.t.progress != null ? `${Math.round(Math.max(0, Math.min(100, x.t.progress)))}%` : ''
        const ty = cy - ((r.lines.length - 1) * LLH) / 2 + 4.5
        let mark = null
        if (x.s != null) {
          if (x.t.milestone) {
            const mx = L.X(x.s)
            mark = <path d={`M${mx},${cy - 10} L${mx + 10},${cy} L${mx},${cy + 10} L${mx - 10},${cy} Z`} fill={c} stroke="var(--dg-bg)" strokeWidth="2" />
          } else {
            const a = L.X(x.s), w = Math.max(4, L.X(x.e) - a)
            const p = x.t.progress != null ? Math.max(0, Math.min(100, x.t.progress)) / 100 : 0
            mark = (
              <g>
                <rect x={a} y={cy - BAR_H / 2} width={w} height={BAR_H} rx="5" fill={c} fillOpacity="0.22" stroke={c} strokeWidth="1.3" />
                {p > 0 && <rect x={a} y={cy - BAR_H / 2} width={w * p} height={BAR_H} rx="5" fill={c} />}
              </g>
            )
          }
        }
        return (
          <g key={x.t.id || x.i} className="dg-step" style={{ opacity: shown(x.i) ? 1 : 0 }}>
            <line x1={M} y1={r.y + r.h} x2={L.W - M} y2={r.y + r.h} stroke="var(--dg-grid)" strokeWidth="1.2" />
            {r.lines.map((ln, j) => (
              <text key={j} x={M + 14} y={ty + j * LLH} fontSize={LS} fontWeight={x.t.milestone ? 700 : 500}>{ln}</text>
            ))}
            {meta && <text x={L.X0 - 12} y={cy + 4.5} fontSize="12" textAnchor="end" className="dg-muted">{meta}</text>}
            {mark}
          </g>
        )
      })}
    </DiagramSvg>
  )
}
