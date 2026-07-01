// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { resolveIcon, iconFilter } from '@/lib/icons';

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

  it('returns null for empty input', () => {
    expect(resolveIcon(undefined)).toBeNull();
    expect(resolveIcon('')).toBeNull();
  });

  it('applies the recolor filter only to monochrome aws-icons SVGs', () => {
    expect(iconFilter('aws-icons/networking.svg')).toBe('var(--icon-filter, none)');
    expect(iconFilter('Arch_AWS-Lambda_48.png')).toBe('none');
  });
});
