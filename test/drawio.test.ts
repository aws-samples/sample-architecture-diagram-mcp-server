import { describe, it, expect } from 'vitest';
import { generateDrawioXml } from '@/lib/drawioExport';

// Minimal positioned nodes as the client would pass (compoundLayout output shape).
const allNodes: any[] = [
  { id: 'vpc', type: 'group', position: { x: 0, y: 0 }, style: { width: 400, height: 300 }, data: { label: 'VPC', variant: 'vpc' } },
  { id: 'fn', type: 'aws', position: { x: 50, y: 60 }, data: {} },
  { id: 'db', type: 'aws', position: { x: 50, y: 200 }, data: {} },
];
const services = [
  { id: 'fn', service: 'AWS Lambda', category: 'compute', shape: 'lambda' },
  { id: 'db', service: 'Amazon RDS', category: 'database', shape: 'rds' },
];
const connections = [{ id: 'e1', source: 'fn', target: 'db', label: 'jdbc' }];

describe('generateDrawioXml', () => {
  const xml = generateDrawioXml(allNodes, services, connections, 'My App', 'sub');

  it('produces a well-formed mxfile envelope', () => {
    expect(xml.startsWith('<mxfile')).toBe(true);
    expect(xml).toContain('</mxfile>');
    expect(xml).toContain('<mxGraphModel');
  });

  it('renders each service with its AWS4 resource icon shape', () => {
    expect(xml).toContain('resIcon=mxgraph.aws4.lambda');
    expect(xml).toContain('resIcon=mxgraph.aws4.rds');
  });

  it('renders the group with the correct AWS4 group icon', () => {
    expect(xml).toContain('grIcon=mxgraph.aws4.group_vpc2');
  });

  it('emits an edge between the two services', () => {
    expect(xml).toContain('source="svc-fn"');
    expect(xml).toContain('target="svc-db"');
    expect((xml.match(/edge="1"/g) || []).length).toBe(1);
  });

  it('uses 2pt strokes on service containers (AWS guideline)', () => {
    expect(xml).toContain('strokeWidth=2;');
    expect(xml).not.toContain('strokeWidth=1.5;');
  });

  it('escapes XML-special characters in labels', () => {
    const x = generateDrawioXml([{ id: 'a', type: 'aws', position: { x: 0, y: 0 }, data: {} }],
      [{ id: 'a', service: 'A & B <test>', category: 'general', shape: 'lambda' }], [], 'T', '');
    expect(x).toContain('A &amp; B &lt;test&gt;');
  });

  it('derives a shape token from the service name when shape is absent', () => {
    const x = generateDrawioXml([{ id: 'a', type: 'aws', position: { x: 0, y: 0 }, data: {} }],
      [{ id: 'a', service: 'Amazon API Gateway', category: 'networking' }], [], 'T', '');
    expect(x).toContain('resIcon=mxgraph.aws4.api_gateway');
  });

  it('renders any group variant with its official aws4 group icon', () => {
    const nodes: any[] = [
      { id: 'acct', type: 'group', position: { x: 0, y: 0 }, style: { width: 600, height: 400 }, data: { label: 'Prod', variant: 'account' } },
      { id: 'asg', type: 'group', position: { x: 50, y: 50 }, style: { width: 300, height: 200 }, data: { label: 'ASG', variant: 'auto-scaling-group' } },
    ];
    const x = generateDrawioXml(nodes, [], [], 'T', '');
    expect(x).toContain('grIcon=mxgraph.aws4.group_account');
    expect(x).toContain('grIcon=mxgraph.aws4.group_auto_scaling_group');
  });
});
