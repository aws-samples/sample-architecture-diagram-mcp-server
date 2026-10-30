// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The card bullets ("Lead — detail") and caption stats ("Label: value") used to
// be split by backtracking regexes that went quadratic on long runs of spaces
// (CodeQL js/polynomial-redos). The scans that replaced them must split exactly
// what the regexes split, and stay fast on the inputs that used to stall.
import { describe, it, expect } from 'vitest';
import * as React from 'react';
// @ts-expect-error — plain JS module, no types
import { splitLead, mdInline } from '../packages/diagram-core/src/components/cardKit.jsx';
// @ts-expect-error — plain JS module, no types
import { splitStat } from '../packages/diagram-core/src/components/DiagramCaption.jsx';

// cardKit.jsx is compiled with the classic JSX runtime (bare `React`).
(globalThis as any).React = React;

const OLD_LEAD = /^(.{2,40}?)\s*[—:]\s+(.+)$/;
const OLD_STAT = /^\s*([^:]{2,22}):\s+(.+)$/;

const oldLead = (t: string) => { const m = OLD_LEAD.exec(t); return m ? { strong: m[1], text: m[2] } : null; };
const oldStat = (s: string) => { const m = OLD_STAT.exec(s); return m ? { label: m[1], value: m[2] } : { label: null, value: s }; };

// Deterministic pseudo-random strings over the characters that matter here.
function* samples(n: number) {
  const alphabet = ['a', 'b', ' ', ' ', ':', '—', '\t', '\n', 'x', 'Z', '.'];
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < n; i++) {
    const len = 1 + Math.floor(rnd() * 60);
    let s = '';
    for (let j = 0; j < len; j++) s += alphabet[Math.floor(rnd() * alphabet.length)];
    yield s;
  }
}

describe('splitLead', () => {
  it('splits the documented shapes', () => {
    expect(splitLead('Amazon S3 — stores the raw files')).toEqual({ strong: 'Amazon S3', text: 'stores the raw files' });
    expect(splitLead('Latency: 16ms')).toEqual({ strong: 'Latency', text: '16ms' });
    expect(splitLead('no separator here')).toBeNull();
    expect(splitLead('ratio 3:1 is fine')).toBeNull();
  });

  it('matches the old regex on every sample', () => {
    for (const s of samples(20000)) expect(splitLead(s), JSON.stringify(s)).toEqual(oldLead(s));
  });

  it('stays linear on long runs of spaces', () => {
    const t0 = performance.now();
    splitLead('ab' + ' '.repeat(50_000) + 'x');
    expect(performance.now() - t0).toBeLessThan(200);
  });
});

describe('splitStat', () => {
  it('splits the documented shapes', () => {
    expect(splitStat('Ambiente: produção')).toEqual({ label: 'Ambiente', value: 'produção' });
    expect(splitStat('sa-east-1')).toEqual({ label: null, value: 'sa-east-1' });
  });

  it('matches the old regex on every sample', () => {
    for (const s of samples(20000)) expect(splitStat(s), JSON.stringify(s)).toEqual(oldStat(s));
  });

  it('stays linear on long runs of spaces', () => {
    const t0 = performance.now();
    splitStat(' '.repeat(50_000) + 'x');
    expect(performance.now() - t0).toBeLessThan(200);
  });
});

describe('mdInline links', () => {
  it('still renders an http(s) link and leaves brackets alone', () => {
    const out = mdInline('see [docs](https://docs.aws.amazon.com/s3/) now');
    expect(out[1].props.href).toBe('https://docs.aws.amazon.com/s3/');
    expect(mdInline('[a][b] plain')).toEqual(['[a][b] plain']);
  });

  it('stays linear on nested brackets and unterminated links', () => {
    const t0 = performance.now();
    mdInline('['.repeat(20_000) + '\\');
    mdInline('[\\](http://' + '[!](http://'.repeat(5_000));
    expect(performance.now() - t0).toBeLessThan(200);
  });
});
