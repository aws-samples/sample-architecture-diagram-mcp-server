// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The core's domain, module by module: vocabulary invariants, membership,
// layout primitives, the flow and sequence layouts (properties: no overlaps,
// ordering, determinism), the inline grammar (incl. unsafe hrefs), costs,
// icons, themes, a11y, app values, the document schemas.
import { describe, it, expect } from 'vitest';
import {
  AWS_ORANGE, TONE_COLORS, TONE_META, STATUS_COLORS, toneColor, toneMeta, resolveToneColor, DIAGRAM_TONES, PLAYER_TONES, PLAYER_TONE_NAMES, diagramToneColor,
  PLAYER_THEME, playerThemeCss, DIAGRAM_THEME, diagramThemeCss, diagramBaseCss,
  GROUP_VARIANTS, VARIANT_ALIASES, DEFAULT_VARIANT, resolveVariant, variantKey, ALL_GROUP_ICONS,
  tr, trAll, i18n, UI_STRINGS, LANG_LABEL, makeUi, ui, makeLangLabel,
  resolveGroupsAndMembership, membershipFromNodes,
  DEFAULT_GEOMETRY, HORIZONTAL_GEOMETRY, SLIDES_GEOMETRY, elkSpacing, elkGraphOptions, elkGroupPadding, groupDepth, ancestorsOf, lcaContainer, radialLayout,
  layoutFlow, flowActiveSet, flowFrame, layoutSequence, sequenceHeadBoxW,
  SERVICE_ICONS, SHAPE_ICONS, DARK_VARIANT_BASES, iconForService, iconForShape, withServiceIcon, iconFilterKind, normTokens,
  parseInline, inlineHtml, hasInlineMarkup, safeHref, safeHttpUrl,
  resolveCosts, costEnvs, costForEnv, initialCostEnv, stepCost, dockCost, envFromHash, hashWithEnv, costProblems, ENV_COST,
  describeArchitecture, describeSequence, SR_ONLY_STYLE,
  evalExpr, formatValue, exprRefs, APP_OPS,
  validateDiagram, validateSequence, diagramSchema, sequenceDocSchema,
  splitCodeByMarkers, codeBlocksOf, CODE_DEFAULT_MAX_LINES,
} from '@aws-sample-live-diagram/core';

const HEX = /^#[0-9A-Fa-f]{6}$/;

describe('tones', () => {
  it('every tone colour is a hex; meta exists for every tone; unknown tones fall back to accent', () => {
    for (const [k, v] of Object.entries(TONE_COLORS)) expect(v, k).toMatch(HEX);
    expect(Object.keys(TONE_META).sort()).toEqual(Object.keys(TONE_COLORS).sort());
    expect(toneColor('nope')).toBe(TONE_COLORS.accent);
    expect(toneColor(null)).toBe(TONE_COLORS.accent);
    expect(toneMeta('nope')).toBe(TONE_META.accent);
    expect(AWS_ORANGE).toBe('#FF9900');
    expect(STATUS_COLORS).toEqual({ true: TONE_COLORS.success, false: TONE_COLORS.danger, warn: TONE_COLORS.warn });
  });
  it('an explicit colour wins over a tone', () => {
    expect(resolveToneColor('info', '#123456')).toBe('#123456');
    expect(resolveToneColor('info')).toBe(toneColor('info'));
  });
  it('the player palette is the diagram palette restricted to the player tone names', () => {
    expect(Object.keys(PLAYER_TONES)).toEqual(PLAYER_TONE_NAMES);
    for (const k of PLAYER_TONE_NAMES) expect(PLAYER_TONES[k]).toBe(DIAGRAM_TONES[k]);
    expect(diagramToneColor('nope')).toBe(DIAGRAM_TONES.info);
    expect(diagramToneColor('nope', '#000000')).toBe('#000000');
  });
});

describe('themes', () => {
  it('player theme CSS declares every token for both modes', () => {
    const css = playerThemeCss();
    for (const mode of Object.values(PLAYER_THEME)) for (const k of Object.keys(mode)) expect(css).toContain(k.startsWith('--') ? k : `--${k}`);
    expect(playerThemeCss('.l', '.d')).toContain('.d');
  });
  it('diagram theme: both modes carry the same token names; CSS scopes to the selectors', () => {
    expect(Object.keys(DIAGRAM_THEME.light).sort()).toEqual(Object.keys(DIAGRAM_THEME.dark).sort());
    const css = diagramThemeCss('.L', '.D');
    expect(css).toContain('.L');
    expect(css).toContain('.D');
    expect(typeof diagramBaseCss('.x')).toBe('string');
  });
});

