// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// The core build keeps its pure vocabulary ONCE, in dist/index.js: the react and
// layout-engine entries import it from there (see tsup.config.js). Guard that
// every name they import is actually exported, and that the MCP's HTML players
// receive the shared layout + palette with no placeholder left behind.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as core from '@aws-sample-live-diagram/core';
import { generateFlowHtml } from '../lib/flow-generator.js';
import { generateSequenceHtml } from '../lib/sequence-generator.js';

const DIST = join(__dirname, '../packages/diagram-core/dist');

function importsFrom(file: string, spec: string): string[] {
  const src = readFileSync(join(DIST, file), 'utf-8');
  const names: string[] = [];
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*"${spec.replace(/[.]/g, '\\.')}"`, 'g');
  for (const m of src.matchAll(re)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0];
      if (name) names.push(name);
    }
  }
  return names;
}

describe('core entries share one copy of the pure vocabulary', () => {
  for (const entry of ['react.js', 'layout-engine.js']) {
    it(`${entry} imports only names dist/index.js exports`, () => {
      const names = importsFrom(entry, './index.js');
      expect(names.length).toBeGreaterThan(0);
      const missing = names.filter(n => !(n in core));
      expect(missing).toEqual([]);
    });
  }

  it('emits no hashed shared chunks', () => {
    const files = readFileSync(join(DIST, 'react.js'), 'utf-8').match(/from\s*"\.\/chunk-[^"]+"/g);
    expect(files).toBeNull();
  });
});

describe('HTML players take layout + palette from the core', () => {
  const flow = { type: 'workflow', title: 'T', nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], edges: [{ id: 'e', from: 'a', to: 'b', label: '[ok]' }] };
  it('flow HTML has no placeholder left and carries the shared palette', () => {
    const html = generateFlowHtml(flow as any);
    expect(html).not.toMatch(/__FLOW_LAYOUT__|__TONES__|__THEME_CSS__/);
    expect(html).toContain('function layoutFlow(');
    expect(html).toContain(`--info:${core.PLAYER_TONES.info}`);
  });
  it('sequence HTML has no placeholder left and carries the shared palette', () => {
    const html = generateSequenceHtml({ title: 'S', participants: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], events: [{ kind: 'message', id: 'm', from: 'a', to: 'b', label: 'hi' }] } as any);
    expect(html).not.toMatch(/__TONES__|__THEME_CSS__/);
    expect(html).toContain(`--danger:${core.PLAYER_TONES.danger}`);
  });
  it('the flow layout is the core one (same geometry in both renderers)', () => {
    const L = core.layoutFlow(flow, {});
    expect(L.W).toBeGreaterThan(0);
    expect(L.edges[0].label).toMatchObject({ w: expect.any(Number) });
  });
});
