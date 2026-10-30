// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── View: venn (2 or 3 sets) ───
// Classic overlapping circles with translucent fills (fill-opacity, so it
// reads on light and dark). Region anchors are computed deterministically by
// sampling a grid: centroid of each exact-membership area + the horizontal
// room available there (used to wrap the region text).
// Reveal: sets one by one (circle + exclusive area), then intersections.
import { DiagramSvg, toneColor, paletteColor, wrapText, textW } from './DiagramSvg.jsx'
import { describeTypedDiagram } from '../index.js'

const FS = 13, LH = 16, LABEL_FS = 17, PAD = 28

function geometry(n) {
  if (n === 2) {
    const r = 240, d = 0.6 * r
    return { r, centers: [[-d, 0], [d, 0]] }
  }
  const r = 200, s = 1.12 * r, R = s / Math.sqrt(3)
  const ang = [-150, -30, 90].map(a => (a * Math.PI) / 180)
  return { r, centers: ang.map(a => [R * Math.cos(a), R * Math.sin(a)]) }
}

const maskAt = (centers, r, x, y) => centers.reduce((m, [cx, cy], i) => ((x - cx) ** 2 + (y - cy) ** 2 <= r * r ? m | (1 << i) : m), 0)

// centroid per exact mask (grid sampling)
function regionCentroids(centers, r) {
  const acc = {}, st = 5
  const xs = centers.map(c => c[0]), ys = centers.map(c => c[1])
  for (let x = Math.min(...xs) - r; x <= Math.max(...xs) + r; x += st) {
    for (let y = Math.min(...ys) - r; y <= Math.max(...ys) + r; y += st) {
      const m = maskAt(centers, r, x, y)
      if (!m) continue
      const a = acc[m] || (acc[m] = { x: 0, y: 0, n: 0 })
      a.x += x; a.y += y; a.n++
    }
  }
  return Object.fromEntries(Object.entries(acc).map(([m, a]) => [m, { x: a.x / a.n, y: a.y / a.n }]))
}

// horizontal room inside mask m along row y around x (symmetric, so text can be centred)
function roomAt(centers, r, m, x, y) {
  if (maskAt(centers, r, x, y) !== m) return 0
  let l = 0, rr = 0
  while (l < 600 && maskAt(centers, r, x - l - 2, y) === m) l += 2
  while (rr < 600 && maskAt(centers, r, x + rr + 2, y) === m) rr += 2
  return 2 * Math.min(l, rr)
}

