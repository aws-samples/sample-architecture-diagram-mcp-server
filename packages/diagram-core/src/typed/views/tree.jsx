// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── View: tree ───
// Deterministic tidy layout computed in (breadth, depth) space then mapped to
// x/y: TB → breadth = x, LR → breadth = y. Each subtree reserves an interval
// of breadth = max(own box, children + gaps); a parent is centred over its
// first/last child. Depth levels are aligned (max box size per level). In TB,
// a parent whose children are 4+ leaves (2+ when the tree is still wider
// than ~1150) stacks them vertically, org-chart style. Elbow connectors.
import { DiagramSvg, toneColor, paletteColor, wrapText, textW } from './DiagramSvg.jsx'
import { describeTypedDiagram } from '../index.js'

const M = 28, SIB = 22, GAP_TB = 54, GAP_LR = 64, STACK_IN = 26, STACK_GAP = 12
const LS = 14, LS_ROOT = 16, SS = 12, LLH = 18, SLH = 15

function boxOf(n, isRoot, lr) {
  const size = isRoot ? LS_ROOT : LS
  const maxW = lr ? 230 : 196, minW = lr ? 150 : 128
  const w = Math.max(minW, Math.min(maxW, Math.max(textW(n.label, size), n.sub ? textW(n.sub, SS) : 0) + 30))
  const label = wrapText(n.label, w - 24, size)
  const sub = n.sub ? wrapText(n.sub, w - 24, SS) : []
  const h = 14 + label.length * LLH + (sub.length ? 2 + sub.length * SLH : 0) + 12
  return { w, h, label, sub, size }
}

function layoutTree(doc, minStack = 4) {
  const nodes = doc.nodes || []
  const lr = doc.direction === 'LR'
  const ids = new Set(nodes.map(n => n.id))
  const kids = new Map(nodes.map(n => [n.id, []]))
  for (const n of nodes) if (n.parent && n.parent !== n.id && ids.has(n.parent)) kids.get(n.parent).push(n)
  const roots = nodes.filter(n => !n.parent || n.parent === n.id || !ids.has(n.parent))
  const info = new Map()
  const seen = new Set()
  // depth + branch + boxes (cycle-safe)
  const visit = (n, d, branch) => {
    if (seen.has(n.id)) return
    seen.add(n.id)
    info.set(n.id, { n, d, branch, box: boxOf(n, d === 0, lr), kids: [] })
    kids.get(n.id).forEach((c, i) => { if (!seen.has(c.id)) { info.get(n.id).kids.push(c.id); visit(c, d + 1, d === 0 ? i : branch) } })
  }
  roots.forEach((r, i) => visit(r, 0, i))
  for (const n of nodes) if (!seen.has(n.id)) visit(n, 0, 0) // nodes trapped in a cycle
  const topIds = [...info.values()].filter(v => v.d === 0).map(v => v.n.id)
  const compact = !lr && doc.compactLeaves !== false
  const B = (v) => (lr ? v.box.h : v.box.w) // breadth size
  const D = (v) => (lr ? v.box.w : v.box.h) // depth size
  const stacked = (v) => compact && v.kids.length >= minStack && v.kids.every(k => info.get(k).kids.length === 0)
  // stacked leaves share one width (tidy column)
  for (const v of info.values()) if (stacked(v)) {
    const w = Math.max(...v.kids.map(k => info.get(k).box.w))
    v.kids.forEach(k => { info.get(k).box.w = w })
  }
  // subtree breadth
  const sw = new Map()
  const measure = (id) => {
    const v = info.get(id)
    if (!v.kids.length) { sw.set(id, B(v)); return B(v) }
    v.kids.forEach(measure)
    if (stacked(v)) { const s = Math.max(B(v), STACK_IN + Math.max(...v.kids.map(k => B(info.get(k))))); sw.set(id, s); return s }
    const s = Math.max(B(v), v.kids.reduce((a, k) => a + sw.get(k), 0) + SIB * (v.kids.length - 1))
    sw.set(id, s); return s
  }
  topIds.forEach(measure)
  // depth sizes per level (stacked leaves hang from their parent, excluded)
  const maxD = []
  for (const v of info.values()) {
    const p = v.n.parent && info.get(v.n.parent)
    if (p && stacked(p)) continue
    maxD[v.d] = Math.max(maxD[v.d] || 0, D(v))
  }
  const gap = lr ? GAP_LR : GAP_TB
  const lvl = [M]
  for (let i = 1; i < maxD.length; i++) lvl[i] = lvl[i - 1] + (maxD[i - 1] || 0) + gap
  // breadth placement: c = centre (breadth axis), p = depth start
  const pos = new Map()
  const place = (id, left) => {
    const v = info.get(id), s = sw.get(id)
    if (!v.kids.length) { pos.set(id, { c: left + s / 2, p: lvl[v.d] }); return }
    if (stacked(v)) {
      pos.set(id, { c: left + B(v) / 2, p: lvl[v.d] })
      let y = lvl[v.d] + v.box.h + 22
      for (const k of v.kids) {
        const kv = info.get(k)
        pos.set(k, { c: left + STACK_IN + kv.box.w / 2, p: y, stack: true })
        y += kv.box.h + STACK_GAP
      }
      return
    }
    const total = v.kids.reduce((a, k) => a + sw.get(k), 0) + SIB * (v.kids.length - 1)
    let cur = left + (s - total) / 2
    for (const k of v.kids) { place(k, cur); cur += sw.get(k) + SIB }
    const mid = (pos.get(v.kids[0]).c + pos.get(v.kids[v.kids.length - 1]).c) / 2
    pos.set(id, { c: Math.max(left + B(v) / 2, Math.min(left + s - B(v) / 2, mid)), p: lvl[v.d] })
  }
  let cur = M
  for (const id of topIds) { place(id, cur); cur += sw.get(id) + SIB * 2 }
  // map to x/y boxes
  const out = []
  let W = 0, H = 0
  for (const [id, v] of info) {
    const q = pos.get(id)
    const x = lr ? q.p : q.c - v.box.w / 2
    const y = lr ? q.c - v.box.h / 2 : q.p
    out.push({ id, v, x, y, stack: !!q.stack })
    W = Math.max(W, x + v.box.w); H = Math.max(H, y + v.box.h)
  }
  return { lr, items: out, byId: new Map(out.map(o => [o.id, o])), W: W + M, H: H + M, lvl, maxD, gap, stacked, info }
}