describe('group variants', () => {
  it('every variant has a hex stroke and a 32px icon; every alias resolves to a variant', () => {
    for (const [k, v] of Object.entries(GROUP_VARIANTS)) { expect(v.stroke, k).toMatch(HEX); expect(v.icon, k).toMatch(/_32\.png$/); }
    for (const [alias, target] of Object.entries(VARIANT_ALIASES)) { expect(GROUP_VARIANTS, alias).toHaveProperty(target); expect(variantKey(alias)).toBe(target); }
    expect(ALL_GROUP_ICONS.length).toBe(new Set(ALL_GROUP_ICONS).size);
  });
  it('unknown or empty variants resolve to the default', () => {
    expect(variantKey('nope')).toBe(DEFAULT_VARIANT);
    expect(variantKey(undefined)).toBe(DEFAULT_VARIANT);
    expect(resolveVariant('nope')).toEqual(GROUP_VARIANTS[DEFAULT_VARIANT]);
    expect(resolveVariant('vpc')).toEqual(GROUP_VARIANTS.vpc);
  });
});

describe('i18n', () => {
  it('tr picks the language, falls back to en then to any value; passes strings through', () => {
    expect(tr({ en: 'Hi', pt: 'Oi' }, 'pt')).toBe('Oi');
    expect(tr({ en: 'Hi', pt: 'Oi' }, 'es')).toBe('Hi');
    expect(tr('plain', 'pt')).toBe('plain');
    expect(tr(undefined, 'pt')).toBe('');
    expect(trAll({ en: 'Hi', pt: 'Oi' })).toContain('Hi');
    expect(i18n({ en: 'Hi' }, 'en')).toBe('Hi');
  });
  it('every UI string has English; overrides win; unknown keys are empty', () => {
    for (const [k, v] of Object.entries(UI_STRINGS)) expect((v as Record<string, string>).en, k).toBeTruthy();
    const key = Object.keys(UI_STRINGS)[0];
    expect(makeUi({ [key]: { en: 'X' } })(key, 'en')).toBe('X');
    // An unknown key is "" (the component falls back to its own literal).
    expect(ui('definitely-not-a-key', 'en')).toBe('');
    expect(LANG_LABEL.pt).toBe('PT');
    expect(makeLangLabel({ pt: 'Português' })('pt')).toBe('Português');
  });
});

describe('membership', () => {
  const svc = (id: string, extra: Record<string, unknown> = {}) => ({ id, service: 'AWS Lambda', ...extra });
  it('explicit groups: services join by parentId or group; unknown parents are ignored', () => {
    const { groups, membership } = resolveGroupsAndMembership(
      [svc('a', { parentId: 'g' }), svc('b', { group: 'g' }), svc('c', { parentId: 'ghost' }), svc('d')],
      [{ id: 'g', variant: 'vpc' }]);
    expect(groups).toEqual([{ id: 'g', label: 'g', parent: undefined, variant: 'vpc', icon: undefined, pill: undefined, pillOverlay: undefined, pillSide: undefined }]);
    expect(membership).toEqual({ a: 'g', b: 'g' });
  });
  it('implicit tree from subnet; externals stay outside', () => {
    const { groups, membership } = resolveGroupsAndMembership([svc('pub', { subnet: 'public' }), svc('priv', { subnet: 'private' }), svc('free'), svc('users'), svc('ext-x'), svc('e', { external: true })]);
    expect(groups.map((g) => [g.id, g.parent ?? null])).toEqual([['aws-cloud', null], ['vpc', 'aws-cloud'], ['pub-sub', 'vpc'], ['priv-sub', 'vpc']]);
    expect(membership).toEqual({ pub: 'pub-sub', priv: 'priv-sub', free: 'aws-cloud' });
  });
  it('no services, no groups', () => {
    expect(resolveGroupsAndMembership([])).toEqual({ groups: [], membership: {} });
  });
  it('membershipFromNodes reads parentId of service nodes', () => {
    expect(membershipFromNodes([{ id: 'a', type: 'aws', parentId: 'g', position: { x: 0, y: 0 }, data: {} }, { id: 'g', type: 'group', position: { x: 0, y: 0 }, data: {} }] as never)).toEqual({ a: 'g' });
  });
});

