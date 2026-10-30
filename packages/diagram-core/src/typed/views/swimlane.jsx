// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── View: swimlane ───
// Grid layout: distinct `col` values → column index; each lane holds as many
// slot rows as its busiest column (steps sharing lane+col stack). Nodes sit in
// cells; flows are orthogonal and use free channels only:
//   • vertical channels on column boundaries (between nodes),
//   • horizontal channels on row boundaries (between slot rows / lanes).
// Forward flows turn in the first free channel (early or late turn; else via
// the row boundary next to the target). Back-edges and blocked same-column
// flows leave through the bottom/top, run along a row boundary and enter the
// target from the left. Edges sharing a channel are spread apart a few px.
import { DiagramSvg, toneColor, paletteColor, wrapText, textW, useSvgIds } from './DiagramSvg.jsx'
import { describeTypedDiagram } from '../index.js'

const M = 24, LH = 140, CW = 192, NW = 152, SH = 116, R = 18, DW = 146
const FS = 14, FLH = 17, SS = 12.5, SLH = 15, DS = 12

function nodeGeom(s) {
  const type = s.type || 'task'
  if (type === 'start' || type === 'end') {
    const lines = wrapText(s.label, CW - 24, SS).slice(0, 2)
    return { type, hw: R, hh: R, lines }
  }
  if (type === 'decision') {
    // grow the diamond (up to the column) so the longest line fits its waist
    const words = String(s.label || '').split(/\s+/)
    const lines = wrapText(s.label, Math.max(DW * 0.56, ...words.map(w => textW(w, DS))), DS)
    const lw = Math.max(...lines.map(l => textW(l, DS))) + 16
    const w = Math.min(CW - 14, Math.max(DW, lw / 0.62))
    const dy = ((lines.length - 1) / 2) * SLH + 9
    const hh = Math.min(SH / 2 - 6, Math.max(44, dy / Math.max(0.2, 1 - lw / w)))
    return { type, hw: w / 2, hh, lines }
  }
  const lines = wrapText(s.label, NW - 22, FS)
  return { type, hw: NW / 2, hh: Math.max(25, (lines.length * FLH + 20) / 2), lines }
}

// rounded orthogonal polyline
function roundPath(pts, r = 7) {
  const p = pts.filter((q, i) => i === 0 || q[0] !== pts[i - 1][0] || q[1] !== pts[i - 1][1])
  let d = `M${p[0][0]},${p[0][1]}`
  for (let i = 1; i < p.length - 1; i++) {
    const [ax, ay] = p[i - 1], [bx, by] = p[i], [cx, cy] = p[i + 1]
    const l1 = Math.hypot(bx - ax, by - ay), l2 = Math.hypot(cx - bx, cy - by)
    const k = Math.min(r, l1 / 2, l2 / 2)
    if (!k) { d += ` L${bx},${by}`; continue }
    const p1 = [bx - ((bx - ax) / l1) * k, by - ((by - ay) / l1) * k]
    const p2 = [bx + ((cx - bx) / l2) * k, by + ((cy - by) / l2) * k]
    d += ` L${p1[0]},${p1[1]} Q${bx},${by} ${p2[0]},${p2[1]}`
  }
  const last = p[p.length - 1]
  return `${d} L${last[0]},${last[1]}`
}

