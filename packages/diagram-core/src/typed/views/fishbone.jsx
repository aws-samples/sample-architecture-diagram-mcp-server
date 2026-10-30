// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── View: fishbone (Ishikawa) ───
// Spine runs left → right into the problem box (fish head). Category bones
// alternate above/below, angled into the spine; causes are horizontal ticks
// along each bone (text right-aligned against the bone), sub-causes smaller
// below their cause. Deterministic layout: row heights from wrapText.
import { DiagramSvg, paletteColor, toneColor, textW, wrapText, useSvgIds } from './DiagramSvg.jsx'
import { describeTypedDiagram } from '../index.js'

const FS = 13, LH = 16, SFS = 11.5, SLH = 14
const COLW = 290, TXT = COLW - 70, SLOPE = 0.5
const BOXH = 34, T = 24, HEADW = 230

const norm = (c) => (typeof c === 'string' ? { label: c, sub: [] } : { label: c?.label || '', sub: c?.sub || [] })

// Pre-layout one category's causes: relative offsets from the bone start.
function layoutCauses(causes) {
  let y = 30
  const rows = causes.map((raw) => {
    const c = norm(raw)
    const lines = wrapText(c.label, TXT, FS)
    const lineYs = lines.map((_, j) => y + j * LH)
    const tickY = y + (lines.length - 1) * LH + 6
    let sy = tickY + 4
    const subs = c.sub.map((s) => {
      const sl = wrapText(s, TXT - 30, SFS)
      const ys = sl.map((_, j) => sy + 12 + j * SLH)
      sy += sl.length * SLH + 2
      return { lines: sl, ys }
    })
    const row = { lines, lineYs, tickY, subs, w: Math.max(...lines.map(l => textW(l, FS))) }
    y = sy + 22
    return row
  })
  return { rows, len: y - 8 }
}

export default function FishboneView({ doc, step = null, fit }) {
  const id = useSvgIds()
  const cats = doc.categories || []
  const n = cats.length
  const m = Math.max(1, Math.ceil(n / 2))
  const laid = cats.map(c => layoutCauses(c.causes || []))
  const boneH = Math.max(150, ...laid.map(l => l.len))
  const dx = boneH * SLOPE
  const spineY = T + BOXH + boneH
  const x0 = 40 + TXT + 30 + dx // join x of the first (leftmost) bone pair
  const jx = (k) => x0 + k * COLW
  const headX = jx(m - 1) + 60
  const headLines = wrapText(doc.problem || '', HEADW - 32, 16)
  const headH = Math.max(84, headLines.length * 21 + 30)
  const W = headX + HEADW + 30
  const H = Math.max(spineY + boneH + BOXH + T, spineY + headH / 2 + 20)
  const danger = toneColor('danger')
  const tailX = x0 - TXT - 40 // left of every cause label near the spine

  return (
    <DiagramSvg width={W} height={H} title={doc.title || 'Espinha de peixe (Ishikawa)'} desc={describeTypedDiagram(doc)} fit={fit}>
      <defs>
        <marker id={id('head')} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--dg-ink)" />
        </marker>
      </defs>
      {/* spine + tail */}
      <path d={`M${tailX - 30},${spineY - 22} L${tailX},${spineY} L${tailX - 30},${spineY + 22}`} fill="none" stroke="var(--dg-muted)" strokeWidth="3" strokeLinejoin="round" />
      <line x1={tailX} y1={spineY} x2={headX - 4} y2={spineY} stroke="var(--dg-ink)" strokeWidth="4" markerEnd={`url(#${id('head')})`} />
      {/* problem head */}
      <rect x={headX} y={spineY - headH / 2} width={HEADW} height={headH} rx="14" fill={danger} />
      {headLines.map((ln, j) => (
        <text key={j} x={headX + HEADW / 2} y={spineY + 6 + (j - (headLines.length - 1) / 2) * 21} fontSize="16" fontWeight="700" textAnchor="middle" style={{ fill: '#fff' }}>{ln}</text>
      ))}
      {cats.map((c, i) => {
        const shown = step == null || i < step
        const top = i % 2 === 0
        const k = Math.floor(i / 2)
        const J = jx(k)
        const color = paletteColor(i)
        const outerY = top ? spineY - boneH : spineY + boneH
        const outerX = J - dx
        // bone x at a given y
        const bx = (y) => J - SLOPE * Math.abs(spineY - y)
        // row offset → absolute y (top bones: from the box down; bottom: from the spine down)
        const Y = (o) => (top ? outerY + o : spineY + o)
        const lw = textW(c.label, 14) * 1.08 + 28
        const by = top ? outerY - BOXH : outerY
        return (
          <g key={c.id || i} className="dg-step" style={{ opacity: shown ? 1 : 0 }}>
            <line x1={outerX} y1={outerY} x2={J} y2={spineY} stroke={color} strokeWidth="3" strokeLinecap="round" />
            <rect x={outerX - lw / 2} y={by} width={lw} height={BOXH} rx="8" fill={color} />
            <text x={outerX} y={by + 22} fontSize="14" fontWeight="700" textAnchor="middle" style={{ fill: '#fff' }}>{c.label}</text>
            {laid[i].rows.map((r, ri) => {
              const ty = Y(r.tickY)
              const px = bx(ty)
              return (
                <g key={ri}>
                  <line x1={px - r.w - 16} y1={ty} x2={px} y2={ty} stroke={color} strokeWidth="1.4" opacity="0.75" />
                  <circle cx={px} cy={ty} r="2.6" fill={color} />
                  {r.lines.map((ln, j) => {
                    const ly = Y(r.lineYs[j])
                    return <text key={j} x={bx(ly - 10) - 10} y={ly} fontSize={FS} fontWeight="600" textAnchor="end">{ln}</text>
                  })}
                  {r.subs.map((s, si) => s.lines.map((ln, j) => {
                    const ly = Y(s.ys[j])
                    const sx = bx(ly - 4)
                    return (
                      <g key={`${si}-${j}`}>
                        {j === 0 && <line x1={sx - 16} y1={ly - 4} x2={sx} y2={ly - 4} stroke="var(--dg-line)" strokeWidth="1.2" />}
                        {j === 0 && <circle cx={sx - 19} cy={ly - 4} r="2" fill="var(--dg-muted)" />}
                        <text x={sx - 26} y={ly} fontSize={SFS} textAnchor="end" className="dg-muted">{ln}</text>
                      </g>
                    )
                  }))}
                </g>
              )
            })}
          </g>
        )
      })}
    </DiagramSvg>
  )
}
