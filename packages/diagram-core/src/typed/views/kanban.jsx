// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── View: kanban ───
// Columns side by side (equal-height headers with count / WIP limit, red when
// over the limit) and stacked cards: tone stripe, wrapped title, tag chips,
// owner initials avatar and a "Bloqueado" indicator. Steps reveal columns.
import { DiagramSvg, toneColor, paletteColor, textW, wrapText } from './DiagramSvg.jsx'
import { describeTypedDiagram, getDiagramType } from '../index.js'

const COLW = 252, GAP = 16, M = 20, CPAD = 10, CARD_GAP = 10, TL = 17
const hash = (s) => [...String(s || '')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
const initials = (s) => {
  const w = String(s || '').trim().split(/\s+/).filter(Boolean)
  return ((w[0]?.[0] || '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase()
}
const clip = (s, maxW, size) => {
  const str = String(s || '')
  const n = Math.floor(maxW / (size * 0.56))
  return str.length <= n ? str : str.slice(0, Math.max(1, n - 1)) + '…'
}

function layoutCard(card, w) {
  const inner = w - 24
  const title = wrapText(card.title, inner, 13)
  const rows = []; let row = [], rw = 0
  for (const t of card.tags || []) {
    const cw = Math.min(textW(t, 11) + 14, inner)
    if (row.length && rw + cw > inner) { rows.push(row); row = []; rw = 0 }
    row.push({ t, cw }); rw += cw + 6
  }
  if (row.length) rows.push(row)
  const footer = !!(card.owner || card.blocked)
  const h = 14 + title.length * TL + (rows.length ? 6 + rows.length * 24 : 0) + (footer ? 34 : 4) + 4
  return { title, rows, footer, h }
}

function Card({ card, x, y, w, L }) {
  const danger = toneColor('danger')
  const stripe = card.blocked ? danger : card.tone ? toneColor(card.tone) : null
  let cy = y + 14
  const titleY = cy
  cy += L.title.length * TL
  const tagY = cy + 4
  const footY = y + L.h - 22
  const ownerW = w - 24 - 28 - (card.blocked ? 92 : 0)
  return (
    <g>
      <rect x={x} y={y} width={w} height={L.h} rx="8" fill="var(--dg-bg)" stroke={card.blocked ? danger : 'var(--dg-line)'} strokeWidth={card.blocked ? 1.8 : 1.2} />
      {stripe && <path d={`M${x + 5},${y} H${x + 8} V${y + L.h} H${x + 5} Q${x},${y + L.h} ${x},${y + L.h - 5} V${y + 5} Q${x},${y} ${x + 5},${y} Z`} fill={stripe} />}
      {L.title.map((ln, j) => <text key={j} x={x + 14} y={titleY + 11 + j * TL} fontSize="13" fontWeight="600">{ln}</text>)}
      {L.rows.map((row, ri) => {
        let tx = x + 14
        return row.map(({ t, cw }) => {
          const c = paletteColor(hash(t))
          const el = (
            <g key={`${ri}-${t}`}>
              <rect x={tx} y={tagY + ri * 24} width={cw} height="18" rx="9" fill={c} fillOpacity="0.16" stroke={c} strokeOpacity="0.55" />
              <text x={tx + cw / 2} y={tagY + ri * 24 + 13} fontSize="11" fontWeight="600" textAnchor="middle">{clip(t, cw - 12, 11)}</text>
            </g>
          )
          tx += cw + 6
          return el
        })
      })}
      {card.owner && (
        <g>
          <circle cx={x + 25} cy={footY} r="11" fill={paletteColor(hash(card.owner))} />
          <text x={x + 25} y={footY + 4} fontSize="11" fontWeight="700" textAnchor="middle" style={{ fill: '#fff' }}>{initials(card.owner)}</text>
          <text x={x + 42} y={footY + 4} fontSize="12" className="dg-muted">{clip(card.owner, ownerW, 12)}</text>
        </g>
      )}
      {card.blocked && (
        <g>
          <rect x={x + w - 96} y={footY - 10} width="84" height="20" rx="10" fill={danger} />
          <circle cx={x + w - 82} cy={footY} r="5" fill="none" stroke="#fff" strokeWidth="1.6" />
          <line x1={x + w - 85.5} y1={footY + 3.5} x2={x + w - 78.5} y2={footY - 3.5} stroke="#fff" strokeWidth="1.6" />
          <text x={x + w - 71} y={footY + 4} fontSize="11" fontWeight="700" style={{ fill: '#fff' }}>Bloqueado</text>
        </g>
      )}
    </g>
  )
}

export default function KanbanView({ doc, step = null, fit }) {
  const cols = doc.columns || []
  const cards = doc.cards || []
  const cw = COLW - CPAD * 2
  const heads = cols.map(c => wrapText(c.label, COLW - 96, 15))
  const over = cols.map(c => c.limit != null && cards.filter(k => k.column === c.id).length > c.limit)
  const HEAD = Math.max(...heads.map((h, i) => 22 + h.length * 19 + (over[i] ? 18 : 0)), 50) + 6
  const colData = cols.map(c => {
    const list = cards.filter(k => k.column === c.id)
    let y = M + HEAD + CPAD
    const placed = list.map(k => { const L = layoutCard(k, cw); const p = { k, L, y }; y += L.h + CARD_GAP; return p })
    return { placed, h: Math.max(y - M + (list.length ? 0 : 60), HEAD + 80) }
  })
  const colH = Math.max(...colData.map(d => d.h), 160)
  const W = M * 2 + cols.length * COLW + Math.max(0, cols.length - 1) * GAP
  const H = M * 2 + colH

  return (
    <DiagramSvg width={W} height={H} title={doc.title || getDiagramType('kanban').label} desc={describeTypedDiagram(doc)} fit={fit}>
      {cols.map((c, i) => {
        const x = M + i * (COLW + GAP)
        const tc = toneColor(c.tone, toneColor('neutral'))
        const n = colData[i].placed.length
        const ov = over[i]
        const badge = c.limit != null ? `${n}/${c.limit}` : String(n)
        const bw = Math.max(30, textW(badge, 12) + 16)
        const danger = toneColor('danger')
        return (
          <g key={c.id} className="dg-step" style={{ opacity: step == null || i < step ? 1 : 0 }}>
            <rect x={x} y={M} width={COLW} height={colH} rx="12" fill="var(--dg-panel)" stroke={ov ? danger : 'var(--dg-line)'} strokeWidth={ov ? 2 : 1.2} />
            <path d={`M${x},${M + 12} Q${x},${M} ${x + 12},${M} H${x + COLW - 12} Q${x + COLW},${M} ${x + COLW},${M + 12} V${M + 5} H${x} Z`} fill={tc} />
            {heads[i].map((ln, j) => <text key={j} x={x + 14} y={M + 31 + j * 19} fontSize="15" fontWeight="700">{ln}</text>)}
            {ov && <text x={x + 14} y={M + 31 + heads[i].length * 19} fontSize="12" fontWeight="700" style={{ fill: danger }}>Limite de WIP excedido</text>}
            <rect x={x + COLW - 14 - bw} y={M + 17} width={bw} height="20" rx="10" fill={ov ? danger : 'var(--dg-bg)'} stroke={ov ? danger : 'var(--dg-line)'} />
            <text x={x + COLW - 14 - bw / 2} y={M + 31} fontSize="12" fontWeight="700" textAnchor="middle" className={ov ? undefined : 'dg-muted'} style={ov ? { fill: '#fff' } : undefined}>{badge}</text>
            <line x1={x + 10} y1={M + HEAD} x2={x + COLW - 10} y2={M + HEAD} stroke="var(--dg-line)" />
            {colData[i].placed.map(({ k, L, y }) => <Card key={k.id} card={k} x={x + CPAD} y={y} w={cw} L={L} />)}
            {!n && (
              <g>
                <rect x={x + CPAD} y={M + HEAD + CPAD} width={cw} height="48" rx="8" fill="none" stroke="var(--dg-line)" strokeDasharray="5 4" />
                <text x={x + COLW / 2} y={M + HEAD + CPAD + 29} fontSize="12" fontStyle="italic" textAnchor="middle" className="dg-muted">Sem cartões</text>
              </g>
            )}
          </g>
        )
      })}
    </DiagramSvg>
  )
}
