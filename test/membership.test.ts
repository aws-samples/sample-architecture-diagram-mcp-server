// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { describe, it, expect } from 'vitest';
import { resolveGroupsAndMembership } from '@/lib/membership';

describe('resolveGroupsAndMembership — implicit (subnet-derived)', () => {
  it('derives AWS Cloud → VPC → public/private subnet from subnet fields', () => {
    const { groups, membership } = resolveGroupsAndMembership([
      { id: 'cf', service: 'CloudFront', category: 'networking' },
      { id: 'alb', service: 'ELB', category: 'networking', subnet: 'public' },
      { id: 'db', service: 'RDS', category: 'database', subnet: 'private' },
    ]);
    expect(groups.map(g => g.id)).toEqual(['aws-cloud', 'vpc', 'pub-sub', 'priv-sub']);
    expect(membership).toMatchObject({ cf: 'aws-cloud', alb: 'pub-sub', db: 'priv-sub' });
  });

  it('keeps external/users services out of any group', () => {
    const { membership } = resolveGroupsAndMembership([
      { id: 'users', service: 'Users', category: 'general', external: true },
      { id: 'ext-pix', service: 'Pix', category: 'integration', external: true },
      { id: 'fn', service: 'AWS Lambda', category: 'compute' },
    ]);
    expect(membership.users).toBeUndefined();
    expect(membership['ext-pix']).toBeUndefined();
    expect(membership.fn).toBe('aws-cloud');
  });

  it('omits the VPC/subnet groups when nothing lives in them', () => {
    const { groups } = resolveGroupsAndMembership([
      { id: 'fn', service: 'AWS Lambda', category: 'compute' },
    ]);
    expect(groups.map(g => g.id)).toEqual(['aws-cloud']);
  });
});

describe('resolveGroupsAndMembership — explicit groups', () => {
  it('uses declared groups and maps services via parentId', () => {
    const declared = [
      { id: 'vpcA', label: 'VPC A', variant: 'vpc' },
      { id: 'subA', label: 'Private', parent: 'vpcA', variant: 'private-subnet' },
    ];
    const { groups, membership } = resolveGroupsAndMembership([
      { id: 'fn', service: 'AWS Lambda', parentId: 'subA' },
      { id: 'x', service: 'S3', parentId: 'nonexistent' },
    ], declared);
    expect(groups.map(g => g.id)).toEqual(['vpcA', 'subA']);
    expect(membership.fn).toBe('subA');
    expect(membership.x).toBeUndefined(); // parent not in declared groups
  });

  it('accepts `group` as an alias for parentId', () => {
    const { membership } = resolveGroupsAndMembership(
      [{ id: 'fn', service: 'AWS Lambda', group: 'g1' }],
      [{ id: 'g1', label: 'Pipeline', variant: 'group' }],
    );
    expect(membership.fn).toBe('g1');
  });

  it('defaults a group label to its id when omitted', () => {
    const { groups } = resolveGroupsAndMembership(
      [{ id: 'a', service: 'X', parentId: 'g1' }],
      [{ id: 'g1', variant: 'vpc' }],
    );
    expect(groups[0].label).toBe('g1');
  });
});