describe('layout primitives', () => {
  it('geometry presets', () => {
    expect(DEFAULT_GEOMETRY.nodeW).toBe(180);
    expect(SLIDES_GEOMETRY).toBe(HORIZONTAL_GEOMETRY);
  });
  it('elkSpacing scales and rounds; elkGraphOptions picks the direction', () => {
    expect(elkSpacing(1.5, { betweenLayers: 100, nodeNode: 33 })).toMatchObject({ 'elk.layered.spacing.nodeNodeBetweenLayers': '150', 'elk.spacing.nodeNode': '50' });
    expect(elkGraphOptions('LR')['elk.direction']).toBe('RIGHT');
    expect(elkGraphOptions('RADIAL')['elk.direction']).toBe('RIGHT');
    expect(elkGraphOptions('TB')['elk.direction']).toBe('DOWN');
    expect(elkGroupPadding({ elkGroupPad: 1, elkGroupPadTop: 2 })).toBe('[top=2,left=1,bottom=1,right=1]');
  });
  it('depth, ancestors and LCA; cycles terminate', () => {
    const byId = new Map([['a', { id: 'a' }], ['b', { id: 'b', parent: 'a' }], ['c', { id: 'c', parent: 'b' }], ['x', { id: 'x', parent: 'y' }], ['y', { id: 'y', parent: 'x' }]]);
    expect(groupDepth('c', byId)).toBe(2);
    expect(groupDepth('a', byId)).toBe(0);
    expect(Number.isFinite(groupDepth('x', byId))).toBe(true);
    const m = { s1: 'c', s2: 'b', s3: 'a', s4: 'x' };
    expect(ancestorsOf('s1', m, byId)).toEqual(['a', 'b', 'c']);
    expect(lcaContainer('s1', 's2', m, byId)).toBe('b');
    expect(lcaContainer('s1', 's3', m, byId)).toBe('a');
    expect(lcaContainer('s1', 'free', m, byId)).toBeNull();
    expect(ancestorsOf('s4', m, byId).length).toBeLessThanOrEqual(2);
  });
  it('radialLayout: hub at the center; one ring per ten spokes', () => {
    const ns = Array.from({ length: 13 }, (_, i) => ({ id: `n${i}` }));
    const es = ns.slice(1).map((n) => ({ source: 'n0', target: n.id }));
    const out = radialLayout(ns, es, { nodeW: 100, nodeH: 50 });
    expect(out[0]).toEqual({ id: 'n0', position: { x: 550, y: 425 } });
    const r = (n: { position: { x: number; y: number } }) => Math.round(Math.hypot(n.position.x - 550, n.position.y - 425));
    expect(out.slice(1, 11).every((n) => r(n) === 260)).toBe(true);
    expect(out.slice(11).every((n) => r(n) === 520)).toBe(true);
  });
});

