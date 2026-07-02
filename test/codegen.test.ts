// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { describe, it, expect } from 'vitest';
import { generateIacHandoff, generatePricingPayload } from '@/lib/codegen';

const services = [
  { id: 'users', service: 'Users', category: 'general', external: true },
  { id: 'api', service: 'Amazon API Gateway', category: 'networking', role: 'REST front door' },
  { id: 'fn', service: 'AWS Lambda', category: 'compute', config: { iac: { runtime: 'nodejs22.x' } } },
  { id: 'db', service: 'Amazon DynamoDB', category: 'database', config: { iac: { billingMode: 'PAY_PER_REQUEST' }, pricing: { writeUnits: 100 } } },
];
const connections = [
  { id: 'e1', source: 'users', target: 'api', type: 'network', label: 'HTTPS' },
  { id: 'e2', source: 'api', target: 'fn', type: 'event', label: 'invoke' },
  { id: 'e3', source: 'fn', target: 'db', type: 'data', label: 'read/write' },
];

describe('generateIacHandoff', () => {
  const out = JSON.parse(generateIacHandoff(services, connections, 'My App', 'sa-east-1'));

  it('targets the official AWS IaC MCP, not its own generator', () => {
    expect(out.target.iac_mcp).toBe('awslabs.aws-iac-mcp-server');
    expect(out.instruction).toMatch(/Do NOT hand-write/i);
  });

  it('drops externals and users from provisionable resources', () => {
    const ids = out.architecture.resources.map((r: any) => r.id);
    expect(ids).toEqual(['api', 'fn', 'db']);
    expect(ids).not.toContain('users');
  });

  it('carries role and per-service iac config', () => {
    const api = out.architecture.resources.find((r: any) => r.id === 'api');
    expect(api.role).toBe('REST front door');
    const fn = out.architecture.resources.find((r: any) => r.id === 'fn');
    expect(fn.config.runtime).toBe('nodejs22.x');
  });

  it('keeps connection type + label as dependencies, excluding external edges', () => {
    const deps = out.architecture.dependencies;
    // e1 touches `users` (external) -> excluded; e2 and e3 kept
    expect(deps).toHaveLength(2);
    expect(deps[0]).toMatchObject({ from: 'api', to: 'fn', type: 'event', via: 'invoke' });
  });

  it('weaves ADR + Well-Architected rationale into the payload', () => {
    const adr = [{ title: 'DynamoDB over RDS', status: 'accepted', decision: 'Use DynamoDB' }];
    const wa = { 'cost-optimization': 'Pay-per-request, scales to zero' };
    const r = JSON.parse(generateIacHandoff(services, connections, 'X', 'us-east-1', { adr, wellArchitected: wa }));
    expect(r.architecture.rationale.decisions).toHaveLength(1);
    expect(r.architecture.rationale.wellArchitected['cost-optimization']).toMatch(/pay-per-request/i);
    expect(r.instruction).toMatch(/rationale/i);
  });

  it('omits rationale entirely when no ADR/WA given', () => {
    expect(out.architecture.rationale).toBeUndefined();
  });
});

describe('generatePricingPayload', () => {
  const out = JSON.parse(generatePricingPayload(services, 'My App', 'sa-east-1'));

  it('targets the AWS Pricing MCP (Price List API), not the calculator', () => {
    expect(out.tool).toBe('awslabs.aws-pricing-mcp-server');
    expect(out.region).toBe('sa-east-1');
    expect(out.instruction).toMatch(/get_pricing_service_codes/);
  });

  it('includes only services that carry pricing config', () => {
    // only `db` (DynamoDB) has config.pricing
    expect(out.services).toHaveLength(1);
    expect(out.services[0].service).toBe('Amazon DynamoDB');
    expect(out.services[0].config.writeUnits).toBe(100);
  });

  it('emits a Price List service_code discovery filter stripped of Amazon/AWS prefix', () => {
    expect(out.services[0].serviceCodeFilter).toBe('DynamoDB');
  });
});
