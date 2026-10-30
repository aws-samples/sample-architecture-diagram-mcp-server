// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── View: class ───
// UML class boxes (name/stereotype, attributes, methods) laid out with dagre TB
// (parents/wholes on top). Relations are anchored on the facing top/bottom
// sides, spread along them, routed through dagre's interior points and capped
// with UML arrowheads (hollow triangle, open arrow, hollow/filled diamond).
import dagre from 'dagre'
import { line as d3line, curveBasis } from 'd3-shape'
import { DiagramSvg, toneColor, textW } from './DiagramSvg.jsx'
import { describeTypedDiagram, getDiagramType } from '../index.js'

const MEM = 19, PADX = 12, STUB = 26
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const monoW = (s, size) => String(s || '').length * size * 0.62
const boldW = (s, size) => String(s || '').length * size * 0.62
const STEREO_TONE = { interface: 'info', abstract: 'purple', enum: 'success', service: 'teal' }
const DASHED = { realization: true, dependency: true }

function measure(c) {
  const at = c.attributes || [], me = c.methods || []
  const nameH = c.stereotype ? 50 : 36
  const atH = at.length ? at.length * MEM + 10 : 12
  const meH = me.length ? me.length * MEM + 10 : 12
  const w = Math.ceil(Math.max(170, boldW(c.name, 15) + PADX * 2 + 6, c.stereotype ? textW(`«${c.stereotype}»`, 12) + PADX * 2 : 0, ...[...at, ...me].map(s => monoW(s, 12) + PADX * 2)))
  return { w, h: nameH + atH + meH, nameH, atH, meH }
}

// Arrowhead / diamond at point p; d points away from the box along the line.
function Head({ p, d, kind }) {
  const n = { x: -d.y, y: d.x }
  const at = (a, s = 0) => `${p.x + d.x * a + n.x * s},${p.y + d.y * a + n.y * s}`
  const st = { stroke: 'var(--dg-muted)', strokeWidth: 1.6, strokeLinejoin: 'round' }
  if (kind === 'triangle') return <path d={`M${at(0)} L${at(15, 9)} L${at(15, -9)} Z`} fill="var(--dg-bg)" {...st} />
  if (kind === 'open') return <path d={`M${at(13, 7)} L${at(0)} L${at(13, -7)}`} fill="none" {...st} />
  if (kind === 'diamond' || kind === 'filled') return <path d={`M${at(0)} L${at(10, 7)} L${at(20)} L${at(10, -7)} Z`} fill={kind === 'filled' ? 'var(--dg-muted)' : 'var(--dg-bg)'} {...st} />
  return null
}
const headFor = (type) => ({
  inheritance: [null, 'triangle'], realization: [null, 'triangle'], association: [null, 'open'],
  dependency: [null, 'open'], aggregation: ['diamond', null], composition: ['filled', null],
}[type] || [null, null])

function Mult({ p, d, text }) {
  if (!text) return null
  const n = { x: -d.y, y: d.x }
  const side = Math.abs(n.x) > 0.5 ? Math.sign(n.x) : 1
  const x = p.x + d.x * 16 + side * 13, y = p.y + d.y * 16 + (Math.abs(d.y) > 0.5 ? 4 : -8)
  return <text x={x} y={y} fontSize="12" fontWeight="600" textAnchor={side > 0 ? 'start' : 'end'} className="dg-muted">{text}</text>
}