const topBar = (x, y, w, r = 9, h = 5) => `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`

export default function TreeView({ doc, step = null, fit }) {
  // wide TB trees: also stack pairs/triples of leaves (org-chart style)
  let L = layoutTree(doc)
  if (!L.lr && L.W > 1150) L = layoutTree(doc, 2)
  const shown = (d) => step == null || d < step
  const colorOf = (v) => (v.n.tone ? toneColor(v.n.tone) : v.d === 0 ? toneColor('accent') : paletteColor(v.branch))
  const edges = []
  for (const o of L.items) {
    const v = o.v
    if (!v.kids.length) continue
    if (L.stacked(v)) {
      const tx = o.x + 12
      for (const k of v.kids) {
        const c = L.byId.get(k)
        edges.push({ key: `${o.id}-${k}`, d: c.v.d, path: `M${tx},${o.y + v.box.h} V${c.y + c.v.box.h / 2} H${c.x}` })
      }
      continue
    }
    for (const k of v.kids) {
      const c = L.byId.get(k)
      let path
      if (L.lr) {
        const x1 = o.x + v.box.w, y1 = o.y + v.box.h / 2, x2 = c.x, y2 = c.y + c.v.box.h / 2
        const mx = L.lvl[c.v.d] - L.gap / 2
        path = Math.abs(y1 - y2) < 0.5 ? `M${x1},${y1} H${x2}` : `M${x1},${y1} H${mx - 8} Q${mx},${y1} ${mx},${y1 + Math.sign(y2 - y1) * 8} V${y2 - Math.sign(y2 - y1) * 8} Q${mx},${y2} ${mx + 8},${y2} H${x2}`
      } else {
        const x1 = o.x + v.box.w / 2, y1 = o.y + v.box.h, x2 = c.x + c.v.box.w / 2, y2 = c.y
        const my = L.lvl[c.v.d] - L.gap / 2
        path = Math.abs(x1 - x2) < 0.5 ? `M${x1},${y1} V${y2}` : `M${x1},${y1} V${my - 8} Q${x1},${my} ${x1 + Math.sign(x2 - x1) * 8},${my} H${x2 - Math.sign(x2 - x1) * 8} Q${x2},${my} ${x2},${my + 8} V${y2}`
      }
      edges.push({ key: `${o.id}-${k}`, d: c.v.d, path })
    }
  }
  return (
    <DiagramSvg width={L.W} height={L.H} title={doc.title || 'Árvore / organograma'} desc={describeTypedDiagram(doc)} fit={fit}>
      {edges.map(e => (
        <path key={e.key} d={e.path} fill="none" stroke="var(--dg-line)" strokeWidth="1.6" className="dg-step" style={{ opacity: shown(e.d) ? 1 : 0 }} />
      ))}
      {L.items.map(({ id, v, x, y }) => {
        const c = colorOf(v), root = v.d === 0, b = v.box
        const cx = x + b.w / 2
        const ty = y + 14 + b.size - 2
        return (
          <g key={id} className="dg-step" style={{ opacity: shown(v.d) ? 1 : 0 }}>
            {root
              ? <rect x={x} y={y} width={b.w} height={b.h} rx="10" fill={c} />
              : <>
                <rect x={x} y={y} width={b.w} height={b.h} rx="9" fill="var(--dg-panel)" stroke="var(--dg-line)" strokeWidth="1.2" />
                <path d={topBar(x, y, b.w)} fill={c} />
              </>}
            {b.label.map((ln, j) => (
              <text key={`l${j}`} x={cx} y={ty + j * LLH} fontSize={b.size} fontWeight="700" textAnchor="middle" style={root ? { fill: '#fff' } : undefined}>{ln}</text>
            ))}
            {b.sub.map((ln, j) => (
              <text key={`s${j}`} x={cx} y={ty + b.label.length * LLH + 2 + j * SLH} fontSize={SS} textAnchor="middle"
                className={root ? undefined : 'dg-muted'} style={root ? { fill: '#fff', opacity: 0.92 } : undefined}>{ln}</text>
            ))}
          </g>
        )
      })}
    </DiagramSvg>
  )
}
