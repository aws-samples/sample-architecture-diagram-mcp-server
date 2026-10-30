// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── View: er ───
// Tables laid out with dagre (LR/TB); relationships anchored on the table side
// facing the next rank, spread along that side, routed through dagre's
// interior points, with crow's-foot notation drawn at each end.
import dagre from 'dagre'
import { line as d3line, curveBasis } from 'd3-shape'
import { DiagramSvg, toneColor, textW } from './DiagramSvg.jsx'
import { describeTypedDiagram, getDiagramType } from '../index.js'

const HEAD = 38, ROW = 26, ROWN = 40, PADX = 12, BADGE = 26, STUB = 30
const monoW = (s, size) => String(s || '').length * size * 0.62
const boldW = (s, size) => String(s || '').length * size * 0.62

function measure(e) {
  const cols = e.columns || []
  const both = cols.some(c => c.pk && c.fk)
  const anyBadge = cols.some(c => c.pk || c.fk)
  const badgeW = anyBadge ? (both ? BADGE * 2 + 4 : BADGE) + 8 : 0
  const nameW = Math.max(0, ...cols.map(c => Math.max(textW(c.name, 13) * (c.pk ? 1.08 : 1), c.note ? textW(c.note, 11) : 0)))
  const typeW = Math.max(0, ...cols.map(c => monoW((c.type || '') + (c.nullable ? '?' : ''), 12)))
  const w = Math.ceil(Math.max(180, PADX * 2 + badgeW + nameW + 20 + typeW, boldW(e.label, 15) + PADX * 2 + 8))
  const rows = cols.map(c => (c.note ? ROWN : ROW))
  const h = HEAD + (rows.length ? rows.reduce((a, b) => a + b, 0) : 22) + 6
  return { w, h, rows, badgeW }
}

// Crow's-foot / bar / circle glyphs for one relationship end.
function EndGlyph({ p, d, cardv, color }) {
  const n = { x: -d.y, y: d.x }
  const at = (a, s = 0) => ({ x: p.x + d.x * a + n.x * s, y: p.y + d.y * a + n.y * s })
  const bar = (a) => { const u = at(a, 7), v = at(a, -7); return <line x1={u.x} y1={u.y} x2={v.x} y2={v.y} /> }
  const circ = (a) => { const c = at(a); return <circle cx={c.x} cy={c.y} r="5" fill="var(--dg-bg)" /> }
  const crow = () => { const ap = at(15), u = at(0, 8), v = at(0, -8); return <path d={`M${u.x},${u.y} L${ap.x},${ap.y} L${v.x},${v.y}`} fill="none" /> }
  return (
    <g stroke={color} strokeWidth="1.6">
      {cardv === '1' && <>{bar(10)}{bar(16)}</>}
      {cardv === '0..1' && <>{bar(10)}{circ(21)}</>}
      {cardv === '1..*' && <>{crow()}{bar(21)}</>}
      {cardv === '0..*' && <>{crow()}{circ(22)}</>}
    </g>
  )
}

