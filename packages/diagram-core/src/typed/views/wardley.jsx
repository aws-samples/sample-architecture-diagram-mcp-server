// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── View: wardley ───
// Plot: Y = visibility (top = visible to the user), X = evolution with the
// four stage bands. Components as circles (market = ringed circle, anchor =
// bold text), value-chain links as lines, evolveTo as a dashed red arrow to a
// ghost circle. Labels are placed greedily (right, left, above, below,
// diagonals) avoiding nodes, annotations and already placed labels.
import { DiagramSvg, toneColor, textW, wrapText, useSvgIds } from './DiagramSvg.jsx'
import { describeTypedDiagram } from '../index.js'

const W = 1120, H = 780, M = { l: 86, r: 30, t: 30, b: 84 }
const STAGES = [0, 0.17, 0.4, 0.7, 1]
const STAGE_LABELS = ['Gênese', 'Sob medida', 'Produto (+aluguel)', 'Commodity (+utilidade)']
const R = 7, FS = 13, NFS = 11
const clamp = (v) => Math.max(0, Math.min(1, Number(v) || 0))
const halo = { paintOrder: 'stroke', stroke: 'var(--dg-bg)', strokeWidth: 4, strokeLinejoin: 'round' }

const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
// Does segment (x1,y1)-(x2,y2) cross rect b? (sampled — deterministic and cheap)
const segHit = (b, [x1, y1, x2, y2]) => {
  for (let t = 0; t <= 1; t += 0.04) {
    const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t
    if (x > b.x - 2 && x < b.x + b.w + 2 && y > b.y - 2 && y < b.y + b.h + 2) return true
  }
  return false
}

