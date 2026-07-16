// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Covers the SERVER-side .drawio generator (lib/drawio-xml.js) used by the
// auto_generate_diagram / generate_diagram MCP tools — distinct from the
// browser exporter tested in drawio.test.ts.
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain JS module, no types
import { generateDrawio, GROUP_STYLES } from '../lib/drawio-xml.js';
// @ts-expect-error — plain JS module, no types
import { computeLayout } from '../lib/layout.js';

const services = [
  { id: 'api', service: 'Amazon API Gateway', shape: 'api_gateway', category: 'networking', x: 200, y: 200 },
  { id: 'fn', service: 'AWS Lambda', shape: 'lambda', category: 'compute', x: 200, y: 400 },
];

describe('generateDrawio (server-side .drawio)', () => {
  it('produces a well-formed mxfile envelope', () => {
    const xml = generateDrawio('T', 's', services, [], [], {});
    expect(xml).toContain('<mxfile');
    expect(xml).toContain('mxGraphModel');
  });

  it('exposes all 12 shared group variants (not just the legacy 5)', () => {
    // The shared GROUP_VARIANTS table drives this now, so account/on-premises/etc. exist.
    for (const v of ['aws-cloud', 'region', 'vpc', 'public-subnet', 'private-subnet',
      'availability-zone', 'account', 'organization', 'auto-scaling-group', 'group',
      'corporate-data-center', 'on-premises']) {
      expect(GROUP_STYLES[v]).toBeTruthy();
    }
  });

  it('renders a non-legacy variant (account) with its official aws4 group icon', () => {
    const groups = [{ id: 'g', type: 'account', label: 'Prod', x: 100, y: 100, w: 800, h: 600 }];
    const xml = generateDrawio('T', 's', services, [], groups, {});
    expect(xml).toContain('grIcon=mxgraph.aws4.group_account');
    // must NOT silently fall back to the aws-cloud group icon
    expect(xml).not.toContain('group_aws_cloud;'); // account has its own icon
  });

  it('resolves variant aliases (az -> availability-zone)', () => {
    const groups = [{ id: 'g', type: 'az', label: 'AZ-a', x: 0, y: 0, w: 100, h: 100 }];
    const xml = generateDrawio('T', 's', services, [], groups, {});
    expect(xml).toContain('group_availability_zone');
  });

  it('styles typed connections distinctly (network/iam/event/data)', () => {
    const conns = [
      { id: 'e1', source: 'api', target: 'fn', type: 'iam' },
      { id: 'e2', source: 'api', target: 'fn', type: 'data' },
    ];
    const xml = generateDrawio('T', 's', services, conns, [], {});
    expect(xml).toContain('#DD344C');       // iam red
    expect(xml).toContain('dashPattern=6 4'); // iam dashed
    expect(xml).toContain('#3F8624');       // data green
  });

  it('leaves untyped connections on the neutral grey line', () => {
    const conns = [{ id: 'e1', source: 'api', target: 'fn' }];
    const xml = generateDrawio('T', 's', services, conns, [], {});
    expect(xml).toContain('strokeColor=#545B64');
  });

  it('places the Data Flow legend to the RIGHT of all content (no overlap)', () => {
    // A wide layout: two service boxes far to the right. The legend must start
    // past the rightmost content edge, not at the old fixed x=1780.
    const wide = [
      { id: 'a', service: 'A', shape: 'lambda', category: 'compute', x: 100, y: 200 },
      { id: 'b', service: 'B', shape: 'dynamodb', category: 'database', x: 3000, y: 200 },
    ];
    const steps = [{ number: 1, badgeX: 200, badgeY: 260, description: 'flow' }];
    const xml = generateDrawio('T', 's', wide, [{ id: 'e1', source: 'a', target: 'b', label: 'flow' }], [], { steps });
    // pull the legend-bg x coordinate out of the XML
    const m = xml.match(/id="legend-bg"[\s\S]*?<mxGeometry x="(\d+)"/);
    expect(m).toBeTruthy();
    const legendX = Number(m![1]);
    // rightmost content edge is b.x (3000) + node width (180) = 3180
    expect(legendX).toBeGreaterThan(3180);
  });
});

describe('computeLayout (shared ELK compound engine)', () => {
  const svc = [
    { id: 'api', service: 'API GW', shape: 'api_gateway', category: 'networking', subnet: 'public' },
    { id: 'fn', service: 'Lambda', shape: 'lambda', category: 'compute', subnet: 'private' },
    { id: 'db', service: 'DynamoDB', shape: 'dynamodb', category: 'database', subnet: 'private' },
  ];
  const conns = [{ id: 'e1', source: 'api', target: 'fn' }, { id: 'e2', source: 'fn', target: 'db' }];

  it('derives the classic AWS Cloud → VPC → subnet tree from `subnet` (back-compat)', async () => {
    const l = await computeLayout({ services: svc, connections: conns });
    const types = l.groups.map((g: any) => g.type);
    expect(types).toContain('aws-cloud');
    expect(types).toContain('vpc');
    expect(types).toContain('public-subnet');
    expect(types).toContain('private-subnet');
    expect(l.services.every((s: any) => Number.isFinite(s.x) && Number.isFinite(s.y))).toBe(true);
  });

  it('honours arbitrary explicit group nesting (org → account → vpc → az)', async () => {
    const groups = [
      { id: 'org', label: 'Org', variant: 'organization' },
      { id: 'acct', label: 'Acct', parent: 'org', variant: 'account' },
      { id: 'vpc', label: 'VPC', parent: 'acct', variant: 'vpc' },
      { id: 'az', label: 'AZ-a', parent: 'vpc', variant: 'availability-zone' },
    ];
    const services = [
      { id: 'fn', service: 'Lambda', shape: 'lambda', category: 'compute', parentId: 'az' },
      { id: 'db', service: 'DynamoDB', shape: 'dynamodb', category: 'database', parentId: 'az' },
    ];
    const l = await computeLayout({ services, connections: [{ id: 'e1', source: 'fn', target: 'db' }], groups });
    const by: any = Object.fromEntries(l.groups.map((g: any) => [g.id, g]));
    expect(l.groups).toHaveLength(4);
    // each child rectangle sits inside its parent's rectangle
    const inside = (c: any, p: any) => c.x >= p.x - 2 && c.y >= p.y - 2 && c.x + c.w <= p.x + p.w + 2 && c.y + c.h <= p.y + p.h + 2;
    expect(inside(by.acct, by.org)).toBe(true);
    expect(inside(by.vpc, by.acct)).toBe(true);
    expect(inside(by.az, by.vpc)).toBe(true);
  });
});
