// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { describe, it, expect } from 'vitest';
import { generateHtml } from '../lib/html-generator.js';

function archDataOf(html: string): any {
  const m = html.match(/id="arch-data"[^>]*>([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : {};
}

describe('generateHtml — arch data wiring', () => {
  const services = [
    { id: 'users', service: 'Users', category: 'general', external: true, icon: 'Res_Users_48_Light.png' },
    { id: 'api', service: 'Amazon API Gateway', category: 'networking', role: 'front door' },
    { id: 'fn', service: 'AWS Lambda', category: 'compute', subnet: 'private' },
  ];
  const connections = [
    { id: 'e1', source: 'users', target: 'api', type: 'network' },
    { id: 'e2', source: 'api', target: 'fn', type: 'event' },
  ];

  it('embeds title, subtitle and direction', () => {
    const d = archDataOf(generateHtml('My App', 'sub', services, connections, { direction: 'LR' }));
    expect(d.title).toBe('My App');
    expect(d.subtitle).toBe('sub');
    expect(d.direction).toBe('LR');
  });

  it('defaults direction to TB', () => {
    expect(archDataOf(generateHtml('T', '', services, connections, {})).direction).toBe('TB');
  });

  it('preserves role on services and type on connections', () => {
    const d = archDataOf(generateHtml('T', '', services, connections, {}));
    expect(d.services.find((s: any) => s.id === 'api').role).toBe('front door');
    expect(d.connections.find((c: any) => c.id === 'e2').type).toBe('event');
  });

  it('passes ADR and Well-Architected through to the data', () => {
    const adr = [{ title: 'X over Y', status: 'accepted', decision: 'use X' }];
    const wa = { security: 'least privilege IAM' };
    const d = archDataOf(generateHtml('T', '', services, connections, { adr, wellArchitected: wa }));
    expect(d.adr).toHaveLength(1);
    expect(d.adr[0].title).toBe('X over Y');
    expect(d.wellArchitected.security).toMatch(/least privilege/i);
  });

  it('defaults adr to [] and wellArchitected to null when omitted', () => {
    const d = archDataOf(generateHtml('T', '', services, connections, {}));
    expect(d.adr).toEqual([]);
    expect(d.wellArchitected).toBeNull();
  });

  it('always inlines all group/container icons (incl. account, ASG, data center)', () => {
    const m = generateHtml('T', '', services, connections, {}).match(/id="icon-data"[^>]*>([\s\S]*?)<\/script>/);
    const map = JSON.parse(m![1]);
    for (const g of ['AWS-Cloud_32.png', 'Virtual-private-cloud-VPC_32.png', 'Public-subnet_32.png', 'Private-subnet_32.png', 'Region_32.png', 'AWS-Account_32.png', 'Auto-Scaling-group_32.png', 'Corporate-data-center_32.png']) {
      expect(map[g], `group icon ${g} not inlined`).toMatch(/^data:image\//);
    }
  });

  it('passes explicit groups through to the data for arbitrary topologies', () => {
    const groups = [
      { id: 'vpcA', label: 'VPC A', variant: 'vpc' },
      { id: 'vpcB', label: 'VPC B', variant: 'vpc' },
    ];
    const d = archDataOf(generateHtml('T', '', services, connections, { groups }));
    expect(d.groups).toHaveLength(2);
    expect(d.groups.map((g: any) => g.id)).toEqual(['vpcA', 'vpcB']);
  });

  it('defaults groups to [] when omitted (implicit subnet derivation happens client-side)', () => {
    expect(archDataOf(generateHtml('T', '', services, connections, {})).groups).toEqual([]);
  });
});