export default function VennView({ doc, step = null, fit }) {
  const sets = (doc.sets || []).slice(0, 3)
  const n = Math.max(2, sets.length)
  const { r, centers } = geometry(n)
  const idx = Object.fromEntries(sets.map((s, i) => [s.id, i]))
  const color = (i) => toneColor(sets[i]?.tone, paletteColor(i))
  const cents = regionCentroids(centers, r)

  // merge regions by exact mask
  const byMask = new Map()
  for (const reg of doc.regions || []) {
    const m = [...new Set(reg.sets || [])].reduce((a, id) => (idx[id] != null ? a | (1 << idx[id]) : a), 0)
    if (!m) continue
    const cur = byMask.get(m) || { m, labels: [], items: [] }
    if (reg.label) cur.labels.push(reg.label)
    cur.items.push(...(reg.items || []))
    byMask.set(m, cur)
  }
  const bits = (m) => [0, 1, 2].filter(i => m & (1 << i)).length
  // reveal order: sets first, then intersections (pairs before triple, doc order)
  const inters = [...byMask.values()].filter(g => bits(g.m) > 1).sort((a, b) => bits(a.m) - bits(b.m))
  const order = (g) => (bits(g.m) === 1 ? Math.log2(g.m) : sets.length + inters.indexOf(g))
  const shown = (o) => step == null || o < step

  // layout text blocks per region
  const blocks = [...byMask.values()].map(g => {
    const c = cents[g.m] || { x: 0, y: 0 }
    const build = (w) => {
      const rows = []
      g.labels.forEach(l => wrapText(l, w, FS + 1).forEach(t => rows.push({ t, b: true })))
      g.items.forEach((it, k) => wrapText(it, w, FS).forEach((t, j) => rows.push({ t, b: false, gap: k > 0 && j === 0 })))
      return rows
    }
    let w = Math.max(60, roomAt(centers, r, g.m, c.x, c.y) - 10)
    let rows = build(w)
    for (let k = 0; k < 3; k++) {
      const h = rows.length * LH
      const w2 = Math.max(60, Math.min(roomAt(centers, r, g.m, c.x, c.y - h / 2 + 4), roomAt(centers, r, g.m, c.x, c.y + h / 2 - 4), w + 10) - 10)
      if (w2 >= w - 1) break
      w = w2; rows = build(w)
    }
    return { g, c, rows, o: order(g) }
  })

  // set labels outside the circles
  const labels = sets.map((s, i) => {
    const [cx, cy] = centers[i]
    if (n === 2) {
      const lines = wrapText(s.label, r * 1.05, LABEL_FS)
      const x = cx + (i ? 0.28 : -0.28) * r
      return { lines, x, y: cy - r - 16 - (lines.length - 1) * 21, anchor: 'middle' }
    }
    const lines = wrapText(s.label, 230, LABEL_FS)
    if (i === 2) return { lines, x: cx, y: cy + r + 30, anchor: 'middle' }
    const dir = i === 0 ? -1 : 1
    return { lines, x: cx + dir * r * 0.62, y: cy - r * 0.86 - 10 - (lines.length - 1) * 21, anchor: i === 0 ? 'end' : 'start' }
  })

  // bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  const grow = (x0, y0, x1, y1) => { minX = Math.min(minX, x0); minY = Math.min(minY, y0); maxX = Math.max(maxX, x1); maxY = Math.max(maxY, y1) }
  centers.forEach(([cx, cy]) => grow(cx - r, cy - r, cx + r, cy + r))
  labels.forEach(l => {
    const w = Math.max(...l.lines.map(t => textW(t, LABEL_FS)))
    const x0 = l.anchor === 'end' ? l.x - w : l.anchor === 'start' ? l.x : l.x - w / 2
    grow(x0, l.y - LABEL_FS, x0 + w, l.y + (l.lines.length - 1) * 21 + 6)
  })
  const ox = PAD - minX, oy = PAD - minY
  const W = maxX - minX + 2 * PAD, H = maxY - minY + 2 * PAD

  return (
    <DiagramSvg width={W} height={H} title={doc.title || 'Diagrama de Venn'} desc={describeTypedDiagram(doc)} fit={fit}>
      <g transform={`translate(${ox},${oy})`}>
        {sets.map((s, i) => (
          <g key={s.id} className="dg-step" style={{ opacity: shown(i) ? 1 : 0 }}>
            <circle cx={centers[i][0]} cy={centers[i][1]} r={r} fill={color(i)} fillOpacity="0.17" />
          </g>
        ))}
        {sets.map((s, i) => (
          <g key={s.id} className="dg-step" style={{ opacity: shown(i) ? 1 : 0 }}>
            <circle cx={centers[i][0]} cy={centers[i][1]} r={r} fill="none" stroke={color(i)} strokeWidth="2.5" />
            {labels[i].lines.map((t, j) => (
              <text key={j} x={labels[i].x} y={labels[i].y + j * 21} fontSize={LABEL_FS} fontWeight="700" textAnchor={labels[i].anchor} style={{ fill: color(i) }}>{t}</text>
            ))}
          </g>
        ))}
        {blocks.map(({ g, c, rows, o }) => {
          const y0 = c.y - (rows.length * LH) / 2 + LH * 0.75
          return (
            <g key={g.m} className="dg-step" style={{ opacity: shown(o) ? 1 : 0 }}>
              {rows.map((row, j) => (
                <text key={j} x={c.x} y={y0 + j * LH} fontSize={row.b ? FS + 1 : FS} fontWeight={row.b ? 700 : 400} textAnchor="middle">{row.t}</text>
              ))}
            </g>
          )
        })}
      </g>
    </DiagramSvg>
  )
}
