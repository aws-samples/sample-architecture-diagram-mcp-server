// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// resolveIcon only reads a global `window.__ICONS__` map — it never touches the
// DOM — so we run in the plain `node` environment and stub `window` in
// beforeEach. Avoids pulling jsdom (whose transitive html-encoding-sniffer is
// ESM-only and fails under `require()` on Node 18).
import { describe, it, expect, beforeEach } from 'vitest';
import { resolveIcon, iconFilter } from '@/lib/icons';
import { ui, makeUi } from '@/lib/i18n';

describe('resolveIcon (browser)', () => {
  beforeEach(() => { (globalThis as any).window = globalThis; delete (globalThis as any).__ICONS__; });

  it('returns the inlined base64 data-URI from window.__ICONS__ when present', () => {
    (globalThis as any).__ICONS__ = { 'Arch_AWS-Lambda_48.png': 'data:image/png;base64,AAA' };
    expect(resolveIcon('Arch_AWS-Lambda_48.png')).toBe('data:image/png;base64,AAA');
  });

  it('falls back to a served path when no inline map (bare → /icons/, prefixed → /<as-is>)', () => {
    expect(resolveIcon('Arch_Amazon-RDS_48.png')).toBe('/icons/Arch_Amazon-RDS_48.png');
    expect(resolveIcon('aws-icons/user.svg')).toBe('/aws-icons/user.svg');
  });

  it('returns null for a ref absent from an inline map (initials fallback, not a broken /icons/ path)', () => {
    // In standalone mode the map exists but a ref that could not be inlined must
    // resolve to null — a served "/icons/…" path would 404 and break PNG export.
    (globalThis as any).__ICONS__ = { 'Arch_AWS-Lambda_48.png': 'data:image/png;base64,AAA' };
    expect(resolveIcon('Res_User_48.png')).toBeNull();
    expect(resolveIcon('Arch_AWS-Lambda_48.png')).toBe('data:image/png;base64,AAA');
  });

  it('returns null for empty input', () => {
    expect(resolveIcon(undefined)).toBeNull();
    expect(resolveIcon('')).toBeNull();
  });

  it('applies the recolor filter only to monochrome aws-icons SVGs', () => {
    expect(iconFilter('aws-icons/user.svg')).toBe('var(--icon-filter, none)');
    expect(iconFilter('Arch_AWS-Lambda_48.png')).toBe('none');
  });
});

// The UI-chrome resolver is called with a plain string key by the sequence
// player (which carries its own English literals as fallbacks), so an unknown
// key must fall back — NOT throw on `UI[key][lang]`.
describe('ui / makeUi (chrome strings)', () => {
  it('resolves a known key per language with an English fallback', () => {
    expect(ui('play', 'pt')).toBe('Reproduzir apresentação');
    expect(ui('play', 'ja')).toBe('Play walkthrough');
  });

  it('carries the sequence-player keys', () => {
    expect(ui('next', 'pt')).toBe('Próximo passo');
    expect(ui('searchPlaceholder', 'es')).toBe('buscar participantes…');
  });

  it('returns "" for an unknown key instead of throwing', () => {
    expect(ui('doesNotExist' as any, 'pt')).toBe('');
    expect(makeUi()('doesNotExist' as any, 'pt')).toBe('');
  });

  it('layers author overrides over the built-ins', () => {
    expect(makeUi({ play: { ja: '再生' } })('play', 'ja')).toBe('再生');
  });
});
