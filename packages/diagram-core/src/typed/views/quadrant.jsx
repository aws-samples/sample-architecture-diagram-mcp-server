// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── View: quadrant ───
// Reference view for the typed-diagram contract. Props (all views):
//   doc        the diagram document (spec in src/lib/diagramTypes/quadrant.js)
//   step       reveal step: items with index < step are shown; null = all
//   fit        'width' | 'contain'
import { DiagramSvg, toneColor, wrapText } from './DiagramSvg.jsx'
import { describeTypedDiagram } from '../index.js'

const W = 960, H = 720, M = { l: 110, r: 40, t: 40, b: 90 }

export default function QuadrantView({ doc, step = null, fit }) {
  const pw = W - M.l - M.r, ph = H - M.t - M.b
  const X = (v) => M.l + (Math.max(0, Math.min(100, v)) / 100) * pw
  const Y = (v) => M.t + (1 - Math.max(0, Math.min(100, v)) / 100) * ph
  const q = doc.quadrants || []
  const items = doc.items || []
  const qpos = [[M.l + 14, M.t + 26], [M.l + pw / 2 + 14, M.t + 26], [M.l + 14, M.t + ph / 2 + 26], [M.l + pw / 2 + 14, M.t + ph / 2 + 26]]
  return (
    <DiagramSvg width={W} height={H} title={doc.title || 'Quadrante'} desc={describeTypedDiagram(doc)} fit={fit}>
      <rect x={M.l} y={M.t} width={pw} height={ph} rx="10" fill="var(--dg-panel)" stroke="var(--dg-line)" />
      <line x1={M.l + pw / 2} y1={M.t} x2={M.l + pw / 2} y2={M.t + ph} stroke="var(--dg-line)" strokeDasharray="4 4" />
      <line x1={M.l} y1={M.t + ph / 2} x2={M.l + pw} y2={M.t + ph / 2} stroke="var(--dg-line)" strokeDasharray="4 4" />
      {q.slice(0, 4).map((label, i) => (
        <text key={i} x={qpos[i][0]} y={qpos[i][1]} fontSize="15" fontWeight="700" className="dg-muted" opacity="0.8">{label}</text>
      ))}
      {/* axes */}
      <text x={M.l} y={H - M.b + 28} fontSize="13" className="dg-muted">{doc.xAxis?.low}</text>
      <text x={M.l + pw} y={H - M.b + 28} fontSize="13" textAnchor="end" className="dg-muted">{doc.xAxis?.high}</text>
      {doc.xAxis?.label && <text x={M.l + pw / 2} y={H - M.b + 56} fontSize="15" fontWeight="700" textAnchor="middle">{doc.xAxis.label} →</text>}
      <text x={M.l - 14} y={M.t + ph} fontSize="13" textAnchor="end" className="dg-muted">{doc.yAxis?.low}</text>
      <text x={M.l - 14} y={M.t + 12} fontSize="13" textAnchor="end" className="dg-muted">{doc.yAxis?.high}</text>
      {doc.yAxis?.label && <text transform={`translate(${M.l - 70},${M.t + ph / 2}) rotate(-90)`} fontSize="15" fontWeight="700" textAnchor="middle">{doc.yAxis.label} →</text>}
      {items.map((it, i) => {
        const shown = step == null || i < step
        const c = toneColor(it.tone)
        const cx = X(it.x), cy = Y(it.y)
        const lines = wrapText(it.label, 150, 13)
        const right = cx < M.l + pw - 170
        return (
          <g key={it.id || i} className="dg-step" style={{ opacity: shown ? 1 : 0 }}>
            <circle cx={cx} cy={cy} r="9" fill={c} stroke="var(--dg-bg)" strokeWidth="2.5" />
            {lines.map((ln, j) => (
              <text key={j} x={right ? cx + 15 : cx - 15} y={cy + 4 + (j - (lines.length - 1) / 2) * 15} fontSize="13" fontWeight="600" textAnchor={right ? 'start' : 'end'}>{ln}</text>
            ))}
          </g>
        )
      })}
    </DiagramSvg>
  )
}
