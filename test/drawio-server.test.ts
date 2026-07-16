// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Covers the SERVER-side .drawio generator (lib/drawio-xml.js) used by the
// auto_generate_diagram / generate_diagram MCP tools — distinct from the
// browser exporter tested in drawio.test.ts.
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain JS module, no types
import { generateDrawio, GROUP_STYLES } from '../lib/drawio-xml.js';

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
});