export default function ClassView({ doc, step = null, fit }) {
  const cls = doc.classes || []
  const ids = new Set(cls.map(c => c.id))
  const rels = (doc.relations || []).filter(r => ids.has(r.from) && ids.has(r.to))
  const idx = Object.fromEntries(cls.map((c, i) => [c.id, i]))
  const shown = (i) => step == null || i < step

  const loopExtra = {}
  rels.forEach(r => { if (r.from === r.to) loopExtra[r.from] = Math.max(loopExtra[r.from] || 0, 70 + Math.max(r.label ? textW(r.label, 12) : 0, textW(r.toMult, 12), textW(r.fromMult, 12))) })

  const m = Object.fromEntries(cls.map(c => [c.id, measure(c)]))
  const g = new dagre.graphlib.Graph({ multigraph: true })
  g.setGraph({ rankdir: 'TB', nodesep: 56, ranksep: 80, edgesep: 24, marginx: 24, marginy: 24 })
  g.setDefaultEdgeLabel(() => ({}))
  cls.forEach(c => g.setNode(c.id, { width: m[c.id].w + (loopExtra[c.id] || 0), height: m[c.id].h }))
  const upward = (t) => t === 'inheritance' || t === 'realization'
  rels.forEach((r, i) => {
    if (r.from === r.to) return
    const [v, w] = upward(r.type) ? [r.to, r.from] : [r.from, r.to]
    g.setEdge(v, w, r.label ? { width: textW(r.label, 12) + 14, height: 20, labelpos: 'c' } : {}, `e${i}`)
  })
  dagre.layout(g)

  const box = {}
  cls.forEach(c => {
    const nd = g.node(c.id), mm = m[c.id]
    const x = nd.x - nd.width / 2, y = nd.y - mm.h / 2
    box[c.id] = { x, y, w: mm.w, h: mm.h, cx: x + mm.w / 2, cy: nd.y }
  })

  const edges = [], slots = {}
  rels.forEach((r, i) => {
    if (r.from === r.to) return
    const up = upward(r.type)
    const ed = g.edge(up ? r.to : r.from, up ? r.from : r.to, `e${i}`)
    let interior = (ed.points || []).slice(1, -1)
    if (up) interior = interior.slice().reverse()
    const a = box[r.from], b = box[r.to]
    const down = b.cy >= a.cy
    const nearA = interior[0] || { x: b.cx }, nearB = interior[interior.length - 1] || { x: a.cx }
    const E = { r, i, ed, interior, ends: [{ id: r.from, side: down ? 'B' : 'T', other: nearA.x }, { id: r.to, side: down ? 'T' : 'B', other: nearB.x }] }
    E.ends.forEach(en => { (slots[`${en.id}:${en.side}`] ||= []).push(en) })
    edges.push(E)
  })
  Object.entries(slots).forEach(([key, list]) => {
    const bx = box[key.split(':')[0]]
    list.sort((p, q) => p.other - q.other)
    const lo = bx.x + 22, hi = bx.x + bx.w - 22
    list.forEach((en, k) => {
      const t = list.length === 1 ? bx.cx : lo + ((hi - lo) * (k + 0.5)) / list.length
      en.p = en.side === 'B' ? { x: t, y: bx.y + bx.h } : { x: t, y: bx.y }
      en.d = en.side === 'B' ? { x: 0, y: 1 } : { x: 0, y: -1 }
    })
  })

  const curve = d3line().x(p => p.x).y(p => p.y).curve(curveBasis)
  const gw = Math.ceil(g.graph().width || 400), gh = Math.ceil(g.graph().height || 200)
  const lineSt = (type) => ({ fill: 'none', stroke: 'var(--dg-muted)', strokeWidth: 1.6, strokeDasharray: DASHED[type] ? '6 4' : undefined })

  return (
    <DiagramSvg width={gw} height={gh} title={doc.title || getDiagramType('class').label} desc={describeTypedDiagram(doc)} fit={fit}>
      {edges.map(E => {
        const [A, B] = E.ends
        const sA = { x: A.p.x + A.d.x * STUB, y: A.p.y + A.d.y * STUB }
        const sB = { x: B.p.x + B.d.x * STUB, y: B.p.y + B.d.y * STUB }
        const mid = curve([sA, ...E.interior, sB])
        const [hA, hB] = headFor(E.r.type)
        const vis = shown(idx[E.r.from]) && shown(idx[E.r.to])
        const lw = E.r.label ? textW(E.r.label, 12) + 12 : 0
        return (
          <g key={`r${E.i}`} className="dg-step" style={{ opacity: vis ? 1 : 0 }}>
            <path d={`M${A.p.x},${A.p.y} L${mid.slice(1)} L${B.p.x},${B.p.y}`} {...lineSt(E.r.type)} />
            <Head p={A.p} d={A.d} kind={hA} />
            <Head p={B.p} d={B.d} kind={hB} />
            <Mult p={A.p} d={A.d} text={E.r.fromMult} />
            <Mult p={B.p} d={B.d} text={E.r.toMult} />
            {E.r.label && E.ed.x != null && (
              <g>
                <rect x={E.ed.x - lw / 2} y={E.ed.y - 10} width={lw} height="20" rx="10" fill="var(--dg-bg)" stroke="var(--dg-line)" />
                <text x={E.ed.x} y={E.ed.y + 4} fontSize="12" fontStyle="italic" textAnchor="middle" className="dg-muted">{E.r.label}</text>
              </g>
            )}
          </g>
        )
      })}
      {rels.map((r, i) => {
        if (r.from !== r.to) return null
        const b = box[r.from], mm = m[r.from]
        const y1 = b.y + mm.nameH * 0.5, y2 = b.y + b.h - 18, x0 = b.x + b.w, x1 = x0 + 52
        const [hA, hB] = headFor(r.type)
        const dR = { x: 1, y: 0 }
        return (
          <g key={`s${i}`} className="dg-step" style={{ opacity: shown(idx[r.from]) ? 1 : 0 }}>
            <path d={`M${x0},${y1} L${x0 + 30},${y1} Q${x1},${y1} ${x1},${(y1 + y2) / 2} Q${x1},${y2} ${x0 + 30},${y2} L${x0},${y2}`} {...lineSt(r.type)} />
            <Head p={{ x: x0, y: y1 }} d={dR} kind={hA} />
            <Head p={{ x: x0, y: y2 }} d={dR} kind={hB} />
            {r.fromMult && <text x={x0 + 24} y={y1 - 6} fontSize="12" fontWeight="600" className="dg-muted">{r.fromMult}</text>}
            {r.toMult && <text x={x0 + 24} y={y2 + 16} fontSize="12" fontWeight="600" className="dg-muted">{r.toMult}</text>}
            {r.label && <text x={x1 + 8} y={(y1 + y2) / 2 + 4} fontSize="12" fontStyle="italic" className="dg-muted">{r.label}</text>}
          </g>
        )
      })}
      {cls.map((c, i) => {
        const b = box[c.id], mm = m[c.id]
        const col = toneColor(STEREO_TONE[(c.stereotype || '').toLowerCase()] || 'accent')
        const italic = /^(interface|abstract)$/i.test(c.stereotype || '')
        const yA = b.y + mm.nameH, yM = yA + mm.atH
        return (
          <g key={c.id} className="dg-step" style={{ opacity: shown(i) ? 1 : 0 }}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="6" fill="var(--dg-bg)" />
            <path d={`M${b.x},${yA} V${b.y + 6} Q${b.x},${b.y} ${b.x + 6},${b.y} H${b.x + b.w - 6} Q${b.x + b.w},${b.y} ${b.x + b.w},${b.y + 6} V${yA} Z`} fill={col} fillOpacity="0.16" />
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="6" fill="none" stroke={col} strokeWidth="1.6" />
            {c.stereotype && <text x={b.cx} y={b.y + 19} fontSize="12" textAnchor="middle" className="dg-muted">«{c.stereotype}»</text>}
            <text x={b.cx} y={b.y + (c.stereotype ? 38 : 24)} fontSize="15" fontWeight="700" fontStyle={italic ? 'italic' : undefined} textAnchor="middle">{c.name}</text>
            <line x1={b.x} y1={yA} x2={b.x + b.w} y2={yA} stroke={col} strokeWidth="1.2" />
            <line x1={b.x} y1={yM} x2={b.x + b.w} y2={yM} stroke={col} strokeWidth="1.2" />
            {(c.attributes || []).map((s, k) => (
              <text key={`a${k}`} x={b.x + PADX} y={yA + 19 + k * MEM} fontSize="12" style={{ fontFamily: MONO }}>{s}</text>
            ))}
            {(c.methods || []).map((s, k) => (
              <text key={`m${k}`} x={b.x + PADX} y={yM + 19 + k * MEM} fontSize="12" style={{ fontFamily: MONO }}>{s}</text>
            ))}
          </g>
        )
      })}
    </DiagramSvg>
  )
}
