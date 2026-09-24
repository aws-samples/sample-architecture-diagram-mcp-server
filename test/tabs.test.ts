// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Multi-tab document: the tab rail payload, the animated UML sequence view, and
// the icon inlining those views depend on (a participant icon that is NOT in the
// map renders as a bare initial under file://).
import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
// @ts-expect-error — plain JS module, no types
import { generateHtml, resolveTabs } from '../lib/html-generator.js';
// @ts-expect-error — plain JS module, no types
import { htmlDiagramInputSchema, sequenceSchema, tabSchema } from '../lib/schemas.js';

function archDataOf(html: string): any {
  const m = html.match(/id="arch-data"[^>]*>([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : {};
}
function iconDataOf(html: string): Record<string, string> {
  const m = html.match(/id="icon-data"[^>]*>([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : {};
}

const __dir = dirname(fileURLToPath(import.meta.url));
const TECH_ICON = join(__dir, '..', 'assets', 'tech-icons', 'vault.svg');
const TECH_ICONS_PRESENT = existsSync(TECH_ICON);

const services = [
  { id: 'api', service: 'Amazon API Gateway', shape: 'api_gateway', category: 'networking' },
  { id: 'fn', service: 'AWS Lambda', shape: 'lambda', category: 'compute' },
];
const connections = [{ id: 'e1', source: 'api', target: 'fn', type: 'event' }];

// The sequence shape is the published player's own contract
// (lib/sequence-schemas.js): a discriminated event list (message | note) with
// fragments anchored by event id, not inline begin/else/end markers.
const sequence = {
  title: 'Request flow',
  participants: [
    { id: 'u', label: 'Client', actor: true },
    { id: 'api', label: 'API Gateway', service: 'Amazon API Gateway' },
    { id: 'fn', label: 'Lambda', service: 'AWS Lambda' },
    { id: 'va', label: 'Vault', icon: 'tech-icons/vault.svg', stereotype: 'on-prem' },
  ],
  events: [
    { kind: 'message', id: 'm1', from: 'u', to: 'api', label: 'POST /orders' },
    { kind: 'message', id: 'm2', from: 'api', to: 'fn', label: 'invoke', arrow: 'async' },
    { kind: 'message', id: 'm3', from: 'fn', to: 'va', label: 'read secret', badge: 'gate', tone: 'warn' },
    { kind: 'message', id: 'm4', from: 'api', to: 'u', label: '401', arrow: 'reply', tone: 'danger' },
    { kind: 'note', id: 'n1', over: ['fn', 'va'], label: 'keyless (IRSA)', badge: 'keyless' },
  ],
  fragments: [
    { kind: 'alt', label: 'token válido', startId: 'm2', endId: 'm4', dividers: [{ beforeId: 'm4', label: 'token inválido' }] },
  ],
  groups: [{ label: 'AWS', participants: ['api', 'fn'], tone: 'info' }],
};

describe('resolveTabs', () => {
  it('is undefined for a classic single-view diagram', () => {
    expect(resolveTabs({})).toBeUndefined();
  });

  it('builds the two-tab Architecture + Sequence rail from a bare `sequence`', () => {
    const tabs = resolveTabs({ sequence });
    expect(tabs.map((t: any) => t.kind)).toEqual(['architecture', 'sequence']);
    expect(tabs[0].label.pt).toBe('Arquitetura');
    expect(tabs[1].sequence.events).toHaveLength(sequence.events.length);
  });

  it('resolves a participant icon from its `service` and keeps an explicit one', () => {
    const [, seqTab] = resolveTabs({ sequence });
    const byId = Object.fromEntries(seqTab.sequence.participants.map((p: any) => [p.id, p]));
    expect(byId.api.icon).toMatch(/API-Gateway/i);
    expect(byId.va.icon).toBe('tech-icons/vault.svg');
    expect(byId.u.icon).toBeUndefined(); // an actor with no service stays glyph-only
  });

  it('keeps an explicit `tabs` array authoritative and defaults missing labels', () => {
    const tabs = resolveTabs({
      tabs: [
        { id: 'a', kind: 'architecture' },
        { id: 'd', kind: 'doc', label: 'Notas', sections: [{ title: 'X', body: 'y' }] },
      ],
      sequence, // ignored when `tabs` is given
    });
    expect(tabs).toHaveLength(2);
    expect(tabs[0].label.en).toBe('Architecture');
    expect(tabs[1].label).toBe('Notas');
  });
});

describe('generateHtml — tabs payload', () => {
  it('omits `tabs` entirely for a single-view diagram (no behaviour change)', () => {
    const d = archDataOf(generateHtml('t', '', services, connections, {}));
    expect(d.tabs).toBeUndefined();
  });

  it('embeds the tab rail and the sequence model', () => {
    const d = archDataOf(generateHtml('t', '', services, connections, { sequence }));
    expect(d.tabs).toHaveLength(2);
    const seq = d.tabs[1].sequence;
    expect(seq.participants).toHaveLength(4);
    expect(seq.fragments).toHaveLength(1);
    expect(seq.fragments[0]).toMatchObject({ kind: 'alt', startId: 'm2', endId: 'm4' });
    expect(seq.events.at(-1).kind).toBe('note');
  });

  it.skipIf(!TECH_ICONS_PRESENT)('inlines participant icons as data-URIs', () => {
    const html = generateHtml('t', '', services, connections, { sequence });
    const icons = iconDataOf(html);
    expect(icons['tech-icons/vault.svg']).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('inlines a tab-button icon too', () => {
    const tabs = [
      { id: 'a', kind: 'architecture', icon: 'tech-icons/vault.svg' },
      { id: 's', kind: 'sequence', sequence },
    ];
    const icons = iconDataOf(generateHtml('t', '', services, connections, { tabs }));
    if (TECH_ICONS_PRESENT) expect(icons['tech-icons/vault.svg']).toBeTruthy();
    else expect(icons['tech-icons/vault.svg']).toBeUndefined();
  });
});

describe('schemas', () => {
  it('accepts the sequence + tabs input on the public schema', () => {
    const parsed = htmlDiagramInputSchema.parse({
      title: 't', services, connections, sequence,
      tabs: [{ id: 'a', kind: 'architecture' }, { id: 's', kind: 'sequence', label: { en: 'Flow', pt: 'Fluxo' }, sequence }],
    });
    expect(parsed.sequence.participants).toHaveLength(4);
    expect(parsed.tabs).toHaveLength(2);
  });

  it('rejects an unknown tab kind and an unknown event kind', () => {
    expect(() => tabSchema.parse({ id: 'x', kind: 'gantt', label: 'x' })).toThrow();
    expect(() => sequenceSchema.parse({ participants: [], events: [{ kind: 'loopy' }] })).toThrow();
  });
});
