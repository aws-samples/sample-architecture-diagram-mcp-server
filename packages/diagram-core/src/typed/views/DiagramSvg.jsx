// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── DiagramSvg ───
// The accessible SVG frame every typed diagram renders into (the
// accessibility contract): role="img", <title> + <desc> wired through
// aria-labelledby, ids namespaced per instance (several diagrams on one page
// never collide), and the shared light/dark design tokens (.dgt CSS vars) so
// every type reads as one system. Views draw in viewBox units; the frame
// scales to its container ('width' = natural height, 'contain' = fit box).
//
// Tokens (use them instead of hex in views):
//   --dg-bg --dg-panel --dg-ink --dg-muted --dg-line --dg-grid
//   --dg-accent (AWS orange) and tone colors via toneColor(tone)
// Theme: follows the nearest .dark / .light ancestor (a .light wrapper forces
// light inside a dark page — exports, side-by-side previews).
import { useId } from 'react'

// Semantic tones = the core's diagram palette (the same hues the MCP's flow and
// sequence players draw with).
export { DIAGRAM_TONES as TONE_HEX } from '../../tones.js'
// A tone name (or a raw #hex) → color; falls back to `fallback`.
export { diagramToneColor as toneColor } from '../../tones.js'
// Categorical palette for series/lanes/columns (index → color).
export const PALETTE = ['#2f6fed', '#ff9900', '#1a7f37', '#8c4fff', '#11a5c3', '#dd344c', '#b7791f', '#5f6b7a']
export const paletteColor = (i) => PALETTE[i % PALETTE.length]

const CSS = `
.dgt{--dg-bg:#ffffff;--dg-panel:#f6f8fa;--dg-ink:#16191f;--dg-muted:#5f6b7a;--dg-line:#c8d1db;--dg-grid:#e7ecf1;--dg-accent:#ff9900;
  font-family:'Amazon Ember',system-ui,sans-serif;color:var(--dg-ink)}
.dark .dgt,.dgt.dgt-dark{--dg-bg:#0f141b;--dg-panel:#161b22;--dg-ink:#e6edf3;--dg-muted:#8b97a6;--dg-line:#3a4552;--dg-grid:#232b35}
.light .dgt,.dark .light .dgt,.dgt.dgt-light{--dg-bg:#ffffff;--dg-panel:#f6f8fa;--dg-ink:#16191f;--dg-muted:#5f6b7a;--dg-line:#c8d1db;--dg-grid:#e7ecf1}
.dgt text{fill:var(--dg-ink)}
.dgt .dg-muted{fill:var(--dg-muted)}
.dgt .dg-step{transition:opacity .35s ease}
@media (prefers-reduced-motion:reduce){.dgt *{transition:none!important;animation:none!important}}
`

// Instance-unique id helper for <defs> (markers, gradients, clipPaths).
export function useSvgIds() {
  const base = useId().replace(/[:]/g, '')
  return (name) => `${base}-${name}`
}

export function DiagramSvg({ width, height, title, desc, fit = 'width', className = '', style, children }) {
  const id = useSvgIds()
  return (
    <svg className={`dgt ${className}`} viewBox={`0 0 ${width} ${height}`} width="100%"
      height={fit === 'contain' ? '100%' : undefined} preserveAspectRatio="xMidYMin meet"
      role="img" aria-labelledby={`${id('t')} ${id('d')}`} style={style}>
      <title id={id('t')}>{title || 'Diagrama'}</title>
      <desc id={id('d')}>{desc || ''}</desc>
      <style>{CSS}</style>
      {children}
    </svg>
  )
}

// Rough text width in px for layout (no DOM measuring — deterministic).
export const textW = (s, size = 12) => String(s || '').length * size * 0.56

// Wrap text into lines that fit `maxW` px at `size`.
export function wrapText(s, maxW, size = 12) {
  const words = String(s || '').split(/\s+/).filter(Boolean)
  const lines = []; let line = ''
  for (const w of words) {
    const t = line ? `${line} ${w}` : w
    if (textW(t, size) > maxW && line) { lines.push(line); line = w } else line = t
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

export default DiagramSvg
