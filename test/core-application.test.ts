// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The core's application layer with fake ports: the layout use case over the
// LayoutEngine port, the walkthrough step machine, the cost-environment and
// app-page deep links over UrlState, the export payloads, the editor ops.
import { describe, it, expect } from 'vitest';
import {
  createCompoundLayout, planCompoundLayout,
  initialWalkStep, reduceWalkStep, walkKey, autoplayTick, stepBy, WALK_AUTOPLAY_MS,
  costEnvFromHash, costEnvUrl, createCostEnvLink, resolveCosts, envFromHash,
  pageFromHash, pageHash, createAppPageLink,
  EXPORT_FILES, SHARE_CARD, SEQUENCE_EXPORT_VARS, TRANSPARENT_PIXEL_PNG, wrapText, shareCardLayout, sequenceSvgStyle, svgFile,
  absolutePosition, descendantIds, nodeSize, reparentOnDrop, reparentNode, toParentRelative, alignBounds, alignedPosition, distributeCoordinates,
} from '@aws-sample-live-diagram/core';
import type { EditorGraphNode, WalkAction } from '@aws-sample-live-diagram/core';
import { elkLayout, compoundLayout, layoutWithFallback, elkLayoutEngine, dagreLayeredEngine } from '@aws-sample-live-diagram/core/layout-engine';
import { fakeLayeredEngine, fakeLayoutEngine, fakeUrlState } from './support/core-fakes';

const svc = (id: string) => ({ id, data: { label: id.toUpperCase() } });
const nodes = ['a', 'b', 'c', 'd'].map(svc);
const edges = [{ id: 'ab', source: 'a', target: 'b' }, { id: 'bc', source: 'b', target: 'c' }, { id: 'cd', source: 'c', target: 'd' }];
const groups = [{ id: 'vpc', variant: 'vpc', label: 'VPC' }, { id: 'sub', variant: 'private-subnet', label: 'Private', parent: 'vpc' }];
const membership = { b: 'vpc', c: 'sub' };

describe('application/layout — createCompoundLayout over the LayoutEngine port', () => {
  it('hands the planned graph to the engine and reads its answer back', async () => {
    const fake = fakeLayoutEngine();
    const { elkLayout: lay } = createCompoundLayout({ engine: fake.engine, fallback: fakeLayeredEngine().engine });
    const res = await lay(nodes, edges, membership, { direction: 'TB', groups });
    expect(fake.graphs).toHaveLength(1);
    expect(fake.graphs[0]).toEqual(planCompoundLayout(nodes, edges, membership, { direction: 'TB', groups }).graph);
    expect(res.nodes.map((n) => n.id)).toEqual(['vpc', 'sub', 'a', 'b', 'c', 'd']);
    for (const e of edges) expect(res.edgePaths[e.id]?.length, e.id).toBeGreaterThanOrEqual(2);
    // Absolute positions: a service inside the subnet sits inside the subnet's box.
    const sub = res.nodes.find((n) => n.id === 'sub')!, c = res.nodes.find((n) => n.id === 'c')!;
    expect(c.position.x).toBeGreaterThanOrEqual(sub.position.x);
    expect(c.position.y).toBeGreaterThanOrEqual(sub.position.y);
  });
  it('falls back to the layered engine when the compound one rejects (nodes only, no edge paths)', async () => {
    const compound = fakeLayoutEngine({ reject: true }), layered = fakeLayeredEngine();
    const { layoutWithFallback: lay } = createCompoundLayout({ engine: compound.engine, fallback: layered.engine });
    const res = await lay(nodes, edges, membership, { direction: 'LR', groups });
    expect(compound.graphs).toHaveLength(1);
    expect(layered.graphs).toHaveLength(1);
    expect(res.edgePaths).toEqual({});
    expect(res.nodes.map((n) => n.id)).toEqual(['vpc', 'sub', 'a', 'b', 'c', 'd']);
  });
  it('the layered graph: groups first as 1×1 compound parents, then services; edges only between known nodes', () => {
    const layered = fakeLayeredEngine();
    const { compoundLayout: lay } = createCompoundLayout({ engine: fakeLayoutEngine().engine, fallback: layered.engine });
    lay(nodes, [...edges, { id: 'x', source: 'a', target: 'ghost' }], membership, { direction: 'LR', groups });
    const g = layered.graphs[0];
    expect(g.compound).toBe(true);
    expect(g.options.rankdir).toBe('LR');
    expect(g.nodes.map((n) => [n.id, n.parent ?? null, n.width])).toEqual([['vpc', null, 1], ['sub', 'vpc', 1], ['a', null, 180], ['b', 'vpc', 180], ['c', 'sub', 180], ['d', null, 180]]);
    expect(g.edges.map((e) => `${e.source}>${e.target}`)).toEqual(['a>b', 'b>c', 'c>d']);
  });
  it('RADIAL without groups is placed without calling any engine', async () => {
    const compound = fakeLayoutEngine(), layered = fakeLayeredEngine();
    const api = createCompoundLayout({ engine: compound.engine, fallback: layered.engine });
    const a = await api.elkLayout(nodes, edges, {}, { direction: 'RADIAL' });
    const b = api.compoundLayout(nodes, edges, {}, { direction: 'RADIAL' });
    expect(compound.graphs).toHaveLength(0);
    expect(layered.graphs).toHaveLength(0);
    expect(a.edgePaths).toEqual({});
    expect(a.nodes).toEqual(b);
  });
  it('the ./layout-engine entry is createCompoundLayout over the elk and dagre adapters', async () => {
    const own = createCompoundLayout({ engine: elkLayoutEngine, fallback: dagreLayeredEngine });
    const opts = { direction: 'LR', groups };
    expect(await elkLayout(nodes, edges, membership, opts)).toEqual(await own.elkLayout(nodes, edges, membership, opts));
    expect(compoundLayout(nodes, edges, membership, opts)).toEqual(own.compoundLayout(nodes, edges, membership, opts));
    expect(await layoutWithFallback(nodes, edges, membership, opts)).toEqual(await own.layoutWithFallback(nodes, edges, membership, opts));
  });
});