function layout(doc) {
  const lanes = doc.lanes || []
  const laneIdx = new Map(lanes.map((l, i) => [l.id, i]))
  const steps = (doc.steps || []).filter(s => laneIdx.has(s.lane))
  const cols = [...new Set(steps.map(s => Number(s.col) || 0))].sort((a, b) => a - b)
  const colIdx = new Map(cols.map((c, i) => [c, i]))
  // slots per lane
  const cellCount = new Map()
  const nodes = steps.map((s, i) => {
    const li = laneIdx.get(s.lane), ci = colIdx.get(Number(s.col) || 0)
    const key = `${li}:${ci}`
    const slot = cellCount.get(key) || 0
    cellCount.set(key, slot + 1)
    return { s, i, li, ci, slot, g: nodeGeom(s) }
  })
  const laneSlots = lanes.map((_, li) => Math.max(1, ...nodes.filter(n => n.li === li).map(n => n.slot + 1)))
  const laneTop = []
  const rowTop = [] // global slot rows
  const rowOfLaneSlot = new Map()
  let y = M
  lanes.forEach((_, li) => {
    laneTop[li] = y
    for (let k = 0; k < laneSlots[li]; k++) { rowOfLaneSlot.set(`${li}:${k}`, rowTop.length); rowTop.push(y); y += SH }
  })
  const H = y + M
  const X0 = M + LH
  const W = X0 + Math.max(1, cols.length) * CW + M
  const bx = (c) => X0 + c * CW // left boundary of column c
  const occ = new Set()
  for (const n of nodes) {
    n.row = rowOfLaneSlot.get(`${n.li}:${n.slot}`)
    n.x = bx(n.ci) + CW / 2
    n.y = rowTop[n.row] + SH / 2
    occ.add(`${n.row}:${n.ci}`)
  }
  // reveal order: by column, then lane, then input order
  const order = [...nodes].sort((a, b) => a.ci - b.ci || a.li - b.li || a.i - b.i)
  order.forEach((n, k) => { n.ord = k })
  return { lanes, laneTop, laneSlots, nodes, byId: new Map(nodes.map(n => [n.s.id, n])), rowTop, occ, X0, W, H, bx, ncols: cols.length }
}

function route(L, a, b) {
  const free = (row, c0, c1) => { for (let c = c0; c <= c1; c++) if (L.occ.has(`${row}:${c}`)) return false; return true }
  const right = (n) => [n.x + n.g.hw, n.y], left = (n) => [n.x - n.g.hw, n.y]
  const rowB = (r) => L.rowTop[r] + SH // bottom boundary of a row
  if (b.ci > a.ci) {
    const [x1, y1] = right(a), [x2, y2] = left(b)
    if (a.row === b.row && free(a.row, a.ci + 1, b.ci - 1)) return { kind: 'straight', pts: [[x1, y1], [x2, y2]] }
    if (a.row !== b.row && free(b.row, a.ci + 1, b.ci - 1)) return { kind: 'early', v: a.ci + 1, pts: [[x1, y1], [L.bx(a.ci + 1), y1], [L.bx(a.ci + 1), y2], [x2, y2]] }
    if (a.row !== b.row && free(a.row, a.ci + 1, b.ci - 1)) return { kind: 'late', v: b.ci, pts: [[x1, y1], [L.bx(b.ci), y1], [L.bx(b.ci), y2], [x2, y2]] }
    const hy = b.row > a.row ? L.rowTop[b.row] : rowB(b.row)
    const hRow = b.row > a.row ? b.row : b.row + 1
    return { kind: 'over', v: a.ci + 1, v2: b.ci, h: hRow, pts: [[x1, y1], [L.bx(a.ci + 1), y1], [L.bx(a.ci + 1), hy], [L.bx(b.ci), hy], [L.bx(b.ci), y2], [x2, y2]] }
  }
  if (b.ci === a.ci && a.row !== b.row) {
    const lo = Math.min(a.row, b.row), hi = Math.max(a.row, b.row)
    let clear = true
    for (let r = lo + 1; r < hi; r++) if (L.occ.has(`${r}:${a.ci}`)) clear = false
    if (clear) {
      const down = b.row > a.row
      return { kind: 'vertical', pts: [[a.x, down ? a.y + a.g.hh : a.y - a.g.hh], [b.x, down ? b.y - b.g.hh : b.y + b.g.hh]] }
    }
  }
  // back-edge: out of bottom (target at/below) or top (target above), along a row boundary, in from the left
  const up = b.row < a.row
  const sy = up ? a.y - a.g.hh : a.y + a.g.hh
  const hy = up ? L.rowTop[a.row] : rowB(a.row)
  const hRow = up ? a.row : a.row + 1
  const [x2, y2] = left(b)
  return { kind: 'back', v: b.ci, h: hRow, pts: [[a.x, sy], [a.x, hy], [L.bx(b.ci), hy], [L.bx(b.ci), y2], [x2, y2]] }
}

