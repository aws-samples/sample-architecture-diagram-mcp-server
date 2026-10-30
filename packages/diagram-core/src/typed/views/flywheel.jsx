// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── View: flywheel ───
// Stages as coloured discs on a circle (clockwise from the top), joined by
// curved arrows along the wheel; the outcome sits in the center. Each stage's
// description is placed radially outside its disc; inputs (accelerators) are
// pills further out, pointing at the arc that leads into their stage.
// Layout is computed around (0,0), then the viewBox is fitted to the bbox.
import { DiagramSvg, paletteColor, toneColor, textW, wrapText, useSvgIds } from './DiagramSvg.jsx'
import { describeTypedDiagram } from '../index.js'

const DW = 180, DFS = 12.5, DLH = 16, PAD = 24

export default function FlywheelView({ doc, step = null, fit }) {
  const id = useSvgIds()
  const stages = doc.stages || []
  const n = Math.max(stages.length, 1)
  const R = n <= 4 ? 190 : n <= 6 ? 215 : 250
  const NR = n <= 6 ? 62 : 54
  const LFS = n <= 6 ? 14 : 13
  const stepA = (2 * Math.PI) / n
  const ang = (i) => -Math.PI / 2 + i * stepA
  const P = (a, r) => ({ x: Math.cos(a) * r, y: Math.sin(a) * r })
  const shown = (i) => step == null || i < step
  const box = { x0: -R - NR, y0: -R - NR, x1: R + NR, y1: R + NR }
  const grow = (x0, y0, x1, y1) => { box.x0 = Math.min(box.x0, x0); box.y0 = Math.min(box.y0, y0); box.x1 = Math.max(box.x1, x1); box.y1 = Math.max(box.y1, y1) }

  // stage discs + descriptions
  const nodes = stages.map((s, i) => {
    const a = ang(i), c = P(a, R)
    const lines = wrapText(s.label, NR * 1.55, LFS)
    let desc = null
    if (s.desc) {
      const dl = wrapText(s.desc, DW, DFS)
      const cos = Math.cos(a), sin = Math.sin(a)
      const o = P(a, R + NR + 14)
      const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle'
      const h = dl.length * DLH
      const top = sin < -0.3 ? o.y - h + 4 : sin > 0.3 ? o.y + 8 : o.y - h / 2 + 10
      const w = Math.max(...dl.map(l => textW(l, DFS)))
      const x0 = anchor === 'start' ? o.x : anchor === 'end' ? o.x - w : o.x - w / 2
      grow(x0, top - 12, x0 + w, top + h)
      desc = { lines: dl, x: o.x, top, anchor, bb: { x0: x0 - 6, y0: top - 14, x1: x0 + w + 6, y1: top + h - 6 } }
    }
    return { s, a, c, lines, desc, color: s.tone ? toneColor(s.tone) : paletteColor(i) }
  })

  // inputs: pill outside the incoming arc of the target stage
  const idx = Object.fromEntries(stages.map((s, i) => [s.id, i]))
  const perStage = {}
  const inputs = (doc.inputs || []).filter(inp => idx[inp.toStage] != null).map((inp) => {
    const j = idx[inp.toStage]
    const k = (perStage[j] = (perStage[j] ?? -1) + 1)
    const a = ang(j) - stepA / 2 + k * 0.16
    const w = textW(inp.label, 12) * 1.06 + 38, h = 28
    // push the pill outward until it clears every description block
    let rOut = R + NR + 80 + k * 40, c = P(a, rOut)
    const clash = (q) => nodes.some(nd => nd.desc && q.x - w / 2 < nd.desc.bb.x1 && q.x + w / 2 > nd.desc.bb.x0 && q.y - h / 2 < nd.desc.bb.y1 && q.y + h / 2 > nd.desc.bb.y0)
    for (let t = 0; t < 30 && clash(c); t++) { rOut += 10; c = P(a, rOut) }
    const tip = P(a, R + 9)
    const tail = P(a, rOut - 16)
    grow(c.x - w / 2, c.y - h / 2, c.x + w / 2, c.y + h / 2)
    return { inp, j, c, w, h, tip, tail }
  })

  const ox = -box.x0 + PAD, oy = -box.y0 + PAD
  const W = box.x1 - box.x0 + 2 * PAD, H = box.y1 - box.y0 + 2 * PAD
  const gap = (NR + 10) / R
  const arc = (i) => {
    const a0 = ang(i) + gap, a1 = ang(i + 1) - gap
    const p0 = P(a0, R), p1 = P(a1, R)
    return `M${p0.x + ox},${p0.y + oy} A${R},${R} 0 0 1 ${p1.x + ox},${p1.y + oy}`
  }
  const Rc = Math.max(70, R - NR - 34)
  const cLines = wrapText(doc.center || '', Rc * 1.45, 19)
  const accent = toneColor('accent')

  return (
    <DiagramSvg width={W} height={H} title={doc.title || 'Flywheel'} desc={describeTypedDiagram(doc)} fit={fit}>
      <defs>
        <marker id={id('arr')} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--dg-muted)" />
        </marker>
        <marker id={id('in')} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill={accent} />
        </marker>
      </defs>
      {/* wheel track + center */}
      <circle cx={ox} cy={oy} r={R} fill="none" stroke="var(--dg-grid)" strokeWidth="18" />
      <circle cx={ox} cy={oy} r={Rc} fill="var(--dg-panel)" stroke={accent} strokeWidth="2.5" />
      <circle cx={ox} cy={oy} r={Rc - 9} fill="none" stroke="var(--dg-line)" strokeWidth="1.2" strokeDasharray="4 5" />
      {cLines.map((ln, j) => (
        <text key={j} x={ox} y={oy + 7 + (j - (cLines.length - 1) / 2) * 24} fontSize="19" fontWeight="800" textAnchor="middle">{ln}</text>
      ))}
      {/* arrows between stages (clockwise) */}
      {stages.map((s, i) => {
        const vis = i === n - 1 ? (step == null || step >= n) : shown(i + 1)
        return <path key={`a${i}`} d={arc(i)} className="dg-step" style={{ opacity: vis ? 1 : 0 }} fill="none" stroke="var(--dg-muted)" strokeWidth="3" strokeLinecap="round" markerEnd={`url(#${id('arr')})`} />
      })}
      {/* inputs */}
      {inputs.map((p, k) => (
        <g key={`i${k}`} className="dg-step" style={{ opacity: shown(p.j) ? 1 : 0 }}>
          <line x1={p.tail.x + ox} y1={p.tail.y + oy} x2={p.tip.x + ox} y2={p.tip.y + oy} stroke={accent} strokeWidth="2" strokeDasharray="5 4" markerEnd={`url(#${id('in')})`} />
          <rect x={p.c.x + ox - p.w / 2} y={p.c.y + oy - p.h / 2} width={p.w} height={p.h} rx={p.h / 2} fill="var(--dg-bg)" stroke={accent} strokeWidth="1.6" />
          <circle cx={p.c.x + ox - p.w / 2 + 15} cy={p.c.y + oy} r="8" fill={accent} />
          <text x={p.c.x + ox - p.w / 2 + 15} y={p.c.y + oy + 4.5} fontSize="13" fontWeight="800" textAnchor="middle" style={{ fill: '#fff' }}>+</text>
          <text x={p.c.x + ox - p.w / 2 + 29} y={p.c.y + oy + 4.5} fontSize="12" fontWeight="700">{p.inp.label}</text>
        </g>
      ))}
      {/* stages */}
      {nodes.map((nd, i) => (
        <g key={nd.s.id || i} className="dg-step" style={{ opacity: shown(i) ? 1 : 0 }}>
          <circle cx={nd.c.x + ox} cy={nd.c.y + oy} r={NR} fill={nd.color} stroke="var(--dg-bg)" strokeWidth="4" />
          <text x={nd.c.x + ox} y={nd.c.y + oy - NR + 20} fontSize="11" fontWeight="700" textAnchor="middle" style={{ fill: '#fff', opacity: 0.85 }}>{i + 1}</text>
          {nd.lines.map((ln, j) => (
            <text key={j} x={nd.c.x + ox} y={nd.c.y + oy + 8 + (j - (nd.lines.length - 1) / 2) * (LFS + 3)} fontSize={LFS} fontWeight="700" textAnchor="middle" style={{ fill: '#fff' }}>{ln}</text>
          ))}
          {nd.desc && nd.desc.lines.map((ln, j) => (
            <text key={`d${j}`} x={nd.desc.x + ox} y={nd.desc.top + oy + j * DLH} fontSize={DFS} textAnchor={nd.desc.anchor} className="dg-muted">{ln}</text>
          ))}
        </g>
      ))}
    </DiagramSvg>
  )
}