describe('application/walkthrough — the step machine', () => {
  it('opens on the overview unless an integer startStep is given (clamped)', () => {
    expect(initialWalkStep(undefined, 5)).toBe(-1);
    expect(initialWalkStep(1.5, 5)).toBe(-1);
    expect(initialWalkStep('2', 5)).toBe(-1);
    expect(initialWalkStep(2, 5)).toBe(2);
    expect(initialWalkStep(9, 5)).toBe(4);
    expect(initialWalkStep(-7, 5)).toBe(-1);
    expect(initialWalkStep(0, 0)).toBe(-1);
  });
  it('transitions: next/prev clamp to [-1, count-1], first/last/exit jump, goto clamps', () => {
    const t = (s: number, a: WalkAction) => reduceWalkStep(s, a, 3);
    expect([t(-1, { type: 'next' }), t(1, { type: 'next' }), t(2, { type: 'next' })]).toEqual([0, 2, 2]);
    expect([t(2, { type: 'prev' }), t(0, { type: 'prev' }), t(-1, { type: 'prev' })]).toEqual([1, -1, -1]);
    expect([t(-1, { type: 'first' }), t(0, { type: 'last' }), t(2, { type: 'exit' })]).toEqual([0, 2, -1]);
    expect([t(0, { type: 'goto', index: 1 }), t(0, { type: 'goto', index: 99 }), t(0, { type: 'goto', index: -9 })]).toEqual([1, 2, -1]);
  });
  it('a full tour: overview → every beat → stays on the last → Esc back to the overview', () => {
    let s = initialWalkStep(-1, 4);
    const seen = [s];
    for (let i = 0; i < 6; i++) { s = reduceWalkStep(s, { type: 'next' }, 4); seen.push(s); }
    s = reduceWalkStep(s, { type: 'exit' }, 4); seen.push(s);
    expect(seen).toEqual([-1, 0, 1, 2, 3, 3, 3, -1]);
  });
  it('keyboard map', () => {
    expect(walkKey('ArrowRight', null)).toEqual({ action: { type: 'next' }, preventDefault: true });
    expect(walkKey(' ', { tagName: 'DIV' })).toEqual({ action: { type: 'next' }, preventDefault: true });
    expect(walkKey('PageDown', null)?.action).toEqual({ type: 'next' });
    expect(walkKey('ArrowLeft', null)).toEqual({ action: { type: 'prev' }, preventDefault: true });
    expect(walkKey('PageUp', null)?.action).toEqual({ type: 'prev' });
    expect(walkKey('Home', null)).toEqual({ action: { type: 'first' }, preventDefault: false });
    expect(walkKey('End', null)).toEqual({ action: { type: 'last' }, preventDefault: false });
    expect(walkKey('Escape', null)).toEqual({ action: { type: 'exit' }, preventDefault: false });
    expect(walkKey('x', null)).toBeNull();
  });
  it('keys typed into a field, and Space on a button/link, belong to that control', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) expect(walkKey('ArrowRight', { tagName })).toBeNull();
    expect(walkKey('ArrowRight', { tagName: 'DIV', isContentEditable: true })).toBeNull();
    expect(walkKey(' ', { tagName: 'BUTTON' })).toBeNull();
    expect(walkKey(' ', { tagName: 'A' })).toBeNull();
    expect(walkKey(' ', { tagName: 'DIV', role: 'button' })).toBeNull();
    expect(walkKey('ArrowRight', { tagName: 'BUTTON' })?.action).toEqual({ type: 'next' });
  });
  it('autoplay advances each tick and stops on the last beat', () => {
    expect(WALK_AUTOPLAY_MS).toBe(2600);
    expect(autoplayTick(-1, 3)).toEqual({ stop: false, next: 0 });
    expect(autoplayTick(1, 3)).toEqual({ stop: false, next: 2 });
    expect(autoplayTick(2, 3)).toEqual({ stop: true });
  });
  it('stepBy clamps', () => {
    expect(stepBy(0, 1, 0, 3)).toBe(1);
    expect(stepBy(3, 1, 0, 3)).toBe(3);
    expect(stepBy(0, -1, 0, 3)).toBe(0);
    expect(stepBy(-1, 1, 0, 3)).toBe(0);
  });
});