export default function SwimlaneView({ doc, step = null, fit }) {
  const ids = useSvgIds()
  const L = layout(doc)
  const shown = (n) => step == null || n.ord < step
  const laneColor = (l, i) => (l.tone ? toneColor(l.tone) : paletteColor(i))
  // routes + channel spreading
  const edges = []
  ;(doc.flows || []).forEach((f, k) => {
    const a = L.byId.get(f.from), b = L.byId.get(f.to)
    if (!a || !b || a === b) return
    edges.push({ f, k, a, b, r: route(L, a, b) })
  })
  const vUse = new Map(), hUse = new Map()
  const push = (m, key, e) => { if (!m.has(key)) m.set(key, []); m.get(key).push(e) }
  for (const e of edges) {
    if (e.r.v != null) push(vUse, e.r.v, e)
    if (e.r.v2 != null && e.r.v2 !== e.r.v) push(vUse, e.r.v2, e)
    if (e.r.h != null) push(hUse, e.r.h, e)
  }
  const spread = (list) => new Map(list.map((e, i) => [e, (i - (list.length - 1) / 2) * 8]))
  for (const [c, list] of vUse) {
    const off = spread(list), X = L.bx(c)
    for (const e of list) e.r.pts = e.r.pts.map(([x, y]) => [Math.abs(x - X) < 0.01 ? x + off.get(e) : x, y])
  }
  for (const [h, list] of hUse) {
    const off = spread(list), Y = L.rowTop[h] ?? L.H - M
    for (const e of list) {
      const pts = e.r.pts
      // only the interior horizontal run on the boundary (never the node ports)
      e.r.pts = pts.map(([x, y], i) => [x, i > 0 && i < pts.length - 1 && Math.abs(y - Y) < 0.01 ? y + off.get(e) : y])
    }
  }
  // flow labels: first long-enough horizontal run, else beside the first vertical run
  const labelPos = (e) => {
    const p = e.r.pts
    const tw = textW(e.f.label, 11.5) + 12
    for (let i = 0; i < p.length - 1; i++) {
      const [x1, y1] = p[i], [x2, y2] = p[i + 1]
      if (y1 === y2 && Math.abs(x2 - x1) >= tw + 8) return { x: (x1 + x2) / 2, y: y1 - 10, anchor: 'middle' }
      if (x1 === x2 && Math.abs(y2 - y1) >= 30) { const dir = Math.sign(y2 - y1); return { x: x1 - 6, y: y1 + dir * 28 + (dir > 0 ? 6 : 0), anchor: 'end' } }
    }
    return { x: p[0][0], y: p[0][1] - 10, anchor: 'middle' }
  }
  return (
    <DiagramSvg width={L.W} height={L.H} title={doc.title || 'Raias (swimlane)'} desc={describeTypedDiagram(doc)} fit={fit}>
      <defs>
        <marker id={ids('arr')} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--dg-muted)" />
        </marker>
      </defs>
      {/* lanes */}
      {L.lanes.map((l, i) => {
        const c = laneColor(l, i), y = L.laneTop[i], h = L.laneSlots[i] * SH
        const lines = wrapText(l.label, LH - 30, 14)
        return (
          <g key={l.id || i}>
            <rect x={L.X0} y={y} width={L.W - M - L.X0} height={h} fill={i % 2 ? 'var(--dg-bg)' : 'var(--dg-panel)'} />
            <rect x={M} y={y} width={LH} height={h} fill={c} fillOpacity="0.14" />
            <rect x={M} y={y} width="5" height={h} fill={c} />
            {lines.map((ln, j) => (
              <text key={j} x={M + 18} y={y + h / 2 + 5 + (j - (lines.length - 1) / 2) * 18} fontSize="14" fontWeight="700">{ln}</text>
            ))}
            <line x1={M} y1={y} x2={L.W - M} y2={y} stroke="var(--dg-line)" strokeWidth="1.2" />
          </g>
        )
      })}
      <rect x={M} y={M} width={L.W - M * 2} height={L.H - M * 2} fill="none" stroke="var(--dg-line)" strokeWidth="1.2" />
      <line x1={L.X0} y1={M} x2={L.X0} y2={L.H - M} stroke="var(--dg-line)" strokeWidth="1.2" />
      {/* flows */}
      {edges.map(e => {
        const on = shown(e.a) && shown(e.b)
        const lp = e.f.label ? labelPos(e) : null
        return (
          <g key={`f${e.k}`} className="dg-step" style={{ opacity: on ? 1 : 0 }}>
            <path d={roundPath(e.r.pts)} fill="none" stroke="var(--dg-muted)" strokeWidth="1.5" markerEnd={`url(#${ids('arr')})`} />
            {lp && (
              <g>
                <rect x={lp.anchor === 'end' ? lp.x - textW(e.f.label, 11.5) - 6 : lp.x - textW(e.f.label, 11.5) / 2 - 6} y={lp.y - 12} width={textW(e.f.label, 11.5) + 12} height="17" rx="8.5" fill="var(--dg-bg)" stroke="var(--dg-line)" strokeWidth="1" />
                <text x={lp.anchor === 'end' ? lp.x - textW(e.f.label, 11.5) / 2 : lp.x} y={lp.y + 1} fontSize="11.5" fontWeight="700" textAnchor="middle" className="dg-muted">{e.f.label}</text>
              </g>
            )}
          </g>
        )
      })}
      {/* steps */}
      {L.nodes.map(n => {
        const c = laneColor(L.lanes[n.li], n.li), { g } = n
        let shape, textY0, fs = SS, lh = SLH
        if (g.type === 'start' || g.type === 'end') {
          shape = g.type === 'start'
            ? <circle cx={n.x} cy={n.y} r={R} fill={toneColor('success')} stroke="var(--dg-bg)" strokeWidth="2" />
            : <circle cx={n.x} cy={n.y} r={R - 2} fill="var(--dg-bg)" stroke={toneColor('danger')} strokeWidth="4" />
          textY0 = n.y + R + 17
        } else if (g.type === 'decision') {
          shape = <path d={`M${n.x},${n.y - g.hh} L${n.x + g.hw},${n.y} L${n.x},${n.y + g.hh} L${n.x - g.hw},${n.y} Z`} fill="var(--dg-bg)" stroke={toneColor('warn')} strokeWidth="1.8" strokeLinejoin="round" />
          fs = DS
          textY0 = n.y + 4 - ((g.lines.length - 1) * lh) / 2
        } else {
          fs = FS; lh = FLH
          shape = <rect x={n.x - g.hw} y={n.y - g.hh} width={g.hw * 2} height={g.hh * 2} rx="10" fill="var(--dg-bg)" stroke={c} strokeWidth="1.8" />
          textY0 = n.y + 4.5 - ((g.lines.length - 1) * lh) / 2
        }
        return (
          <g key={n.s.id} className="dg-step" style={{ opacity: shown(n) ? 1 : 0 }}>
            {shape}
            {g.lines.map((ln, j) => (
              <text key={j} x={n.x} y={textY0 + j * lh} fontSize={fs} fontWeight={g.type === 'task' ? 600 : 700} textAnchor="middle">{ln}</text>
            ))}
          </g>
        )
      })}
    </DiagramSvg>
  )
}
