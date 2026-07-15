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

  it('does NOT emit adr / wellArchitected (their UI panels were removed — rationale lives in steps now)', () => {
    const d = archDataOf(generateHtml('T', '', services, connections, { adr: [{ title: 'X' }], wellArchitected: { security: 'x' } }));
    expect(d.adr).toBeUndefined();
    expect(d.wellArchitected).toBeUndefined();
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

  it('falls back to the AWS4 shape when the display name is not in the service catalog', () => {
    // "On-prem client"/"Local Gateway" are free text absent from SERVICE_ICONS,
    // but their shapes (users/endpoint) must still resolve to a real icon so the
    // node renders an image instead of a fallback initial.
    const svc = [
      { id: 'client', service: 'On-prem client', shape: 'users', category: 'general' },
      { id: 'lgw', service: 'Local Gateway', shape: 'endpoint', category: 'networking' },
    ];
    const html = generateHtml('T', '', svc, [], {});
    const d = archDataOf(html);
    expect(d.services.find((s: any) => s.id === 'client').icon).toBe('Res_Users_48_Light.png');
    expect(d.services.find((s: any) => s.id === 'lgw').icon).toBe('Res_Amazon-VPC_Endpoints_48.png');
    // and both are inlined as data-URIs
    const map = JSON.parse(html.match(/id="icon-data"[^>]*>([\s\S]*?)<\/script>/)![1]);
    expect(map['Res_Users_48_Light.png']).toMatch(/^data:image\//);
    expect(map['Res_Amazon-VPC_Endpoints_48.png']).toMatch(/^data:image\//);
  });

  it('prefers an explicit display-name match over the shape fallback', () => {
    // Amazon S3 resolves by name even if a mismatched shape is provided.
    const svc = [{ id: 's3', service: 'Amazon S3', shape: 'ec2', category: 'storage' }];
    const d = archDataOf(generateHtml('T', '', svc, [], {}));
    expect(d.services[0].icon).toMatch(/Simple-Storage-Service/);
  });

  it('inlines guided-walkthrough step and chip icons so the overlay card renders offline', () => {
    const steps = [{
      tone: 'survive', nodes: ['fn'], title: 'Runs locally',
      icon: 'Arch_Amazon-Elastic-Kubernetes-Service_48.png',
      chips: [
        { label: 'EBS', ok: true, icon: 'Arch_Amazon-Elastic-Block-Store_48.png' },
        { label: 'S3', ok: true, icon: 'Arch_Amazon-Simple-Storage-Service_48.png' },
      ],
    }];
    const html = generateHtml('T', '', services, connections, { steps });
    const map = JSON.parse(html.match(/id="icon-data"[^>]*>([\s\S]*?)<\/script>/)![1]);
    for (const ref of [
      'Arch_Amazon-Elastic-Kubernetes-Service_48.png',
      'Arch_Amazon-Elastic-Block-Store_48.png',
      'Arch_Amazon-Simple-Storage-Service_48.png',
    ]) {
      expect(map[ref], `step/chip icon ${ref} not inlined`).toMatch(/^data:image\//);
    }
  });

  it('threads lang/languages into the arch data (opt-in multi-language)', () => {
    const d = archDataOf(generateHtml('T', '', services, connections, { lang: 'pt', languages: ['en', 'pt'] }));
    expect(d.lang).toBe('pt');
    expect(d.languages).toEqual(['en', 'pt']);
  });

  it('omits lang/languages when not provided (single-language default)', () => {
    const d = archDataOf(generateHtml('T', '', services, connections, {}));
    expect(d.lang).toBeUndefined();
    expect(d.languages).toBeUndefined();
  });

  it('preserves per-language content maps verbatim for the client to resolve', () => {
    const svc = [{ id: 'a', service: { en: 'User', pt: 'Usuário' }, shape: 'users', category: 'general' }];
    const d = archDataOf(generateHtml({ en: 'Title', pt: 'Título' } as any, '', svc, [], { lang: 'en', languages: ['en', 'pt'] }));
    expect(d.title).toEqual({ en: 'Title', pt: 'Título' });
    expect(d.services[0].service).toEqual({ en: 'User', pt: 'Usuário' });
  });
});
