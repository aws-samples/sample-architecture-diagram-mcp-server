// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── View: journey (user journey / story map) ───
// Columns = steps grouped under stage chevrons; rows = step cards, emotion
// curve (monotone line through faces), pains and opportunities chips.
// Reveal: one stage per step, left → right (curve clipped to revealed stages).
import { line, curveMonotoneX } from 'd3-shape'
import { DiagramSvg, toneColor, paletteColor, wrapText, useSvgIds } from './DiagramSvg.jsx'
import { describeTypedDiagram } from '../index.js'

const COL = 196, GAP = 14, LG = 138, PAD = 20
const STAGE_PAL = [0, 3, 4, 2, 5, 6, 7, 1]
const EMO_TONE = { 2: 'success', 1: 'teal', 0: 'neutral', '-1': 'warn', '-2': 'danger' }
const EMO_LABEL = { 2: 'Encantado', 1: 'Satisfeito', 0: 'Neutro', '-1': 'Frustrado', '-2': 'Irritado' }
const CHIP = 12, CHIP_LH = 15

function Face({ x, y, e, r = 13 }) {
  const c = toneColor(EMO_TONE[e])
  const my = r * 0.32, curve = e * r * 0.16
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={c} stroke="var(--dg-bg)" strokeWidth="2.5" />
      <circle cx={x - r * 0.36} cy={y - r * 0.22} r={r * 0.12} fill="#fff" />
      <circle cx={x + r * 0.36} cy={y - r * 0.22} r={r * 0.12} fill="#fff" />
      <path d={`M${x - r * 0.42},${y + my} Q${x},${y + my + curve * 2} ${x + r * 0.42},${y + my}`} fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  )
}

const chipLayout = (texts, w) => texts.map(t => {
  const lines = wrapText(t, w - 18, CHIP)
  return { t, lines, h: lines.length * CHIP_LH + 10 }
})
const stackH = (chips) => chips.reduce((a, c) => a + c.h + 6, 0)