describe('application/costEnv — cost environment + #env deep link', () => {
  const costs = resolveCosts({ costs: [{ id: 'poc', env: 'poc', url: 'https://calculator.aws/#/estimate?id=1' }, { id: 'prod', env: 'prod', url: 'https://calculator.aws/#/estimate?id=2' }] });
  it('opens on the deep-linked environment when the estimates offer it', () => {
    expect(costEnvFromHash('#env=prod', costs)).toBe('prod');
    expect(costEnvFromHash('#env=staging', costs)).toBe(costEnvFromHash('', costs));
    expect(costEnvFromHash('', [])).toBeUndefined();
  });
  it('round-trips through the UrlState port', () => {
    const url = fakeUrlState('/d.html');
    const link = createCostEnvLink(url.port);
    expect(link.initial(costs)).not.toBe('prod');
    link.write('prod');
    expect(url.writes).toHaveLength(1);
    expect(envFromHash(url.hash)).toBe('prod');
    expect(createCostEnvLink(url.port).initial(costs)).toBe('prod');
  });
  it('keeps the rest of the hash and falls back to path + query when the hash ends up empty', () => {
    expect(envFromHash(costEnvUrl('#arch', 'prod', '/x?q=1'))).toBe('prod');
    expect(costEnvUrl('#arch', 'prod', '/x?q=1')).toContain('arch');
    const emptied = costEnvUrl('', '', '/x?q=1');
    expect(emptied === '/x?q=1' || emptied.startsWith('#')).toBe(true);
  });
});

describe('application/appPages — app shell page + #page deep link', () => {
  const pages = [{ id: 'overview' }, { id: 'costs & sizing' }];
  it('reads only known pages from the hash (URI-decoded)', () => {
    expect(pageFromHash('#overview', pages)).toBe('overview');
    expect(pageFromHash(pageHash('costs & sizing'), pages)).toBe('costs & sizing');
    expect(pageFromHash('#nope', pages)).toBeUndefined();
    expect(pageFromHash('', pages)).toBeUndefined();
  });
  it('writes, follows and unsubscribes through the UrlState port', () => {
    const url = fakeUrlState('/app.html#overview');
    const link = createAppPageLink(url.port);
    expect(link.current(pages)).toBe('overview');
    const seen: string[] = [];
    const off = link.follow(pages, (id) => seen.push(id));
    url.navigate('#costs%20%26%20sizing');
    url.navigate('#unknown');
    expect(seen).toEqual(['costs & sizing']);
    off();
    expect(url.listeners).toBe(0);
    link.write('overview');
    expect(url.writes).toEqual(['#overview']);
  });
});

