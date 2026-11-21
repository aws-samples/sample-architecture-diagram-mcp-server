// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// @aws-sample-live-diagram/core may only GROW: every export and every prop the
// release before layouts published must still be there (fixture captured from
// 6f6e023 with `node test/golden/core-api.mjs <root> <out>`). Hosts such as a
// slides app import these names directly.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
// @ts-expect-error — plain JS module, no types
import { coreApi } from './golden/core-api.mjs';

interface Entry { exports: string[]; props: Record<string, string[]> }
const base: Record<string, Entry> = JSON.parse(readFileSync(join(__dirname, 'golden', 'fixtures', 'core-api.json'), 'utf-8'));
const now: Record<string, Entry> = coreApi(resolve(__dirname, '..'));

describe('core public API is backward compatible', () => {
  for (const [entry, b] of Object.entries(base)) {
    it(`${entry}: no export removed`, () => {
      expect(b.exports.filter(n => !now[entry].exports.includes(n))).toEqual([]);
    });
    it(`${entry}: no prop removed from a component/function`, () => {
      const missing: string[] = [];
      for (const [fn, props] of Object.entries(b.props)) {
        const cur = now[entry].props[fn];
        if (!cur) { missing.push(`${fn} (gone)`); continue; }
        for (const p of props) if (!cur.includes(p)) missing.push(`${fn}.${p}`);
      }
      expect(missing).toEqual([]);
    });
  }
  it('the package version is a minor bump at most from the base', () => {
    const v = JSON.parse(readFileSync(join(__dirname, '..', 'packages', 'diagram-core', 'package.json'), 'utf-8')).version;
    expect(v.split('.')[0]).toBe('1');
  });
});
