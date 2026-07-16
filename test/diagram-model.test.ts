// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Tests for the diagram model helpers that back the editable LiveDiagramEditor:
// building React-Flow nodes/edges from the diagram JSON and serializing them
// back. Serialization starts from the ORIGINAL authoring object (data.__src),
// so a load→serialize round-trip is FAITHFUL — it preserves fields the editor
// doesn't surface (i18n label maps, full config, tone, shape, custom attrs) and
// only overlays what the canvas can change (membership, wiring).
import { describe, it, expect } from 'vitest';
import {
  buildServiceNode, buildBaseEdge, serializeDiagram, membershipFromNodes,
} from '../packages/diagram-core/src/diagramModel.js';

// A diagram exercising: i18n label map, full multi-field config, tone, a group,
// and membership via parentId.
const DIAGRAM = {
  title: 'T', direction: 'LR',
  services: [
    { id: 'ec2', service: 'EC2', label: { en: 'Web Server', pt: 'Servidor' },
      icon: 'Res_Amazon-EC2_Instance_48.png', category: 'compute', parentId: 'vpc',
      role: 'app host', tone: 'accent', config: { instanceType: 't3.medium', label: 'x' } },
    { id: 'rds', service: 'RDS', icon: 'Res_Amazon-RDS_48.png', category: 'database', parentId: 'vpc' },
    { id: 'cf', service: 'CloudFront', category: 'networking' },
  ],
  connections: [
    { id: 'e1', source: 'cf', target: 'ec2', label: 'HTTPS', type: 'network' },
    { id: 'e2', source: 'ec2', target: 'rds', dashed: true },
  ],
  groups: [{ id: 'vpc', label: 'VPC', variant: 'vpc' }],
};

// Reconstruct editable RF nodes/edges the way EditorCanvas does after load:
// service nodes carry parentId (membership) + data.__src; groups from groups[].
function toNodes(d: any) {
  const svc = d.services.map((s: any) => {
    const n: any = buildServiceNode(s, { lang: 'en' });
    if (s.parentId) { n.parentId = s.parentId; n.extent = 'parent'; }
    return n;
  });
  const grp = (d.groups || []).map((g: any) => ({
    id: g.id, type: 'group', position: { x: 0, y: 0 }, data: { ...g, __src: g },
  }));
  return [...grp, ...svc];
}
function toEdges(d: any) {
  return d.connections.map((c: any) => buildBaseEdge(c, { lang: 'en' }));
}

describe('serializeDiagram — faithful round-trip via __src', () => {
  it('preserves the semantic service, i18n label map, tone, and FULL config', () => {
    const out = serializeDiagram(toNodes(DIAGRAM), toEdges(DIAGRAM), { title: 'T', direction: 'LR' });
    const ec2 = out.services.find((s: any) => s.id === 'ec2');
    expect(ec2.service).toBe('EC2');                                // semantic type kept
    expect(ec2.label).toEqual({ en: 'Web Server', pt: 'Servidor' }); // i18n map intact
    expect(ec2.tone).toBe('accent');
    expect(ec2.config).toEqual({ instanceType: 't3.medium', label: 'x' }); // all config fields
    expect(ec2.parentId).toBe('vpc');                               // membership kept
  });

  it('round-trips connections and groups unchanged', () => {
    const out = serializeDiagram(toNodes(DIAGRAM), toEdges(DIAGRAM));
    expect(out.connections).toEqual(DIAGRAM.connections);
    expect(out.groups).toEqual(DIAGRAM.groups);
  });

  it('is idempotent across two round-trips', () => {
    const once = serializeDiagram(toNodes(DIAGRAM), toEdges(DIAGRAM), { title: 'T', direction: 'LR' });
    // Rebuild from `once` and serialize again — must equal `once`.
    const twice = serializeDiagram(toNodes(once), toEdges(once), { title: 'T', direction: 'LR' });
    expect(twice).toEqual(once);
  });

  it('omits the groups key when there are no group nodes', () => {
    const d = { services: [{ id: 'a', service: 'A' }], connections: [] };
    expect('groups' in serializeDiagram(toNodes(d), toEdges(d))).toBe(false);
  });
});

describe('serializeDiagram — edits reflect in the JSON', () => {
  it('adding a connection yields a new connections entry', () => {
    const edges = [...toEdges(DIAGRAM), { id: 'e3', source: 'cf', target: 'rds', type: 'custom', data: {} }];
    const out = serializeDiagram(toNodes(DIAGRAM), edges);
    expect(out.connections.find((c: any) => c.id === 'e3')).toEqual({ id: 'e3', source: 'cf', target: 'rds' });
  });

  it('deleting a node drops it (host removes incident edges)', () => {
    const nodes = toNodes(DIAGRAM).filter((n: any) => n.id !== 'rds');
    const edges = toEdges(DIAGRAM).filter((e: any) => e.source !== 'rds' && e.target !== 'rds');
    const out = serializeDiagram(nodes, edges);
    expect(out.services.map((s: any) => s.id)).not.toContain('rds');
    expect(out.connections.map((c: any) => c.id)).toEqual(['e1']);
  });

  it('moving a node out of its group clears parentId', () => {
    const nodes = toNodes(DIAGRAM).map((n: any) => n.id === 'ec2' ? { ...n, parentId: undefined, extent: undefined } : n);
    const out = serializeDiagram(nodes, toEdges(DIAGRAM));
    expect('parentId' in out.services.find((s: any) => s.id === 'ec2')).toBe(false);
  });

  it('rewiring an edge updates source/target but keeps other fields', () => {
    const edges = toEdges(DIAGRAM).map((e: any) => e.id === 'e1' ? { ...e, target: 'rds' } : e);
    const out = serializeDiagram(toNodes(DIAGRAM), edges);
    const e1 = out.connections.find((c: any) => c.id === 'e1');
    expect(e1).toEqual({ id: 'e1', source: 'cf', target: 'rds', label: 'HTTPS', type: 'network' });
  });
});

describe('membershipFromNodes', () => {
  it('maps service id → group id from live parentIds', () => {
    expect(membershipFromNodes(toNodes(DIAGRAM))).toEqual({ ec2: 'vpc', rds: 'vpc' });
  });
});

describe('added nodes (no __src) synthesize a minimal entry', () => {
  it('a palette-added service serializes with service/icon/category', () => {
    const added = buildServiceNode({ id: 'n1', service: 'Amazon S3', icon: 'Arch_Amazon-Simple-Storage-Service_48.png', category: 'Storage' }, { lang: 'en' });
    const out = serializeDiagram([added], []);
    expect(out.services[0]).toMatchObject({ id: 'n1', service: 'Amazon S3', icon: 'Arch_Amazon-Simple-Storage-Service_48.png', category: 'Storage' });
  });
});