describe('application/exports — payloads', () => {
  const mono = (t: string) => t.length * 10;
  it('wrapText: greedy lines, ellipsis when cut', () => {
    expect(wrapText('one two three', 1000, 2, mono)).toEqual(['one two three']);
    expect(wrapText('one two three', 75, 3, mono)).toEqual(['one two', 'three']);
    // The last line is cut with an ellipsis when it is itself too wide…
    expect(wrapText('aa bb cccccccccccccccc', 50, 2, mono)).toEqual(['aa bb', 'cccc…']);
    // …while words past the last line are dropped (the historical behavior).
    expect(wrapText('alpha beta gamma delta epsilon', 110, 2, mono)).toEqual(['alpha beta', 'gamma delta']);
    expect(wrapText(undefined, 100, 2, mono)).toEqual([]);
  });
  it('shareCardLayout: the text block sits above the bottom margin; the subtitle never leaves the canvas', () => {
    const measure = (_f: string, t: string) => t.length * 22;
    const one = shareCardLayout('Short', undefined, measure);
    const two = shareCardLayout('A very long title that certainly wraps onto a second line for sure', 'And a subtitle that is long enough to wrap onto two lines as well, really it is', measure);
    expect(one.titleLines).toHaveLength(1);
    expect(one.subtitleLines).toHaveLength(0);
    expect(two.titleLines).toHaveLength(2);
    expect(two.subtitleLines).toHaveLength(2);
    for (const l of [...two.titleLines, ...two.subtitleLines]) { expect(l.x).toBe(SHARE_CARD.pad); expect(l.y).toBeLessThan(SHARE_CARD.height); }
    for (const l of one.titleLines) expect(l.y).toBeLessThanOrEqual(SHARE_CARD.height - SHARE_CARD.bottom);
    expect(two.accent.y).toBeLessThan(two.titleLines[0].y);
    expect(two.scrimTop + two.scrimHeight).toBe(SHARE_CARD.height);
    expect(two.scrimHeight).toBeGreaterThanOrEqual(200);
    // The subtitle starts 6px tighter than a title line pitch below the last title line.
    expect(two.subtitleLines[0].y - two.titleLines[1].y).toBe(SHARE_CARD.titleLead - 6);
  });
  it('sequenceSvgStyle pins every token and un-scopes the panel rules', () => {
    const css = sequenceSvgStyle((v) => ` ${v.slice(2)}-value `, ['.ld-seqp .a{x:1}', '.ld-seqp  .b{y:2}']);
    for (const v of SEQUENCE_EXPORT_VARS) expect(css).toContain(`${v}:${v.slice(2)}-value;`);
    expect(css).toContain('.a{x:1}\n.b{y:2}');
    expect(css).not.toContain('.ld-seqp');
    expect(svgFile('<svg/>')).toBe('<?xml version="1.0" encoding="UTF-8"?>\n<svg/>');
  });
  it('file names and the placeholder pixel', () => {
    expect(EXPORT_FILES).toEqual({ diagramPng: 'architecture.png', shareCardPng: 'share-card.png', sequenceSvg: 'sequence-diagram.svg', sequencePng: 'sequence-diagram.png' });
    expect(TRANSPARENT_PIXEL_PNG.startsWith('data:image/png;base64,')).toBe(true);
  });
});

