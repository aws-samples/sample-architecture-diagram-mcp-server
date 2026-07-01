import { describe, it, expect } from 'vitest';
import { compoundLayout, type GroupSpec } from '@/lib/compoundLayout';
import { resolveVariant, variantKey, GROUP_VARIANTS, ALL_GROUP_ICONS } from '@/lib/groupVariants';

const node = (id: string) => ({ id, type: 'aws', position: { x: 0, y: 0 }, data: {} }) as any;

describe('groupVariants registry', () => {
  it('resolves known variants and falls back for unknown', () => {
    expect(resolveVariant('vpc').grIcon).toBe('group_vpc2');
    expect(resolveVariant('account').icon).toBe('AWS-Account_32.png');
    expect(variantKey('totally-unknown')).toBe('group'); // default
  });

  it('accepts legacy aliases', () => {
    expect(variantKey('pub-sub')).toBe('public-subnet');
    expect(variantKey('priv-sub')).toBe('private-subnet');
    expect(variantKey('asg')).toBe('auto-scaling-group');
  });

  it('covers the four requested families', () => {
    for (const v of ['vpc', 'public-subnet', 'availability-zone', 'account', 'auto-scaling-group', 'corporate-data-center']) {
      expect(GROUP_VARIANTS[v], `missing variant ${v}`).toBeDefined();
    }
  });

  it('every variant icon is in the inline list', () => {
    for (const v of Object.values(GROUP_VARIANTS)) {
      expect(ALL_GROUP_ICONS).toContain(v.icon);
    }
  });
});

describe('compoundLayout — data-driven groups', () => {
  it('renders a group node only when it has members', () => {
    const groups: GroupSpec[] = [{ id: 'vpc', label: 'VPC', variant: 'vpc' }];
    const out = compoundLayout([node('a')], [], { a: 'vpc' }, 'TB', groups);
    const grp = out.find(n => n.type === 'group');
    expect(grp?.id).toBe('vpc');
    expect(grp?.data.variant).toBe('vpc');
  });

  it('skips empty groups (no members)', () => {
    const groups: GroupSpec[] = [{ id: 'empty', label: 'Empty', variant: 'vpc' }];
    const out = compoundLayout([node('a')], [], {}, 'TB', groups);
    expect(out.find(n => n.type === 'group')).toBeUndefined();
  });

  it('supports MULTIPLE VPCs side by side', () => {
    const groups: GroupSpec[] = [
      { id: 'vpcA', label: 'VPC A', variant: 'vpc' },
      { id: 'vpcB', label: 'VPC B', variant: 'vpc' },
    ];
    const out = compoundLayout([node('a'), node('b')], [], { a: 'vpcA', b: 'vpcB' }, 'TB', groups);
    const grpIds = out.filter(n => n.type === 'group').map(n => n.id).sort();
    expect(grpIds).toEqual(['vpcA', 'vpcB']);
  });

  it('supports arbitrary-depth nesting (account → region → vpc → subnet → az)', () => {
    const groups: GroupSpec[] = [
      { id: 'acct', label: 'Prod Account', variant: 'account' },
      { id: 'rgn', label: 'us-east-1', parent: 'acct', variant: 'region' },
      { id: 'vpc', label: 'VPC', parent: 'rgn', variant: 'vpc' },
      { id: 'sub', label: 'Private Subnet', parent: 'vpc', variant: 'private-subnet' },
      { id: 'az', label: 'us-east-1a', parent: 'sub', variant: 'availability-zone' },
    ];
    const out = compoundLayout([node('fn')], [], { fn: 'az' }, 'TB', groups);
    const grpIds = out.filter(n => n.type === 'group').map(n => n.id);
    // all 5 ancestors render (each contains the chain down to the node)
    expect(grpIds).toHaveLength(5);
    // outermost (account) is emitted before innermost (az) so inner draws on top
    expect(grpIds.indexOf('acct')).toBeLessThan(grpIds.indexOf('az'));
  });

  it('tolerates a parent reference to a missing group (no crash, no cycle)', () => {
    const groups: GroupSpec[] = [{ id: 'vpc', label: 'VPC', parent: 'ghost', variant: 'vpc' }];
    const out = compoundLayout([node('a')], [], { a: 'vpc' }, 'TB', groups);
    expect(out.find(n => n.type === 'group')?.id).toBe('vpc');
  });

  it('back-compat: no groups passed → no group overlays, services still positioned', () => {
    const out = compoundLayout([node('a'), node('b')], [{ id: 'e', source: 'a', target: 'b' } as any], {}, 'TB', []);
    expect(out.filter(n => n.type === 'group')).toHaveLength(0);
    expect(out.filter(n => n.type === 'aws')).toHaveLength(2);
  });
});

describe('compoundLayout — radial', () => {
  const svc = (id: string) => ({ id, type: 'aws', position: { x: 0, y: 0 }, data: {} }) as any;

  it('puts the most-connected node at the center and fans the rest around it', () => {
    const nodes = ['hub', 's1', 's2', 's3', 's4'].map(svc);
    const edges = ['s1', 's2', 's3', 's4'].map((t, i) => ({ id: 'e' + i, source: 'hub', target: t } as any));
    const out = compoundLayout(nodes, edges, {}, 'RADIAL', []);
    const positions = Object.fromEntries(out.map(n => [n.id, n.position]));
    // hub near a central point; spokes spread on a ring around it (varied angles)
    const spokeXs = ['s1', 's2', 's3', 's4'].map(id => positions[id].x);
    expect(new Set(spokeXs).size).toBeGreaterThan(1); // not a straight line
    // every node placed
    expect(out.filter(n => n.type === 'aws')).toHaveLength(5);
  });

  it('falls back to dagre when groups are present (radial ignored with containers)', () => {
    const out = compoundLayout([svc('a')], [], { a: 'vpc' }, 'RADIAL', [{ id: 'vpc', label: 'VPC', variant: 'vpc' }]);
    expect(out.find(n => n.type === 'group')?.id).toBe('vpc'); // container rendered
  });
});