export default function JourneyView({ doc, step = null, fit }) {
  const ids = useSvgIds()
  const stages = doc.stages || []
  const steps = doc.steps || []
  const personas = doc.personas || []
  const pIdx = Object.fromEntries(personas.map((p, i) => [p.id, i]))
  const cw = COL - GAP

  // columns: steps in stage order (doc order inside a stage); empty stage = 1 blank column
  const cols = []
  const stageBox = stages.map((s, si) => {
    const own = steps.filter(p => p.stage === s.id)
    const x0 = LG + cols.length * COL
    if (own.length) own.forEach(p => cols.push({ p, si })); else cols.push({ p: null, si })
    return { s, si, x0, w: (cols.length * COL) - (x0 - LG) - GAP, n: Math.max(1, own.length) }
  })
  const W = LG + cols.length * COL - GAP + PAD
  const colX = (i) => LG + i * COL

  let y = PAD
  const personaY = personas.length ? y + 8 : null
  if (personas.length) y += 36
  // stage header
  const stageLines = stageBox.map(b => wrapText(b.s.label, b.w - 40, 14))
  const headH = Math.max(46, ...stageLines.map(l => l.length * 17 + 18))
  const headY = y; y += headH + 14
  // cards
  const cards = cols.map(c => {
    if (!c.p) return null
    const lines = wrapText(c.p.label, cw - 24, 13)
    const actor = c.p.actor ? (personas[pIdx[c.p.actor]]?.label || c.p.actor) : null
    const actorLines = actor ? wrapText(actor, cw - 38, 11.5) : []
    return { lines, actor, actorLines, pi: pIdx[c.p.actor] }
  })
  const cardH = Math.max(56, ...cards.map(c => c ? 20 + c.lines.length * 16 + (c.actor ? 6 + c.actorLines.length * 14 : 0) + 6 : 0))
  const cardY = y; y += cardH + 18
  // emotion lane
  const hasEmo = steps.some(p => p.emotion != null)
  const emoY = y, LV = 30, emoH = hasEmo ? LV * 4 + 56 : 0
  const levelY = (e) => emoY + 36 + (2 - e) * LV
  if (hasEmo) y += emoH + 12
  // chips rows
  const pains = cols.map(c => chipLayout(c.p?.pains || [], cw))
  const opps = cols.map(c => chipLayout(c.p?.opportunities || [], cw))
  const painH = Math.max(0, ...pains.map(stackH))
  const oppH = Math.max(0, ...opps.map(stackH))
  const painY = y; if (painH) y += painH + 18
  const oppY = y; if (oppH) y += oppH + 18
  const H = y + PAD - 8

  const shown = (si) => step == null || si < step
  const revealedStages = step == null ? stages.length : Math.min(step, stages.length)
  const lastCol = cols.reduce((a, c, i) => (c.si < revealedStages ? i : a), -1)
  const clipW = revealedStages >= stages.length ? W : (lastCol >= 0 ? colX(lastCol) + cw / 2 + 14.5 : 0)

  const pts = cols.map((c, i) => ({ x: colX(i) + cw / 2, e: c.p?.emotion }))
  const path = line().defined(d => d.e != null).x(d => d.x).y(d => levelY(d.e)).curve(curveMonotoneX)(pts)
  const rowBand = (yy, h, label) => (
    <g>
      <rect x={PAD - 8} y={yy - 6} width={W - 2 * PAD + 16} height={h + 12} rx="10" fill="var(--dg-panel)" />
      <text x={PAD + 4} y={yy + 16} fontSize="13" fontWeight="700" className="dg-muted">{label}</text>
    </g>
  )
  const Chips = ({ list, x, y0, tone }) => {
    const c = toneColor(tone)
    let yy = y0
    return list.map((ch, k) => {
      const g = (
        <g key={k}>
          <rect x={x} y={yy} width={cw} height={ch.h} rx="7" fill={c} fillOpacity="0.13" stroke={c} strokeOpacity="0.55" strokeWidth="1.2" />
          <rect x={x} y={yy} width="4" height={ch.h} rx="2" fill={c} />
          {ch.lines.map((ln, j) => <text key={j} x={x + 12} y={yy + 17 + j * CHIP_LH} fontSize={CHIP}>{ln}</text>)}
        </g>
      )
      yy += ch.h + 6
      return g
    })
  }

  return (
    <DiagramSvg width={W} height={H} title={doc.title || 'Jornada'} desc={describeTypedDiagram(doc)} fit={fit}>
      <defs><clipPath id={ids('clip')}><rect x="0" y="0" width={clipW} height={H} /></clipPath></defs>
      {personaY != null && (
        <g>
          <text x={PAD + 4} y={personaY + 5} fontSize="13" fontWeight="700" className="dg-muted">Personas</text>
          {(() => {
            let px = LG
            return personas.map((p, i) => {
              const el = (
                <g key={p.id}>
                  <circle cx={px + 6} cy={personaY} r="6" fill={paletteColor(i + 3)} />
                  <text x={px + 18} y={personaY + 5} fontSize="13">{p.label}</text>
                </g>
              )
              px += 34 + p.label.length * 13 * 0.56
              return el
            })
          })()}
        </g>
      )}
      {/* row bands */}
      {rowBand(cardY, cardH, 'Passos')}
      {hasEmo && rowBand(emoY, emoH, 'Emoção')}
      {painH > 0 && rowBand(painY, painH - 6, 'Dores')}
      {oppH > 0 && rowBand(oppY, oppH - 6, 'Oportunidades')}
      {hasEmo && [2, 1, 0, -1, -2].map(e => (
        <g key={e}>
          <line x1={LG - 6} x2={W - PAD} y1={levelY(e)} y2={levelY(e)} stroke="var(--dg-grid)" strokeWidth="1.2" strokeDasharray={e === 0 ? undefined : '3 5'} />
          <text x={LG - 12} y={levelY(e) + 4} fontSize="11" textAnchor="end" className="dg-muted">{EMO_LABEL[e]}</text>
        </g>
      ))}
      {/* stages */}
      {stageBox.map((b, i) => {
        const c = paletteColor(STAGE_PAL[i % STAGE_PAL.length])
        const tip = 16, x0 = b.x0 - (i ? GAP / 2 : 0), x1 = b.x0 + b.w + GAP / 2 - 2
        const notch = i ? tip : 0
        const d = `M${x0},${headY} L${x1 - tip},${headY} L${x1},${headY + headH / 2} L${x1 - tip},${headY + headH} L${x0},${headY + headH} L${x0 + notch},${headY + headH / 2} Z`
        const ls = stageLines[i]
        return (
          <g key={b.s.id} className="dg-step" style={{ opacity: shown(i) ? 1 : 0 }}>
            <path d={d} fill={c} />
            {ls.map((ln, j) => (
              <text key={j} x={(x0 + notch + x1 - tip) / 2} y={headY + headH / 2 + 5 + (j - (ls.length - 1) / 2) * 17} fontSize="14" fontWeight="700" textAnchor="middle" style={{ fill: '#fff' }}>{ln}</text>
            ))}
            {i > 0 && <line x1={b.x0 - GAP / 2} x2={b.x0 - GAP / 2} y1={cardY - 6} y2={H - PAD} stroke="var(--dg-line)" strokeWidth="1.2" strokeDasharray="2 6" />}
          </g>
        )
      })}
      {/* columns */}
      {cols.map((c, i) => {
        const x = colX(i), card = cards[i]
        const sc = paletteColor(STAGE_PAL[c.si % STAGE_PAL.length])
        return (
          <g key={c.p?.id || `empty-${i}`} className="dg-step" style={{ opacity: shown(c.si) ? 1 : 0 }}>
            {card ? (
              <g>
                <rect x={x} y={cardY} width={cw} height={cardH} rx="9" fill="var(--dg-bg)" stroke="var(--dg-line)" strokeWidth="1.2" />
                <rect x={x} y={cardY} width={cw} height="5" rx="2.5" fill={sc} />
                {card.lines.map((ln, j) => <text key={j} x={x + 12} y={cardY + 26 + j * 16} fontSize="13" fontWeight="600">{ln}</text>)}
                {card.actor && (
                  <g>
                    <circle cx={x + 17} cy={cardY + 20 + card.lines.length * 16 + 10} r="5" fill={card.pi != null ? paletteColor(card.pi + 3) : 'var(--dg-muted)'} />
                    {card.actorLines.map((ln, j) => <text key={j} x={x + 28} y={cardY + 20 + card.lines.length * 16 + 14 + j * 14} fontSize="11.5" className="dg-muted">{ln}</text>)}
                  </g>
                )}
              </g>
            ) : (
              <rect x={x} y={cardY} width={cw} height={cardH} rx="9" fill="none" stroke="var(--dg-line)" strokeDasharray="4 4" />
            )}
            <Chips list={pains[i]} x={x} y0={painY} tone="danger" />
            <Chips list={opps[i]} x={x} y0={oppY} tone="success" />
          </g>
        )
      })}
      {/* emotion curve */}
      {hasEmo && path && (
        <g clipPath={`url(#${ids('clip')})`}>
          <path d={path} fill="none" stroke="var(--dg-muted)" strokeWidth="2.5" strokeLinecap="round" />
          {pts.map((p, i) => p.e != null && <Face key={i} x={p.x} y={levelY(p.e)} e={p.e} />)}
        </g>
      )}
    </DiagramSvg>
  )
}
