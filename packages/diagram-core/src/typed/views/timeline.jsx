// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── View: timeline ───
// Horizontal: events evenly spaced on a horizontal axis, cards alternate
// above/below (same-side neighbours are 2 slots apart so cards never collide).
// Vertical: axis in the middle, cards alternate left/right; each event's y is
// pushed down until it clears the previous card on the same side.
import { DiagramSvg, toneColor, paletteColor, wrapText, textW, useSvgIds } from './DiagramSvg.jsx'
import { describeTypedDiagram } from '../index.js'

const M = 36, PAD = 14
const DATE_SIZE = 12, LABEL_SIZE = 15, DESC_SIZE = 12.5
const LABEL_LH = 19, DESC_LH = 16, DATE_H = 22

function measure(ev, cw) {
  const inner = cw - PAD * 2
  const label = wrapText(ev.label, inner, LABEL_SIZE)
  const desc = ev.desc ? wrapText(ev.desc, inner, DESC_SIZE) : []
  const h = PAD + DATE_H + 8 + label.length * LABEL_LH + (desc.length ? 4 + desc.length * DESC_LH : 0) + PAD - 4
  return { label, desc, h }
}

function Card({ ev, x, y, cw, m, color }) {
  const pillW = Math.min(cw - PAD * 2, textW(ev.date, DATE_SIZE) + 20)
  let ty = y + PAD + DATE_H + 8 + LABEL_SIZE - 3
  return (
    <g>
      <rect x={x} y={y} width={cw} height={m.h} rx="10" fill="var(--dg-panel)" stroke={color} strokeWidth="1.5" />
      <rect x={x + PAD} y={y + PAD} width={pillW} height={DATE_H} rx={DATE_H / 2} fill={color} />
      <text x={x + PAD + pillW / 2} y={y + PAD + 15} fontSize={DATE_SIZE} fontWeight="700" textAnchor="middle" style={{ fill: '#fff' }}>{ev.date}</text>
      {m.label.map((ln, j) => (
        <text key={`l${j}`} x={x + PAD} y={ty + j * LABEL_LH} fontSize={LABEL_SIZE} fontWeight="700">{ln}</text>
      ))}
      {m.desc.map((ln, j) => (
        <text key={`d${j}`} x={x + PAD} y={ty + m.label.length * LABEL_LH + 4 + j * DESC_LH} fontSize={DESC_SIZE} className="dg-muted">{ln}</text>
      ))}
    </g>
  )
}

export default function TimelineView({ doc, step = null, fit }) {
  const ids = useSvgIds()
  const events = doc.events || []
  const vertical = doc.orientation === 'vertical'
  const colorOf = (ev, i) => (ev.tone ? toneColor(ev.tone) : paletteColor(i))
  const shown = (i) => step == null || i < step
  const title = doc.title || 'Linha do tempo'
  const desc = describeTypedDiagram(doc)

  if (!vertical) {
    const CW = 210, SP = 128, STEM = 34
    const ms = events.map(ev => measure(ev, CW))
    const upH = Math.max(0, ...ms.filter((_, i) => i % 2 === 0).map(m => m.h))
    const dnH = Math.max(0, ...ms.filter((_, i) => i % 2 === 1).map(m => m.h))
    const axisY = M + upH + STEM
    const W = M * 2 + Math.max(0, events.length - 1) * SP + CW
    const H = axisY + STEM + dnH + M
    const X = (i) => M + CW / 2 + i * SP
    return (
      <DiagramSvg width={W} height={H} title={title} desc={desc} fit={fit}>
        <defs>
          <marker id={ids('arr')} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--dg-line)" />
          </marker>
        </defs>
        <line x1={M / 2} y1={axisY} x2={W - M / 2} y2={axisY} stroke="var(--dg-line)" strokeWidth="3" markerEnd={`url(#${ids('arr')})`} />
        {events.map((ev, i) => {
          const c = colorOf(ev, i), m = ms[i], cx = X(i), up = i % 2 === 0
          const cy = up ? axisY - STEM - m.h : axisY + STEM
          return (
            <g key={ev.id || i} className="dg-step" style={{ opacity: shown(i) ? 1 : 0 }}>
              <line x1={cx} y1={axisY} x2={cx} y2={up ? axisY - STEM : axisY + STEM} stroke={c} strokeWidth="2" />
              <circle cx={cx} cy={axisY} r="8" fill={c} stroke="var(--dg-bg)" strokeWidth="3" />
              <Card ev={ev} x={cx - CW / 2} y={cy} cw={CW} m={m} color={c} />
            </g>
          )
        })}
      </DiagramSvg>
    )
  }

  // vertical
  const CW = 320, GAP = 46, TOP = 22
  const ms = events.map(ev => measure(ev, CW))
  const ys = []
  events.forEach((_, i) => {
    let y = M + TOP
    if (i >= 1) y = Math.max(y, ys[i - 1] + 58)
    if (i >= 2) y = Math.max(y, ys[i - 2] + ms[i - 2].h + 18)
    ys.push(y)
  })
  const AX = M + CW + GAP
  const W = AX * 2
  const H = Math.max(M * 2 + 60, ...events.map((_, i) => ys[i] - TOP + ms[i].h + M))
  return (
    <DiagramSvg width={W} height={H} title={title} desc={desc} fit={fit}>
      <defs>
        <marker id={ids('arr')} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--dg-line)" />
        </marker>
      </defs>
      <line x1={AX} y1={M / 2} x2={AX} y2={H - M / 2} stroke="var(--dg-line)" strokeWidth="3" markerEnd={`url(#${ids('arr')})`} />
      {events.map((ev, i) => {
        const c = colorOf(ev, i), m = ms[i], y = ys[i], left = i % 2 === 0
        const x = left ? AX - GAP - CW : AX + GAP
        return (
          <g key={ev.id || i} className="dg-step" style={{ opacity: shown(i) ? 1 : 0 }}>
            <line x1={AX} y1={y} x2={left ? AX - GAP : AX + GAP} y2={y} stroke={c} strokeWidth="2" />
            <circle cx={AX} cy={y} r="8" fill={c} stroke="var(--dg-bg)" strokeWidth="3" />
            <Card ev={ev} x={x} y={y - TOP} cw={CW} m={m} color={c} />
          </g>
        )
      })}
    </DiagramSvg>
  )
}
