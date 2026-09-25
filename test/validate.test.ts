// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain JS module, no types
import { validateDiagram, formatValidationReport, RULES } from '../lib/validate.js';

const svc = (id: string, extra: any = {}) => ({ id, service: 'AWS Lambda', shape: 'lambda', category: 'compute', ...extra });

describe('validateDiagram', () => {
  it('passes a clean IR with no findings', () => {
    const { report } = validateDiagram({
      services: [svc('a'), svc('b')],
      connections: [{ id: 'e1', source: 'a', target: 'b' }],
    });
    expect(report.ok).toBe(true);
    expect(report.findings).toHaveLength(0);
    expect(report.receipts).toHaveLength(0);
    expect(formatValidationReport(report)).toContain('no issues');
  });

  it('flags and drops a dangling connection endpoint', () => {
    const { report, repaired } = validateDiagram({
      services: [svc('a')],
      connections: [{ id: 'e1', source: 'a', target: 'ghost' }],
    });
    const f = report.findings.find((x: any) => x.code === 'DANGLING_ENDPOINT');
    expect(f).toBeTruthy();
    expect(f.severity).toBe('error');
    expect(repaired.connections).toHaveLength(0);
    expect(report.receipts.some((r: any) => r.code === 'DANGLING_ENDPOINT')).toBe(true);
  });

  it('treats implicit "users" as a valid endpoint', () => {
    const { report } = validateDiagram({
      services: [svc('a')],
      connections: [{ id: 'e1', source: 'users', target: 'a' }],
    });
    expect(report.findings.some((f: any) => f.code === 'DANGLING_ENDPOINT')).toBe(false);
  });

  it('renames duplicate connection ids to keep React keys unique', () => {
    const { report, repaired } = validateDiagram({
      services: [svc('a'), svc('b'), svc('c')],
      connections: [
        { id: 'e', source: 'a', target: 'b' },
        { id: 'e', source: 'b', target: 'c' },
      ],
    });
    expect(report.findings.some((f: any) => f.code === 'DUP_CONNECTION_ID')).toBe(true);
    const ids = repaired.connections.map((c: any) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('e-2');
  });

  it('reports duplicate service ids but does not auto-fix them', () => {
    const { report, repaired } = validateDiagram({
      services: [svc('a'), svc('a')],
      connections: [],
    });
    const f = report.findings.find((x: any) => x.code === 'DUP_SERVICE_ID');
    expect(f).toBeTruthy();
    expect(report.ok).toBe(false);
    expect(repaired.services).toHaveLength(2); // untouched
    expect(report.receipts.some((r: any) => r.code === 'DUP_SERVICE_ID')).toBe(false);
  });

  it('flags orphan nodes', () => {
    const { report } = validateDiagram({
      services: [svc('a'), svc('b'), svc('lonely')],
      connections: [{ id: 'e1', source: 'a', target: 'b' }],
    });
    const orphans = report.findings.filter((f: any) => f.code === 'ORPHAN_NODE');
    expect(orphans.map((o: any) => o.ids[0])).toEqual(['lonely']);
  });

  it('clears a service parentId that points at no group', () => {
    const { report, repaired } = validateDiagram({
      services: [svc('a', { parentId: 'ghost' })],
      connections: [],
      groups: [],
    });
    expect(report.findings.some((f: any) => f.code === 'BAD_PARENT')).toBe(true);
    expect(repaired.services[0].parentId).toBeUndefined();
  });

  it('breaks a group parent cycle', () => {
    const { report, repaired } = validateDiagram({
      services: [],
      connections: [],
      groups: [{ id: 'g1', label: 'A', parent: 'g2' }, { id: 'g2', label: 'B', parent: 'g1' }],
    });
    expect(report.findings.some((f: any) => f.code === 'GROUP_CYCLE')).toBe(true);
    // At least one of the two lost its parent so no cycle remains.
    const parents = repaired.groups.map((g: any) => g.parent).filter(Boolean);
    expect(parents.length).toBeLessThan(2);
  });

  it('drops missing step refs and flags an unreachable beat', () => {
    const { report, repaired } = validateDiagram({
      services: [svc('a')],
      connections: [{ id: 'e1', source: 'a', target: 'users' }],
      steps: [
        { title: 'ok', nodes: ['a', 'nope'], edges: ['e1'] },
        { title: 'noop', nodes: ['gone'] },
      ],
    });
    expect(report.findings.some((f: any) => f.code === 'STEP_BAD_REF')).toBe(true);
    expect(report.findings.some((f: any) => f.code === 'UNREACHABLE_STEP')).toBe(true);
    expect(repaired.steps[0].nodes).toEqual(['a']);
    expect(repaired.steps[1].nodes).toEqual([]);
  });

  it('exposes stable rule codes', () => {
    expect(Object.keys(RULES)).toContain('DANGLING_ENDPOINT');
    expect(RULES.DANGLING_ENDPOINT.severity).toBe('error');
    expect(RULES.ORPHAN_NODE.severity).toBe('warning');
  });

  it('report=false path still lists findings without receipts', () => {
    const { report, repaired } = validateDiagram(
      { services: [svc('a')], connections: [{ id: 'e1', source: 'a', target: 'ghost' }] },
      { repair: false },
    );
    expect(report.findings.some((f: any) => f.code === 'DANGLING_ENDPOINT')).toBe(true);
    expect(report.receipts).toHaveLength(0);
    expect(repaired.connections).toHaveLength(1); // not repaired
  });
});
