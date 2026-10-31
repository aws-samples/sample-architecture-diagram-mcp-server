// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The core's document schemas (packages/diagram-core/src/schemas) are what
// every host validates a stored diagram with; the MCP's zod schemas are what
// its tools accept. These tests keep the two describing the same documents.
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
// @ts-expect-error — plain JS module, no types
import * as seqZ from '../lib/sequence-schemas.js';
// @ts-expect-error — plain JS module, no types
import * as archZ from '../lib/schemas.js';
// @ts-expect-error — plain JS module, no types
import { sequenceDocSchema, diagramSchema, validateSequence, validateDiagram } from '../packages/diagram-core/src/schemas/index.js';

const json = (s: unknown) => z.toJSONSchema(s as z.ZodType, { io: 'input', unrepresentable: 'any' }) as any;
const keys = (o: any) => Object.keys(o?.properties || {}).sort();
const enumOf = (p: any): string[] | undefined => p?.enum ?? p?.anyOf?.find((x: any) => x.enum)?.enum;
// JSON types a schema node accepts (anyOf/oneOf flattened).
const types = (p: any): string[] => {
  if (!p) return [];
  if (p.anyOf || p.oneOf) return [...new Set((p.anyOf || p.oneOf).flatMap(types))].sort() as string[];
  if (p.enum) return ['string'];
  if (p.const !== undefined) return [typeof p.const];
  return [p.type === 'integer' ? 'number' : p.type].filter(Boolean);
};
// Every field the core declares accepts at least what the MCP accepts.
// Fields a host may store that no MCP tool takes (a stored document's `kind`;
// `showLabel`, the opt-in label pill of hosts that hide labels by default).
const HOST_ONLY = new Set(['sequence.kind', 'diagram.kind', 'connections[].showLabel']);
function covers(core: any, mcp: any, at: string) {
  const out: string[] = [];
  for (const k of keys(core)) {
    if (HOST_ONLY.has(`${at}.${k}`)) continue;
    const c = core.properties[k], m = mcp.properties?.[k];
    if (!m) { out.push(`${at}.${k}: not in the MCP schema`); continue; }
    const ct = types(c), mt = types(m);
    if (ct.length && mt.length && !mt.every(t => ct.includes(t))) out.push(`${at}.${k}: core ${ct} < mcp ${mt}`);
    const ce = enumOf(c), me = enumOf(m);
    if (ce && me && me.some(v => !ce.includes(v))) out.push(`${at}.${k}: enum ${me} ⊄ ${ce}`);
  }
  return out;
}

describe('sequence: core schema ≡ MCP zod', () => {
  const m = json(seqZ.sequenceInputSchema), c = sequenceDocSchema;
  const [msg, note] = m.properties.events.items.oneOf ?? m.properties.events.items.anyOf;
  it('same fields at every level', () => {
    expect(keys(c).filter(k => k !== 'kind')).toEqual(keys(m));
    expect(keys(c.properties.participants.items)).toEqual(keys(m.properties.participants.items));
    expect(keys(c.properties.events.items)).toEqual([...new Set([...keys(msg), ...keys(note)])].sort());
    expect(keys(c.properties.fragments.items)).toEqual(keys(m.properties.fragments.items));
    expect(keys(c.properties.groups.items)).toEqual(keys(m.properties.groups.items));
  });
  it('the core accepts every type and enum value the MCP does', () => {
    expect([
      ...covers(c, m, 'sequence'),
      ...covers(c.properties.participants.items, m.properties.participants.items, 'participants[]'),
      ...covers(c.properties.events.items, { properties: { ...note.properties, ...msg.properties } }, 'events[]'),
      ...covers(c.properties.fragments.items, m.properties.fragments.items, 'fragments[]'),
      ...covers(c.properties.groups.items, m.properties.groups.items, 'groups[]'),
    ]).toEqual([]);
  });
  it('validates referential integrity', () => {
    const ok = { participants: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], events: [{ kind: 'message', id: 'm1', from: 'a', to: 'b' }] };
    expect(validateSequence(ok).valid).toBe(true);
    expect(validateSequence({ ...ok, events: [{ kind: 'message', id: 'm1', from: 'a', to: 'x' }] }).errors).toEqual(['events[0].to: no participant "x"']);
  });
});

describe('architecture: core schema covers the MCP zod', () => {
  const m = json(archZ.htmlDiagramInputSchema), c = diagramSchema;
  it('the core accepts every type and enum value the MCP does', () => {
    expect([
      ...covers(c, m, 'diagram'),
      ...covers(c.properties.services.items, m.properties.services.items, 'services[]'),
      ...covers(c.properties.connections.items, m.properties.connections.items, 'connections[]'),
      ...covers(c.properties.groups.items, m.properties.groups.items, 'groups[]'),
    ]).toEqual([]);
  });
  it('validates referential integrity and dispatches sequences', () => {
    expect(validateDiagram({ services: [{ id: 'a' }], connections: [{ source: 'a', target: 'b' }] }).errors).toEqual(['connections[0].target: no service "b"']);
    expect(validateDiagram({ kind: 'sequence', participants: [], events: [] }).valid).toBe(true);
  });
});