export default function WardleyView({ doc, step = null, fit }) {
  const id = useSvgIds()
  const pw = W - M.l - M.r, ph = H - M.t - M.b
  const X = (v) => M.l + clamp(v) * pw
  const Y = (v) => M.t + (1 - clamp(v)) * ph
  const comps = doc.components || []
  const idx = Object.fromEntries(comps.map((c, i) => [c.id, i]))
  const shown = (i) => step == null || i < step
  const allShown = step == null || step >= comps.length
  const red = toneColor('danger')

  // ── obstacles: nodes, ghosts, annotations ──
  const pts = comps.map(c => ({ x: X(c.evolution), y: Y(c.visibility) }))
  const obstacles = []
  comps.forEach((c, i) => {
    if (c.type === 'anchor') return
    obstacles.push({ x: pts[i].x - R - 3, y: pts[i].y - R - 3, w: 2 * R + 6, h: 2 * R + 6 })
    if (c.evolveTo != null) obstacles.push({ x: X(c.evolveTo) - R - 3, y: pts[i].y - R - 3, w: 2 * R + 6, h: 2 * R + 6 })
  })
  const anns = (doc.annotations || []).map(a => {
    const lines = wrapText(a.label, 190, 12)
    const w = Math.max(...lines.map(l => textW(l, 12))) + 20, h = lines.length * 15 + 12
    let x = X(a.x), y = Y(a.y)
    x = Math.min(Math.max(x, M.l + 4), M.l + pw - w - 4); y = Math.min(Math.max(y, M.t + 4), M.t + ph - h - 4)
    const box = { x, y, w, h, lines }
    obstacles.push(box)
    return box
  })
  const ends = (i) => (comps[i].type === 'anchor' ? { ...pts[i], r: 11 } : { ...pts[i], r: R + 1 })
  const trim = (a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1
    return [a.x + (dx / L) * a.r, a.y + (dy / L) * a.r, b.x - (dx / L) * b.r, b.y - (dy / L) * b.r]
  }
  const segs = (doc.links || []).filter(l => idx[l.from] != null && idx[l.to] != null).map(l => trim(ends(idx[l.from]), ends(idx[l.to])))
  const evoSegs = comps.filter(c => c.evolveTo != null).map(c => [X(c.evolution), Y(c.visibility), X(c.evolveTo), Y(c.visibility)])
  // ── labels ──
  const placed = []
  const labels = comps.map((c, i) => {
    const { x: cx, y: cy } = pts[i]
    const anchor = c.type === 'anchor'
    const fs = anchor ? 15 : FS
    const lw = textW(c.label, fs) * (anchor ? 1.08 : 1.02)
    const notes = c.note ? wrapText(c.note, Math.max(lw, 150), NFS) : []
    const w = Math.max(lw, ...notes.map(n => textW(n, NFS)))
    const h = fs + 4 + notes.length * 13
    if (anchor) {
      const box = { x: cx - w / 2, y: cy - h / 2 - 2, w, h, anchor: 'middle', tx: cx, ty: cy + 5 }
      placed.push(box); return { ...box, notes, fs }
    }
    const d = R + 7
    const cands = [
      { x: cx + d, y: cy - fs / 2 - 2, a: 'start' },
      { x: cx - d - w, y: cy - fs / 2 - 2, a: 'end' },
      { x: cx - w / 2, y: cy - d - h, a: 'middle' },
      { x: cx - w / 2, y: cy + d - 2, a: 'middle' },
      { x: cx + d - 4, y: cy - d - h + 4, a: 'start' },
      { x: cx + d - 4, y: cy + d - 4, a: 'start' },
      { x: cx - d - w + 4, y: cy - d - h + 4, a: 'end' },
      { x: cx - d - w + 4, y: cy + d - 4, a: 'end' },
    ]
    const inside = (b) => b.x >= M.l + 2 && b.x + b.w <= M.l + pw - 2 && b.y >= M.t + 2 && b.y + b.h <= M.t + ph - 2
    const others = obstacles.filter(o => !(Math.abs(o.x + o.w / 2 - cx) < 1 && Math.abs(o.y + o.h / 2 - cy) < 1))
    let best = null, bestCost = Infinity
    cands.forEach((cd, k) => {
      const b = { x: cd.x, y: cd.y, w, h }
      const cost = (inside(b) ? 0 : 1000) + 50 * (others.filter(o => hit(b, o)).length + placed.filter(o => hit(b, o)).length)
        + 6 * segs.filter(sg => segHit(b, sg)).length + 40 * evoSegs.filter(sg => segHit(b, sg)).length + k * 0.5
      if (cost < bestCost) { bestCost = cost; best = { ...b, a: cd.a } }
    })
    placed.push(best)
    const tx = best.a === 'start' ? best.x : best.a === 'end' ? best.x + w : best.x + w / 2
    return { ...best, anchor: best.a, tx, ty: best.y + fs - 1, notes, fs }
  })


  return (
    <DiagramSvg width={W} height={H} title={doc.title || 'Mapa de Wardley'} desc={describeTypedDiagram(doc)} fit={fit}>
      <defs>
        <marker id={id('evo')} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill={red} />
        </marker>
        <marker id={id('ax')} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--dg-muted)" />
        </marker>
      </defs>
      {/* stage bands */}
      {STAGE_LABELS.map((s, k) => (
        <g key={s}>
          {k % 2 === 1 && <rect x={X(STAGES[k])} y={M.t} width={X(STAGES[k + 1]) - X(STAGES[k])} height={ph} fill="var(--dg-panel)" />}
          {k > 0 && <line x1={X(STAGES[k])} y1={M.t} x2={X(STAGES[k])} y2={M.t + ph} stroke="var(--dg-line)" strokeDasharray="5 5" strokeWidth="1.2" />}
          <text x={(X(STAGES[k]) + X(STAGES[k + 1])) / 2} y={M.t + ph + 26} fontSize="13" fontWeight="700" textAnchor="middle" className="dg-muted">{s}</text>
        </g>
      ))}
      {/* axes */}
      <line x1={M.l} y1={M.t + ph} x2={M.l} y2={M.t - 4} stroke="var(--dg-muted)" strokeWidth="1.6" markerEnd={`url(#${id('ax')})`} />
      <line x1={M.l} y1={M.t + ph} x2={M.l + pw + 4} y2={M.t + ph} stroke="var(--dg-muted)" strokeWidth="1.6" markerEnd={`url(#${id('ax')})`} />
      <text transform={`translate(${M.l - 46},${M.t + ph / 2}) rotate(-90)`} fontSize="15" fontWeight="700" textAnchor="middle">Visibilidade</text>
      <text transform={`translate(${M.l - 20},${M.t + 8}) rotate(-90)`} fontSize="12" textAnchor="end" className="dg-muted">Visível</text>
      <text transform={`translate(${M.l - 20},${M.t + ph}) rotate(-90)`} fontSize="12" textAnchor="start" className="dg-muted">Invisível</text>
      <text x={M.l + pw / 2} y={M.t + ph + 58} fontSize="15" fontWeight="700" textAnchor="middle">Evolução →</text>
      {/* annotations */}
      {anns.map((a, i) => (
        <g key={`a${i}`} className="dg-step" style={{ opacity: allShown ? 1 : 0 }}>
          <rect x={a.x} y={a.y} width={a.w} height={a.h} rx="6" fill="var(--dg-bg)" stroke="var(--dg-muted)" strokeDasharray="3 3" strokeWidth="1.2" />
          {a.lines.map((ln, j) => <text key={j} x={a.x + 10} y={a.y + 19 + j * 15} fontSize="12" fontStyle="italic" className="dg-muted">{ln}</text>)}
        </g>
      ))}
      {/* links */}
      {(doc.links || []).map((l, i) => {
        const a = idx[l.from], b = idx[l.to]
        if (a == null || b == null) return null
        const [x1, y1, x2, y2] = trim(ends(a), ends(b))
        return <line key={`l${i}`} className="dg-step" style={{ opacity: shown(a) && shown(b) ? 1 : 0 }} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--dg-muted)" strokeWidth="1.4" />
      })}
      {/* evolution arrows */}
      {comps.map((c, i) => c.evolveTo == null ? null : (
        <g key={`e${i}`} className="dg-step" style={{ opacity: shown(i) ? 1 : 0 }}>
          <line x1={pts[i].x + (c.evolveTo >= c.evolution ? R + 3 : -R - 3)} y1={pts[i].y} x2={X(c.evolveTo) + (c.evolveTo >= c.evolution ? -R - 4 : R + 4)} y2={pts[i].y}
            stroke={red} strokeWidth="1.8" strokeDasharray="6 4" markerEnd={`url(#${id('evo')})`} />
          <circle cx={X(c.evolveTo)} cy={pts[i].y} r={R} fill="none" stroke={red} strokeWidth="1.6" strokeDasharray="3 2" />
        </g>
      ))}
      {/* components */}
      {comps.map((c, i) => {
        const { x: cx, y: cy } = pts[i]
        const lb = labels[i]
        return (
          <g key={c.id || i} className="dg-step" style={{ opacity: shown(i) ? 1 : 0 }}>
            {c.type === 'market' && <circle cx={cx} cy={cy} r={R + 5} fill="var(--dg-bg)" stroke="var(--dg-ink)" strokeWidth="1.4" />}
            {c.type !== 'anchor' && <circle cx={cx} cy={cy} r={R} fill="var(--dg-bg)" stroke="var(--dg-ink)" strokeWidth="2" />}
            {c.type === 'market' && <circle cx={cx} cy={cy} r="2.6" fill="var(--dg-ink)" />}
            <text x={lb.tx} y={lb.ty} fontSize={lb.fs} fontWeight={c.type === 'anchor' ? 800 : 600} textAnchor={lb.anchor} style={halo}>{c.label}</text>
            {lb.notes.map((n, j) => (
              <text key={j} x={lb.tx} y={lb.ty + 14 + j * 13} fontSize={NFS} fontStyle="italic" textAnchor={lb.anchor} className="dg-muted" style={halo}>{n}</text>
            ))}
          </g>
        )
      })}
    </DiagramSvg>
  )
}
