// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Theme contrast tokens (dock-txt, dock-muted, accent, accent-txt) and the WCAG
// AA check in validate_layout.
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain JS module, no types
import { contrastRatio, parseColor, themeContrast } from '../lib/contrast.js';
// @ts-expect-error — plain JS module, no types
import { validateLayout, themeCss } from '../lib/layouts.js';

describe('contrast', () => {
  it('computes WCAG ratios (black/white 21, #777 on white ≈ 4.48)', () => {
    expect(contrastRatio('#000', '#fff')).toBe(21);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
    expect(parseColor('rgba(0, 0, 0, 0.5)')).toEqual([0, 0, 0, 0.5]);
    expect(contrastRatio('red', '#fff')).toBeNull();
  });
  it('only pairs the theme touches, both modes', () => {
    const r = themeContrast({ light: { 'dock-txt': '#bbbbbb' }, dark: {} });
    expect(r.map((x: any) => `${x.mode}:${x.fg}/${x.bg}`)).toEqual(['light:dock-txt/dock-bg']);
    expect(r[0].ok).toBe(false);
  });
  it('validate_layout reports low-contrast pairs as warnings (not errors)', () => {
    const bad = validateLayout({ extends: 'default', theme: { light: { txt: '#cccccc', bg: '#ffffff' } } });
    expect(bad.ok).toBe(true);
    expect(bad.warnings.join(' ')).toMatch(/txt #cccccc on bg #ffffff = 1\.6\d?:1/);
    const good = validateLayout({ extends: 'default', theme: { light: { txt: '#111111' }, dark: { 'accent-txt': '#111111', accent: '#ffb84d' } } });
    expect(good.warnings).toBeUndefined();
  });
  it('dock tokens scope --txt inside the dock and color the cost button', () => {
    const css = themeCss({ light: { 'dock-txt': '#111', accent: '#0073bb', 'accent-txt': '#fff' }, dark: {} });
    expect(css).toContain('.ld-frame.light .ld-dock-host > div{--txt:#111}');
    expect(css).toMatch(/\[data-ld-cost="dock"\][^{]*\{background:#0073bb !important;border-color:#0073bb !important;color:#fff !important\}/);
    expect(css).not.toContain('--dock-txt');
  });
});