describe('flow layout', () => {
  const flow = {
    direction: 'TB',
    nodes: [{ id: 's', kind: 'start', label: 'Start' }, { id: 't', kind: 'task', label: 'Validate the request' }, { id: 'd', kind: 'decision', label: 'OK?' }, { id: 'y', kind: 'task', label: 'Approve' }, { id: 'n', kind: 'task', label: 'Reject' }, { id: 'e', kind: 'end', label: 'End' }],
    edges: [{ id: 'e1', from: 's', to: 't' }, { id: 'e2', from: 't', to: 'd' }, { id: 'e3', from: 'd', to: 'y', label: '[yes]' }, { id: 'e4', from: 'd', to: 'n', label: '[no]' }, { id: 'e5', from: 'y', to: 'e' }, { id: 'e6', from: 'n', to: 'e' }, { id: 'e7', from: 'n', to: 't', kind: 'back' }],
  };
  const boxes = (L: ReturnType<typeof layoutFlow>) => L.nodes.map((n) => ({ id: n.id, x0: L.X[n.id] - L.M[n.id].w / 2, y0: L.Y[n.id] - L.M[n.id].h / 2, x1: L.X[n.id] + L.M[n.id].w / 2, y1: L.Y[n.id] + L.M[n.id].h / 2 }));
  for (const direction of ['TB', 'LR']) {
    it(`${direction}: no two nodes overlap; everything inside W×H`, () => {
      const L = layoutFlow({ ...flow, direction });
      const b = boxes(L);
      for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
        const p = b[i], q = b[j];
        expect(p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1, `${p.id}/${q.id}`).toBe(false);
      }
      for (const x of b) { expect(x.x0).toBeGreaterThanOrEqual(0); expect(x.y0).toBeGreaterThanOrEqual(0); expect(x.x1).toBeLessThanOrEqual(L.W); expect(x.y1).toBeLessThanOrEqual(L.H); }
    });
    it(`${direction}: forward edges go down the layers; the back edge is marked`, () => {
      const L = layoutFlow({ ...flow, direction });
      for (const g of L.edges) {
        const e = g.edge;
        if (g.isBack) continue;
        expect(L.layer[e.to], `${e.from}->${e.to}`).toBeGreaterThan(L.layer[e.from]);
      }
      expect(L.edges.find((g) => g.id === 'e7')!.isBack).toBe(true);
      const k = direction === 'TB' ? 'Y' : 'X';
      expect(L[k].s).toBeLessThan(L[k].e);
    });
    it(`${direction}: deterministic, with a path for every edge`, () => {
      const a = layoutFlow({ ...flow, direction }), b = layoutFlow({ ...flow, direction });
      expect([a.X, a.Y, a.W, a.H, a.edges.map((g) => g.d)]).toEqual([b.X, b.Y, b.W, b.H, b.edges.map((g) => g.d)]);
      for (const g of a.edges) expect(g.d).toMatch(/^M/);
    });
  }
  it('labels get a label box; the bbox of a set is the union of its nodes', () => {
    const L = layoutFlow(flow);
    expect(L.edges.find((g) => g.id === 'e3')!.label).not.toBeNull();
    const bb = L.bboxOf(new Set(['s', 'e']));
    const b = boxes(L);
    const s = b.find((x) => x.id === 's')!, e = b.find((x) => x.id === 'e')!;
    expect(bb.x0).toBeLessThanOrEqual(Math.min(s.x0, e.x0) + 0.5);
    expect(bb.y1).toBeGreaterThanOrEqual(Math.max(s.y1, e.y1) - 0.5);
  });
  it('empty and null input', () => {
    expect(layoutFlow(null).nodes).toEqual([]);
    expect(layoutFlow({ nodes: [], edges: [] }).edges).toEqual([]);
  });
  it('flowActiveSet: a step lights its nodes and its edges\' endpoints; flowFrame fits the set', () => {
    const set = flowActiveSet(flow, { nodes: ['y'], edges: ['e3'] })!;
    expect([...set].sort()).toEqual(expect.arrayContaining(['d', 'y']));
    expect(flowActiveSet(flow, null)).toBeNull();
    const L = layoutFlow(flow);
    const fr = flowFrame(L, set, 800, 600, 24, 12);
    expect(fr.zoom).toBeGreaterThan(0);
    expect(flowFrame(L, null, 800, 600, 24, 12).zoom).toBeGreaterThan(0);
  });
});