describe('application/editor — canvas ops', () => {
  type N = EditorGraphNode & { extent?: unknown };
  const g = (id: string, x: number, y: number, w: number, h: number, parentId?: string): N => ({ id, type: 'group', position: { x, y }, style: { width: w, height: h }, ...(parentId ? { parentId } : {}) });
  const s = (id: string, x: number, y: number, parentId?: string, selected = false): N => ({ id, type: 'aws', position: { x, y }, width: 100, height: 50, selected, ...(parentId ? { parentId } : {}) });
  const ns: N[] = [g('outer', 0, 0, 800, 600), g('inner', 100, 100, 300, 200, 'outer'), s('a', 50, 50, 'inner'), s('b', 900, 50)];
  const byId = Object.fromEntries(ns.map((n) => [n.id, n]));

  it('absolutePosition walks the parent chain; descendantIds collects the subtree', () => {
    expect(absolutePosition(byId.a, byId)).toEqual({ x: 150, y: 150 });
    expect([...descendantIds(ns, 'outer')].sort()).toEqual(['a', 'inner', 'outer']);
    expect(nodeSize(byId.inner)).toEqual({ w: 300, h: 200 });
    expect(nodeSize(byId.a)).toEqual({ w: 100, h: 50 });
  });
  it('absolutePosition survives a parent cycle', () => {
    const cyc: N[] = [{ id: 'p', position: { x: 1, y: 1 }, parentId: 'q' }, { id: 'q', position: { x: 2, y: 2 }, parentId: 'p' }];
    const m = Object.fromEntries(cyc.map((n) => [n.id, n]));
    expect(absolutePosition(m.p, m)).toEqual({ x: 4, y: 4 });
  });
  it('reparentOnDrop: the innermost box under the center wins; position stays visually put', () => {
    const dropped = { ...byId.b, position: { x: 160, y: 160 } };
    const out = reparentOnDrop(ns.map((n) => (n.id === 'b' ? dropped : n)), dropped);
    const b = out.find((n) => n.id === 'b')!;
    expect(b.parentId).toBe('inner');
    expect(b.position).toEqual({ x: 60, y: 60 });
    expect((b as N).extent).toBe('parent');
  });
  it('reparentOnDrop: outside every box detaches to the top level (absolute position)', () => {
    const out = reparentOnDrop(ns, byId.a.parentId ? { ...byId.a, position: { x: 2000, y: 2000 } } : byId.a);
    const a = out.find((n) => n.id === 'a')!;
    expect(a.parentId).toBeUndefined();
    expect(a.position).toEqual({ x: 2100, y: 2100 });
  });
  it('reparentOnDrop: a container never nests into itself or a descendant', () => {
    const out = reparentOnDrop(ns, byId.outer);
    expect(out.find((n) => n.id === 'outer')!.parentId).toBeUndefined();
  });
  it('reparentNode attaches/detaches keeping the absolute position; refuses cycles and unknown ids', () => {
    const attached = reparentNode(ns, 'b', 'inner').find((n) => n.id === 'b')!;
    expect(attached.parentId).toBe('inner');
    expect(attached.position).toEqual({ x: 800, y: -50 });
    const detached = reparentNode(ns, 'a', null).find((n) => n.id === 'a')!;
    expect(detached.parentId).toBeUndefined();
    expect(detached.position).toEqual({ x: 150, y: 150 });
    expect(reparentNode(ns, 'outer', 'inner')).toBe(ns);
    expect(reparentNode(ns, 'ghost', 'inner')).toBe(ns);
  });
  it('toParentRelative subtracts only the DIRECT parent\'s absolute position', () => {
    const laid = [{ id: 'G', position: { x: 10, y: 10 } }, { id: 'H', position: { x: 30, y: 40 } }, { id: 'n', position: { x: 50, y: 70 } }, { id: 'free', position: { x: 5, y: 5 } }];
    const parent: Record<string, string> = { H: 'G', n: 'H' };
    const out = toParentRelative(laid, (n) => parent[n.id]);
    expect(out.map((n) => [n.id, n.position, 'parentId' in n ? n.parentId : null])).toEqual([
      ['G', { x: 10, y: 10 }, null], ['H', { x: 20, y: 30 }, 'G'], ['n', { x: 20, y: 30 }, 'H'], ['free', { x: 5, y: 5 }, null],
    ]);
  });
  it('align: needs two selected non-group nodes; snaps each edge/center', () => {
    const sel = [s('p', 0, 0, undefined, true), s('q', 300, 100, undefined, true), g('box', 0, 0, 10, 10)];
    expect(alignBounds([sel[0]])).toBeNull();
    const b = alignBounds(sel)!;
    expect([...b.ids].sort()).toEqual(['p', 'q']);
    expect(alignedPosition(sel[1], 'left', b)).toEqual({ x: 0, y: 100 });
    expect(alignedPosition(sel[0], 'right', b)).toEqual({ x: 300, y: 0 });
    expect(alignedPosition(sel[0], 'hcenter', b)).toEqual({ x: 150, y: 0 });
    expect(alignedPosition(sel[1], 'top', b)).toEqual({ x: 300, y: 0 });
    expect(alignedPosition(sel[0], 'bottom', b)).toEqual({ x: 0, y: 100 });
    expect(alignedPosition(sel[0], 'vcenter', b)).toEqual({ x: 0, y: 50 });
    expect(alignedPosition(sel[0], 'diagonal', b)).toEqual({ x: 0, y: 0 });
  });
  it('distribute: needs three; evenly spaces between the outermost two', () => {
    const sel = [s('p', 0, 0, undefined, true), s('q', 10, 0, undefined, true), s('r', 100, 0, undefined, true)];
    expect(distributeCoordinates(sel.slice(0, 2), 'h')).toBeNull();
    expect(distributeCoordinates(sel, 'h')).toEqual({ key: 'x', pos: { p: 0, q: 50, r: 100 } });
    expect(distributeCoordinates(sel, 'v')).toEqual({ key: 'y', pos: { p: 0, q: 0, r: 0 } });
  });
});