export default function ErView({ doc, step = null, fit }) {
  const ents = doc.entities || []
  const rels = (doc.relations || []).filter(r => ents.some(e => e.id === r.from) && ents.some(e => e.id === r.to))
  const LR = (doc.direction || 'LR') !== 'TB'
  const idx = Object.fromEntries(ents.map((e, i) => [e.id, i]))
  const shown = (i) => step == null || i < step

  // Self-relations get extra room on the right side of their table.
  const loopExtra = {}
  rels.forEach(r => { if (r.from === r.to) loopExtra[r.from] = Math.max(loopExtra[r.from] || 0, 54 + (r.label ? textW(r.label, 12) + 8 : 0)) })

  const m = Object.fromEntries(ents.map(e => [e.id, measure(e)]))
  const g = new dagre.graphlib.Graph({ multigraph: true })
  g.setGraph({ rankdir: LR ? 'LR' : 'TB', nodesep: LR ? 46 : 60, ranksep: LR ? 120 : 90, edgesep: 24, marginx: 24, marginy: 24 })
  g.setDefaultEdgeLabel(() => ({}))
  ents.forEach(e => g.setNode(e.id, { width: m[e.id].w + (loopExtra[e.id] || 0), height: m[e.id].h }))
  rels.forEach((r, i) => {
    if (r.from === r.to) return
    g.setEdge(r.from, r.to, r.label ? { width: textW(r.label, 12) + 14, height: 20, labelpos: 'c' } : {}, `e${i}`)
  })
  dagre.layout(g)

  const box = {}
  ents.forEach(e => {
    const nd = g.node(e.id), mm = m[e.id]
    const x = nd.x - nd.width / 2, y = nd.y - mm.h / 2
    box[e.id] = { x, y, w: mm.w, h: mm.h, cx: x + mm.w / 2, cy: nd.y }
  })

  // Anchors: pick facing sides, then spread multiple edges along each side.
  const edges = []
  const slots = {}
  rels.forEach((r, i) => {
    if (r.from === r.to) return
    const ed = g.edge(r.from, r.to, `e${i}`)
    const pts = ed.points || []
    const a = box[r.from], b = box[r.to]
    const fwd = LR ? b.cx >= a.cx : b.cy >= a.cy
    const sideA = LR ? (fwd ? 'R' : 'L') : (fwd ? 'B' : 'T')
    const sideB = LR ? (fwd ? 'L' : 'R') : (fwd ? 'T' : 'B')
    const interior = pts.slice(1, -1)
    const nearA = interior[0] || { x: b.cx, y: b.cy }
    const nearB = interior[interior.length - 1] || { x: a.cx, y: a.cy }
    const E = { r, i, ed, interior, ends: [{ id: r.from, side: sideA, other: LR ? nearA.y : nearA.x }, { id: r.to, side: sideB, other: LR ? nearB.y : nearB.x }] }
    E.ends.forEach(en => { (slots[`${en.id}:${en.side}`] ||= []).push(en) })
    edges.push(E)
  })
  Object.entries(slots).forEach(([key, list]) => {
    const bx = box[key.split(':')[0]]
    list.sort((p, q) => p.other - q.other)
    const lo = LR ? bx.y + HEAD + 6 : bx.x + 24, hi = LR ? bx.y + bx.h - 10 : bx.x + bx.w - 24
    list.forEach((en, k) => {
      const t = lo + ((hi - lo) * (k + 1)) / (list.length + 1)
      const side = en.side
      en.p = side === 'R' ? { x: bx.x + bx.w, y: t } : side === 'L' ? { x: bx.x, y: t } : side === 'B' ? { x: t, y: bx.y + bx.h } : { x: t, y: bx.y }
      en.d = side === 'R' ? { x: 1, y: 0 } : side === 'L' ? { x: -1, y: 0 } : side === 'B' ? { x: 0, y: 1 } : { x: 0, y: -1 }
    })
  })

  const curve = d3line().x(p => p.x).y(p => p.y).curve(curveBasis)
  const color = 'var(--dg-muted)'
  const gw = Math.ceil(g.graph().width || 400), gh = Math.ceil(g.graph().height || 200)

  return (
    <DiagramSvg width={gw} height={gh} title={doc.title || getDiagramType('er').label} desc={describeTypedDiagram(doc)} fit={fit}>
      {/* relationships (under tables) */}
      {edges.map(E => {
        const [A, B] = E.ends
        const sA = { x: A.p.x + A.d.x * STUB, y: A.p.y + A.d.y * STUB }
        const sB = { x: B.p.x + B.d.x * STUB, y: B.p.y + B.d.y * STUB }
        const mid = curve([sA, ...E.interior, sB])
        const vis = shown(idx[E.r.from]) && shown(idx[E.r.to])
        return (
          <g key={`r${E.i}`} className="dg-step" style={{ opacity: vis ? 1 : 0 }}>
            <path d={`M${A.p.x},${A.p.y} L${mid.slice(1)} L${B.p.x},${B.p.y}`} fill="none" stroke={color} strokeWidth="1.6" />
            <EndGlyph p={A.p} d={A.d} cardv={E.r.fromCard} color={color} />
            <EndGlyph p={B.p} d={B.d} cardv={E.r.toCard} color={color} />
            {E.r.label && E.ed.x != null && (
              <g>
                <rect x={E.ed.x - (textW(E.r.label, 12) + 12) / 2} y={E.ed.y - 10} width={textW(E.r.label, 12) + 12} height="20" rx="10" fill="var(--dg-bg)" stroke="var(--dg-line)" />
                <text x={E.ed.x} y={E.ed.y + 4} fontSize="12" fontStyle="italic" textAnchor="middle" className="dg-muted">{E.r.label}</text>
              </g>
            )}
          </g>
        )
      })}
      {/* self-relations: loop on the right side */}
      {rels.map((r, i) => {
        if (r.from !== r.to) return null
        const b = box[r.from]
        const y1 = b.y + HEAD + (b.h - HEAD) * 0.3, y2 = b.y + HEAD + (b.h - HEAD) * 0.75, x0 = b.x + b.w, x1 = x0 + 44
        return (
          <g key={`s${i}`} className="dg-step" style={{ opacity: shown(idx[r.from]) ? 1 : 0 }}>
            <path d={`M${x0},${y1} L${x0 + 26},${y1} Q${x1},${y1} ${x1},${(y1 + y2) / 2} Q${x1},${y2} ${x0 + 26},${y2} L${x0},${y2}`} fill="none" stroke={color} strokeWidth="1.6" />
            <EndGlyph p={{ x: x0, y: y1 }} d={{ x: 1, y: 0 }} cardv={r.fromCard} color={color} />
            <EndGlyph p={{ x: x0, y: y2 }} d={{ x: 1, y: 0 }} cardv={r.toCard} color={color} />
            {r.label && <text x={x1 + 8} y={(y1 + y2) / 2 + 4} fontSize="12" fontStyle="italic" className="dg-muted">{r.label}</text>}
          </g>
        )
      })}
      {/* tables */}
      {ents.map((e, i) => {
        const b = box[e.id], mm = m[e.id], c = toneColor(e.tone, toneColor('info'))
        let yy = b.y + HEAD
        return (
          <g key={e.id} className="dg-step" style={{ opacity: shown(i) ? 1 : 0 }}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="8" fill="var(--dg-bg)" stroke={c} strokeWidth="1.6" />
            <path d={`M${b.x},${b.y + HEAD} V${b.y + 8} Q${b.x},${b.y} ${b.x + 8},${b.y} H${b.x + b.w - 8} Q${b.x + b.w},${b.y} ${b.x + b.w},${b.y + 8} V${b.y + HEAD} Z`} fill={c} />
            <text x={b.x + PADX} y={b.y + 24} fontSize="15" fontWeight="700" style={{ fill: '#fff' }}>{e.label}</text>
            {(e.columns || []).map((col, k) => {
              const rh = mm.rows[k], y0 = yy
              yy += rh
              const base = y0 + 17
              const bx = b.x + PADX
              const badges = [col.pk && ['PK', toneColor('warn')], col.fk && ['FK', toneColor('info')]].filter(Boolean)
              return (
                <g key={k}>
                  {k % 2 === 1 && <rect x={b.x + 1.5} y={y0} width={b.w - 3} height={rh} fill="var(--dg-panel)" />}
                  {k > 0 && <line x1={b.x + 1} y1={y0} x2={b.x + b.w - 1} y2={y0} stroke="var(--dg-grid)" />}
                  {badges.map(([t, bc], j) => (
                    <g key={t}>
                      <rect x={bx + j * (BADGE + 4)} y={base - 12} width={BADGE} height="16" rx="3" fill={bc} />
                      <text x={bx + j * (BADGE + 4) + BADGE / 2} y={base} fontSize="11" fontWeight="700" textAnchor="middle" style={{ fill: '#fff' }}>{t}</text>
                    </g>
                  ))}
                  <text x={bx + mm.badgeW} y={base} fontSize="13" fontWeight={col.pk ? 700 : 400}>{col.name}</text>
                  {col.note && <text x={bx + mm.badgeW} y={base + 14} fontSize="11" fontStyle="italic" className="dg-muted">{col.note}</text>}
                  {col.type && <text x={b.x + b.w - PADX} y={base} fontSize="12" textAnchor="end" className="dg-muted" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{col.type}{col.nullable ? '?' : ''}</text>}
                </g>
              )
            })}
            {!(e.columns || []).length && <text x={b.x + PADX} y={b.y + HEAD + 16} fontSize="12" fontStyle="italic" className="dg-muted">sem colunas</text>}
          </g>
        )
      })}
    </DiagramSvg>
  )
}