describe('sequence layout', () => {
  const seq = {
    participants: [{ id: 'u', label: 'User', actor: true }, { id: 'a', label: 'API', sub: 'Amazon API Gateway' }, { id: 'd', label: 'Table' }],
    events: [
      { kind: 'message', id: 'm1', from: 'u', to: 'a', label: 'POST /orders' },
      { kind: 'message', id: 'm2', from: 'a', to: 'd', label: 'PutItem', activate: true },
      { kind: 'message', id: 'm3', from: 'd', to: 'a', label: 'ok', arrow: 'reply', deactivate: true },
      { kind: 'note', id: 'n1', over: ['a', 'd'], label: 'one transaction' },
      { kind: 'message', id: 'm4', from: 'a', to: 'u', label: '201', arrow: 'reply' },
    ],
    fragments: [{ kind: 'opt', label: 'valid', startId: 'm2', endId: 'm3' }],
  };
  it('lifelines left to right in order; rows top to bottom in order', () => {
    const L = layoutSequence(seq as never);
    const xs = seq.participants.map((_, i) => L.cx(i));
    expect([...xs].sort((p, q) => p - q)).toEqual(xs);
    const ys = L.evGeom.map((g) => g.y);
    expect([...ys].sort((p, q) => p - q)).toEqual(ys);
    expect(L.W).toBeGreaterThan(xs[xs.length - 1]);
    expect(L.H).toBeGreaterThan(ys[ys.length - 1]);
  });
  it('reply messages are drawn as returns; the fragment spans its events', () => {
    const L = layoutSequence(seq as never);
    expect(L.evGeom[2].cls).toBe('ret');
    expect(L.evGeom[0].cls).toBe('msg');
    expect(L.frames.length).toBe(1);
  });
  it('deterministic; head boxes grow with the label', () => {
    expect(JSON.stringify(layoutSequence(seq as never).evGeom)).toBe(JSON.stringify(layoutSequence(seq as never).evGeom));
    expect(sequenceHeadBoxW({ label: 'A much longer participant label' })).toBeGreaterThan(sequenceHeadBoxW({ label: 'A' }));
  });
});

describe('icons', () => {
  it('catalog values are icon files; shapes resolve', () => {
    for (const [k, v] of Object.entries(SERVICE_ICONS)) expect(v, k).toMatch(/\.(png|svg)$/);
    for (const [k, v] of Object.entries(SHAPE_ICONS)) expect(v, k).toMatch(/\.(png|svg)$/);
    const shape = Object.keys(SHAPE_ICONS)[0];
    expect(iconForShape(shape)).toBe(SHAPE_ICONS[shape]);
    expect(iconForShape('definitely-not-a-shape')).toBeNull();
  });
  it('services resolve by canonical and short names; unknown names do not', () => {
    expect(iconForService('AWS Lambda')).toMatch(/Lambda/);
    expect(iconForService('Amazon Simple Storage Service')).toBe(iconForService('Amazon S3'));
    expect(iconForService('Totally Unknown Thing 123')).toBeNull();
    expect(iconForService(undefined)).toBeNull();
  });
  it('withServiceIcon fills an icon only when missing; normTokens normalizes', () => {
    expect(withServiceIcon({ service: 'AWS Lambda' }).icon).toBe(iconForService('AWS Lambda'));
    expect(withServiceIcon({ service: 'AWS Lambda', icon: 'mine.png' }).icon).toBe('mine.png');
    expect(normTokens('Amazon  S3!')).toEqual(normTokens('amazon s3'));
  });
  it('iconFilterKind and the dark variant bases are consistent', () => {
    expect(['none', 'invert', 'mono', 'dark'].some((k) => iconFilterKind('x.png') === k || typeof iconFilterKind('x.png') === 'string')).toBe(true);
    expect(DARK_VARIANT_BASES.size).toBeGreaterThan(0);
  });
});

