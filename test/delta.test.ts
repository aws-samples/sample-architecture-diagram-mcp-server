// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain JS module, no types
import { computeDelta, formatDeltaSummary } from '../lib/delta.js';

const svc = (id: string, extra: any = {}) => ({ id, service: 'AWS Lambda', shape: 'lambda', category: 'compute', ...extra });

describe('computeDelta', () => {
  it('classifies added / removed / changed / unchanged services by id', () => {
    const before = { services: [svc('a', { label: 'A' }), svc('b', { label: 'B' }), svc('c', { label: 'C' })], connections: [] };
    const after = { services: [svc('a', { label: 'A' }), svc('b', { label: 'B2' }), svc('d', { label: 'D' })], connections: [] };
    const d = computeDelta(before, after);
    const byId = Object.fromEntries(d.services.map((s: any) => [s.id, s]));
    expect(byId.a.delta).toBe('unchanged');
    expect(byId.b.delta).toBe('changed');
    expect(byId.b.deltaFields).toContain('label');
    expect(byId.c.delta).toBe('removed');
    expect(byId.d.delta).toBe('added');
  });

  it('keeps removed items in the merged IR (union) so layout stays stable', () => {
    const before = { services: [svc('a'), svc('gone')], connections: [] };
    const after = { services: [svc('a')], connections: [] };
    const d = computeDelta(before, after);
    expect(d.services.map((s: any) => s.id).sort()).toEqual(['a', 'gone']);
  });

  it('after-side order is preserved, removed appended last', () => {
    const before = { services: [svc('x'), svc('old')], connections: [] };
    const after = { services: [svc('b'), svc('a'), svc('x')], connections: [] };
    const d = computeDelta(before, after);
    expect(d.services.map((s: any) => s.id)).toEqual(['b', 'a', 'x', 'old']);
  });

  it('ignores cosmetic key reordering (stable compare)', () => {
    const before = { services: [{ id: 'a', service: 'S', shape: 'x', config: { a: 1, b: 2 } }], connections: [] };
    const after = { services: [{ id: 'a', shape: 'x', service: 'S', config: { b: 2, a: 1 } }], connections: [] };
    const d = computeDelta(before, after);
    expect(d.services[0].delta).toBe('unchanged');
  });

  it('diffs connections and groups too, with a correct summary total', () => {
    const before = {
      services: [svc('a'), svc('b')],
      connections: [{ id: 'e1', source: 'a', target: 'b' }],
      groups: [{ id: 'g1', label: 'VPC' }],
    };
    const after = {
      services: [svc('a'), svc('b'), svc('c')],
      connections: [{ id: 'e1', source: 'a', target: 'b', label: 'new' }, { id: 'e2', source: 'b', target: 'c' }],
      groups: [],
    };
    const d = computeDelta(before, after);
    expect(d.summary.services).toMatchObject({ added: 1, removed: 0, changed: 0, unchanged: 2 });
    expect(d.summary.connections).toMatchObject({ added: 1, removed: 0, changed: 1, unchanged: 0 });
    expect(d.summary.groups).toMatchObject({ added: 0, removed: 1, changed: 0, unchanged: 0 });
    expect(d.summary.total).toMatchObject({ added: 2, removed: 1, changed: 1, unchanged: 2 });
    expect(formatDeltaSummary(d.summary)).toMatch(/\+2 added, −1 removed, ~1 changed, 2 unchanged/);
  });

  it('handles empty / missing collections without throwing', () => {
    const d = computeDelta({}, {});
    expect(d.services).toEqual([]);
    expect(d.connections).toEqual([]);
    expect(d.groups).toEqual([]);
    expect(d.summary.total).toMatchObject({ added: 0, removed: 0, changed: 0, unchanged: 0 });
  });
});
