// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── View: layers (layered stack) ───
// Full-width bands (label + description on the left, item chips wrapping on
// the right) and vertical side rails for cross-cutting concerns.
// Reveal: bottom → top (foundation first); rails on the final step.
import { DiagramSvg, toneColor, paletteColor, wrapText, textW } from './DiagramSvg.jsx'
import { describeTypedDiagram } from '../index.js'

const W0 = 1040, PAD = 20, LABEL_W = 230, BAND_GAP = 10, BAND_PAD = 16
const CHIP_H = 30, CHIP_GAP = 8, CHIP_FS = 13, RAIL_W = 54, RAIL_GAP = 10

export default function LayersView({ doc, step = null, fit }) {
  const layers = doc.layers || []
  const rails = doc.sideRails || []
  const n = layers.length
  const idx = Object.fromEntries(layers.map((l, i) => [l.id, i]))
  const railsW = rails.length ? rails.length * (RAIL_W + RAIL_GAP) : 0
  const W = W0 + railsW
  const bandX = PAD, bandW = W0 - 2 * PAD
  const chipX0 = bandX + LABEL_W, chipMaxX = bandX + bandW - BAND_PAD

  const bands = layers.map((l, i) => {
    const c = toneColor(l.tone, paletteColor(i))
    const labelLines = wrapText(l.label, LABEL_W - 40, 16)
    const descLines = l.desc ? wrapText(l.desc, LABEL_W - 40, 12) : []
    const labelH = labelLines.length * 20 + (descLines.length ? 6 + descLines.length * 15 : 0)
    // chip flow
    const chips = []
    let cx = chipX0, row = 0
    for (const it of l.items || []) {
      const maxTW = chipMaxX - chipX0 - 24
      const lines = wrapText(it, maxTW, CHIP_FS)
      const w = Math.min(chipMaxX - chipX0, Math.max(...lines.map(t => textW(t, CHIP_FS))) + 26)
      if (cx + w > chipMaxX && cx > chipX0) { cx = chipX0; row++ }
      chips.push({ t: lines, x: cx, row, w })
      cx += w + CHIP_GAP
    }
    const rows = chips.length ? row + 1 : 0
    const chipsH = rows * CHIP_H + Math.max(0, rows - 1) * CHIP_GAP
    const h = Math.max(labelH, chipsH, 30) + 2 * BAND_PAD
    return { l, i, c, y: 0, h, labelLines, descLines, labelH, chips, chipsH }
  })
  let y = PAD
  for (const b of bands) { b.y = y; y += b.h + BAND_GAP }
  const H = y - BAND_GAP + PAD

  // reveal: bottom layer first
  const order = (i) => n - 1 - i
  const shown = (o) => step == null || o < step

  const railBoxes = rails.map((r, k) => {
    let a = 0, b = n - 1
    if (r.span?.length === 2 && idx[r.span[0]] != null && idx[r.span[1]] != null) {
      a = Math.min(idx[r.span[0]], idx[r.span[1]]); b = Math.max(idx[r.span[0]], idx[r.span[1]])
    }
    const top = bands[a]?.y ?? PAD, bot = bands[b] ? bands[b].y + bands[b].h : H - PAD
    const x = W0 - PAD + RAIL_GAP + k * (RAIL_W + RAIL_GAP)
    const c = toneColor(r.tone, toneColor('neutral'))
    let fs = 14, lines = wrapText(r.label, bot - top - 24, 14)
    if (lines.length > 2) { fs = 12; lines = wrapText(r.label, bot - top - 20, 12).slice(0, 3) }
    return { r, x, top, bot, c, lines, fs }
  })

  return (
    <DiagramSvg width={W} height={H} title={doc.title || 'Camadas'} desc={describeTypedDiagram(doc)} fit={fit}>
      {bands.map(b => (
        <g key={b.l.id} className="dg-step" style={{ opacity: shown(order(b.i)) ? 1 : 0 }}>
          <rect x={bandX} y={b.y} width={bandW} height={b.h} rx="10" fill={b.c} fillOpacity="0.13" stroke={b.c} strokeOpacity="0.5" strokeWidth="1.2" />
          <rect x={bandX} y={b.y} width="7" height={b.h} rx="3.5" fill={b.c} />
          {(() => {
            const ty = b.y + b.h / 2 - b.labelH / 2 + 15
            return (
              <g>
                {b.labelLines.map((t, j) => <text key={j} x={bandX + 22} y={ty + j * 20} fontSize="16" fontWeight="700">{t}</text>)}
                {b.descLines.map((t, j) => <text key={`d${j}`} x={bandX + 22} y={ty + b.labelLines.length * 20 + 4 + j * 15} fontSize="12" className="dg-muted">{t}</text>)}
              </g>
            )
          })()}
          {b.chips.map((ch, j) => {
            const cy = b.y + b.h / 2 - b.chipsH / 2 + ch.row * (CHIP_H + CHIP_GAP)
            return (
              <g key={j}>
                <rect x={ch.x} y={cy} width={ch.w} height={CHIP_H} rx="15" fill="var(--dg-bg)" stroke={b.c} strokeOpacity="0.8" strokeWidth="1.2" />
                <text x={ch.x + ch.w / 2} y={cy + CHIP_H / 2 + 4.5} fontSize={CHIP_FS} fontWeight="600" textAnchor="middle">{ch.t.join(' ')}</text>
              </g>
            )
          })}
        </g>
      ))}
      {railBoxes.map((rb, k) => {
        const cx = rb.x + RAIL_W / 2, cy = (rb.top + rb.bot) / 2
        const lh = rb.fs + 3
        return (
          <g key={k} className="dg-step" style={{ opacity: shown(n) ? 1 : 0 }}>
            <rect x={rb.x} y={rb.top} width={RAIL_W} height={rb.bot - rb.top} rx="10" fill={rb.c} fillOpacity="0.16" stroke={rb.c} strokeWidth="1.5" />
            <g transform={`translate(${cx},${cy}) rotate(-90)`}>
              {rb.lines.map((t, j) => (
                <text key={j} x="0" y={(j - (rb.lines.length - 1) / 2) * lh + rb.fs * 0.36} fontSize={rb.fs} fontWeight="700" textAnchor="middle">{t}</text>
              ))}
            </g>
          </g>
        )
      })}
    </DiagramSvg>
  )
}