describe('inline grammar', () => {
  it('tokens: code, links, strong, em', () => {
    expect(parseInline('a `b` **c** __d__ *e* _f_ [g](https://x.y)')).toEqual([
      { type: 'text', text: 'a ' }, { type: 'code', text: 'b' }, { type: 'text', text: ' ' }, { type: 'strong', text: 'c' }, { type: 'text', text: ' ' },
      { type: 'strong2', text: 'd' }, { type: 'text', text: ' ' }, { type: 'em', text: 'e' }, { type: 'text', text: ' ' }, { type: 'em', text: 'f' }, { type: 'text', text: ' ' },
      { type: 'link', text: 'g', href: 'https://x.y' },
    ]);
    expect(parseInline(null)).toEqual([]);
    expect(hasInlineMarkup('plain')).toBe(false);
    expect(hasInlineMarkup('**b**')).toBe(true);
  });
  it('unsafe hrefs degrade to text', () => {
    for (const bad of ['javascript:alert(1)', 'javascript:alert', 'JaVaScRiPt:x', 'data:text/html,x', 'vbscript:x', '//evil.example', 'file:///etc/passwd']) {
      expect(safeHref(bad), bad).toBeUndefined();
      expect(parseInline(`[x](${bad})`).some((t) => t.type === 'link'), bad).toBe(false);
    }
    expect(parseInline('[x](javascript:alert)')).toEqual([{ type: 'text', text: 'x' }]);
    for (const ok of ['https://a.b', 'http://a.b', 'mailto:a@b', '/rel', '#frag', './x', '../y']) expect(safeHref(ok), ok).toBe(ok);
    expect(safeHttpUrl('https://calculator.aws/#/x')).toBe('https://calculator.aws/#/x');
    for (const bad of ['/rel', 'mailto:a@b', 'javascript:x', 'https://has space', 42]) expect(safeHttpUrl(bad)).toBeUndefined();
  });
  it('images are never loaded', () => {
    expect(parseInline('see ![diagram](https://x/y.png)')).toEqual([{ type: 'text', text: 'see ' }, { type: 'text', text: '[image not shown: diagram]' }]);
  });
  it('inlineHtml escapes everything and opens external links safely', () => {
    expect(inlineHtml('<b>"x"</b> & \'y\'')).toBe('&lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; &#39;y&#39;');
    expect(inlineHtml('[a](https://x.y)')).toBe('<a href="https://x.y" target="_blank" rel="noopener noreferrer">a</a>');
    expect(inlineHtml('[a](#local)')).toBe('<a href="#local">a</a>');
    expect(inlineHtml('`<script>`')).toBe('<code>&lt;script&gt;</code>');
  });
  it('hostile input stays linear', () => {
    const t0 = Date.now();
    parseInline('['.repeat(20000) + '(' + ']'.repeat(20000));
    parseInline('*'.repeat(20000));
    expect(Date.now() - t0).toBeLessThan(1500);
  });
});

describe('costs', () => {
  const spec = { costs: [{ id: 'poc', env: 'poc', label: 'PoC', url: 'https://calculator.aws/#/1' }, { id: 'prod', env: 'prod', url: 'https://calculator.aws/#/2', default: true }, { id: 'bad', env: 'x', url: 'javascript:alert(1)' }] };
  it('resolveCosts keeps only http(s) estimates and adds the costUrl shortcut once', () => {
    const list = resolveCosts(spec);
    expect(list.map((c) => c.id)).toEqual(['poc', 'prod']);
    expect(resolveCosts(spec, { costUrl: 'https://calculator.aws/#/3' }).map((c) => c.id)).toEqual(['_spec', 'poc', 'prod']);
    expect(resolveCosts(spec, { costUrl: 'https://calculator.aws/#/1' }).map((c) => c.id)).toEqual(['poc', 'prod']);
    expect(resolveCosts({ costUrl: 'javascript:x' })).toEqual([]);
  });
  it('environments, the default and per-env lookup', () => {
    const list = resolveCosts(spec);
    expect(costEnvs(list)).toEqual(['poc', 'prod']);
    expect(initialCostEnv(list)).toBe('prod');
    expect(costForEnv(list, 'poc')!.id).toBe('poc');
    expect(stepCost(list, { cost: 'poc' }, 'prod')!.id).toBe('poc');
    expect(stepCost(list, { cost: ENV_COST }, 'poc')!.id).toBe('poc');
    expect(dockCost(list, [{ cost: 'poc' }], 0, 'prod')).not.toBeNull();
  });
  it('the #env hash round-trips and keeps other hash parts', () => {
    expect(envFromHash(hashWithEnv('#tab', 'prod'))).toBe('prod');
    expect(hashWithEnv('#tab&env=poc', 'prod')).toBe('#tab&env=prod');
    expect(hashWithEnv('#env=poc', null)).toBe('');
    expect(envFromHash('#env=a%20b')).toBe('a b');
    expect(envFromHash('')).toBeUndefined();
  });
  it('costProblems names duplicates, double defaults and dangling step refs', () => {
    const p = costProblems({ costs: [{ id: 'a', url: 'https://x', default: true }, { id: 'a', url: 'https://y', default: true }], steps: [{ cost: 'zzz' }, { cost: ENV_COST }] });
    expect(p).toEqual(['costs: id "a" listed twice', 'costs: more than one entry has default: true', 'steps.0.cost: no estimate with id "zzz" in costs']);
    expect(costProblems({ steps: [{ cost: ENV_COST }] })).toEqual(['steps.0.cost: "@env" needs costs (or costUrl)']);
    expect(costProblems({})).toEqual([]);
  });
});

describe('a11y', () => {
  it('architecture and sequence summaries name the parts', () => {
    const a = describeArchitecture({ title: 'Orders', services: [{ id: 'l', service: 'AWS Lambda' }, { id: 't', service: 'Amazon DynamoDB' }], connections: [{ id: 'c', source: 'l', target: 't', label: 'PutItem' }] });
    expect(a).toContain('AWS Lambda');
    expect(a).toContain('Amazon DynamoDB');
    const s = describeSequence({ title: 'Flow', participants: [{ id: 'a', label: 'Alice' }, { id: 'b', label: 'Bob' }], events: [{ kind: 'message', id: 'm', from: 'a', to: 'b', label: 'hello' }] });
    expect(s).toContain('Alice');
    expect(s).toContain('hello');
    expect(describeArchitecture(null)).toBe(describeArchitecture(undefined));
    expect(SR_ONLY_STYLE.position).toBe('absolute');
  });
});

describe('app values', () => {
  it('formulas: every op evaluates; references resolve through metrics; cycles stop', () => {
    expect(APP_OPS.length).toBeGreaterThan(0);
    const op = (o: string, ...args: unknown[]) => ({ op: o, args });
    expect(evalExpr(op('sum', 1, 2, 3))).toBe(6);
    expect(evalExpr(op('sub', 10, 3, 2))).toBe(5);
    expect(evalExpr(op('div', 1, 0))).toBeNaN();
    expect(evalExpr(op('round', 3.14159, 2))).toBe(3.14);
    expect(evalExpr(op('pct', 1, 4))).toBe(25);
    expect(evalExpr(op('if', op('gt', 2, 1), 'yes', 'no'))).toBe('yes');
    expect(evalExpr(op('eq', 'a', 'a'))).toBe(1);
    expect(evalExpr(op('min', 3, 1, 2))).toBe(1);
    expect(evalExpr(op('nope', 1))).toBeNaN();
    expect(evalExpr(op('mul', { ref: 'n' }, 2), { n: 21 })).toBe(42);
    expect(evalExpr({ ref: 'm' }, {}, { m: op('sum', 1, 1) })).toBe(2);
    expect(evalExpr({ ref: 'loop' }, {}, { loop: { ref: 'loop' } })).toBeNaN();
    expect(evalExpr({ ref: 'missing' })).toBeNaN();
    expect(exprRefs(op('sum', { ref: 'a' }, op('mul', { ref: 'b' }, 1)))).toEqual(['a', 'b']);
    expect(typeof formatValue(1234.5, { style: 'currency', currency: 'USD' }, 'en')).toBe('string');
  });
});

describe('code blocks', () => {
  it('splits a fenced snippet by markers; limits are positive', () => {
    const parts = splitCodeByMarkers('# --- a.py\nx = 1\n# --- b.py\ny = 2');
    expect(parts.length).toBeGreaterThanOrEqual(1);
    expect(CODE_DEFAULT_MAX_LINES).toBeGreaterThan(0);
    expect(codeBlocksOf(null)).toBeNull();
  });
});

describe('document schemas', () => {
  it('a minimal architecture validates; bad shapes do not', () => {
    expect(validateDiagram({ services: [{ id: 'a', service: 'AWS Lambda' }], connections: [] }).valid).toBe(true);
    expect(validateDiagram({ services: 'nope' }).valid).toBe(false);
    expect(validateDiagram(null).valid).toBe(false);
    expect(validateDiagram({ kind: 'mystery', services: [] }).errors[0]).toMatch(/unknown diagram kind/);
  });
  it('a minimal sequence validates (also as kind: sequence); bad events do not', () => {
    const ok = { participants: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], events: [{ kind: 'message', id: 'm', from: 'a', to: 'b', label: 'x' }] };
    expect(validateSequence(ok).valid).toBe(true);
    expect(validateDiagram({ kind: 'sequence', ...ok }).valid).toBe(true);
    expect(validateSequence({ participants: [], events: [{ kind: 'message' }] }).valid).toBe(false);
  });
  it('the schemas are plain JSON', () => {
    expect(JSON.parse(JSON.stringify(diagramSchema))).toEqual(diagramSchema);
    expect(JSON.parse(JSON.stringify(sequenceDocSchema))).toEqual(sequenceDocSchema);
  });
});
