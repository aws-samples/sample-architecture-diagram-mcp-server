// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Prototype keys as author/host input. A plain-object table indexed by
// "__proto__", "constructor", "toString", "hasOwnProperty" or "valueOf" would
// answer with Object.prototype's members; every lookup in the core must treat
// them as unknown keys (the miss value: null, undefined, the default, "").
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as core from '@aws-sample-live-diagram/core';
import * as typedEntry from '@aws-sample-live-diagram/core/typed';
import * as reactEntry from '@aws-sample-live-diagram/core/react';
import { TypedDiagramView, DIAGRAM_VIEWS } from '@aws-sample-live-diagram/core/typed-react';
import { own, hasOwn, dict, dictOf, protoFree } from '#core-src/domain/own.ts';

const {
  toneColor, toneMeta, resolveToneColor, diagramToneColor, TONE_COLORS, TONE_META, DIAGRAM_TONES,
  resolveVariant, variantKey, GROUP_VARIANTS, DEFAULT_VARIANT,
  tr, i18n, ui, makeUi, makeLangLabel,
  iconForService, iconForShape, withServiceIcon,
  describeArchitecture, describeSequence, layoutSequence, layoutFlow, flowActiveSet,
  modalPricing, pricingForEnv, validateDiagram, resolveGroupsAndMembership, membershipFromNodes,
  radialLayout, lcaContainer, ancestorsOf, textValue, codeBlocksOf,
  absolutePosition, reparentNode, toParentRelative, distributeCoordinates,
  planCompoundLayout,
} = core;
const { getDiagramType, validateTypedDiagram, describeTypedDiagram, DIAGRAM_TYPES } = typedEntry;

const KEYS = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf'] as const;

describe('the own-property helper', () => {
  it('own / hasOwn / dict / dictOf / protoFree', () => {
    for (const k of KEYS) {
      expect(own({ a: 1 }, k), k).toBeUndefined();
      expect(hasOwn({ a: 1 }, k), k).toBe(false);
      expect(dict<number>()[k], k).toBeUndefined();
      expect(protoFree({ a: 1 } as Record<string, number>)[k], k).toBeUndefined();
      const d = dictOf([[k, 7]]);
      expect(d[k], k).toBe(7);
      expect(Object.keys(d)).toEqual([k]);
    }
    expect(own({ a: 1 }, 'a')).toBe(1);
    expect(own(null, 'a')).toBeUndefined();
    expect(protoFree({ a: 1 })).toEqual({ a: 1 });
  });
});

describe('every fixed lookup misses on prototype keys', () => {
  for (const k of KEYS) {
    it(`"${k}"`, () => {
      // tones
      expect(toneColor(k)).toBe(TONE_COLORS.accent);
      expect(toneMeta(k)).toBe(TONE_META.accent);
      expect(resolveToneColor(k)).toBe(TONE_COLORS.accent);
      expect(diagramToneColor(k)).toBe(DIAGRAM_TONES.info);
      // group variants (and aliases)
      expect(resolveVariant(k)).toBe(GROUP_VARIANTS[DEFAULT_VARIANT]);
      expect(variantKey(k)).toBe(DEFAULT_VARIANT);
      // i18n: author maps, the UI table, overrides, language labels
      expect(tr({ en: 'Hello' }, k)).toBe('Hello');
      expect(tr({ pt: 'Olá' }, 'en', k)).toBe('Olá');
      expect(i18n({ en: 'Hello' }, k)).toBe('Hello');
      expect(ui(k, 'en')).toBe('');
      expect(ui('restart', k)).toBe(ui('restart', 'en'));
      expect(makeUi({ restart: { en: 'R' } })(k, 'en')).toBe('');
      expect(makeUi({})('restart', k)).toBe(ui('restart', 'en'));
      expect(makeLangLabel({ pt: 'Português' })(k)).toBe(k.toUpperCase());
      // icons
      expect(iconForService(k)).toBeNull();
      expect(iconForShape(k)).toBeNull();
      expect(withServiceIcon({ service: k }).icon).toBeUndefined();
      // typed registry
      expect(getDiagramType(k)).toBeNull();
      expect(validateTypedDiagram({ kind: k }).valid).toBe(false);
      expect(describeTypedDiagram({ kind: k, title: 'T' })).toBe('T');
      // app values, costs
      expect(textValue({ en: 'x' }, {}, {}, k)).toBe('x');
      expect(modalPricing({ pricingByEnv: { prod: [['a', 'b']] } }, k)).toBeUndefined();
      expect(pricingForEnv({ prod: { a: 1 } }, k)).toEqual({ a: 1 });
      // code blocks: a file named "x.<key>" is not a language
      const blocks = codeBlocksOf({ code: 'x = 1', codeLabel: `file.${k}` });
      if (blocks) for (const b of blocks) expect(typeof b.lang === 'string' || b.lang === undefined, k).toBe(true);
    });
  }
});

describe('id maps built from author ids treat prototype keys as ordinary ids', () => {
  for (const k of KEYS) {
    it(`"${k}" as an id`, () => {
      // a11y: an unknown endpoint prints its id, never a function
      const a = describeArchitecture({ services: [{ id: 'a', service: 'AWS Lambda' }], connections: [{ id: 'c', source: 'a', target: k }] });
      expect(a).toContain(`→ ${k}`);
      expect(a).not.toMatch(/function|\[object/);
      const s = describeSequence({ participants: [{ id: 'a', label: 'A' }], events: [{ kind: 'message', id: 'm', from: 'a', to: k, label: 'x' }] });
      expect(s).not.toMatch(/function|\[object/);
      // membership + layout primitives
      const { membership } = resolveGroupsAndMembership([{ id: k, service: 'AWS Lambda', parentId: 'g' }, { id: 'b', service: 'AWS Lambda' }], [{ id: 'g' }]);
      expect(membership[k]).toBe('g');
      expect(Object.keys(membership)).toEqual([k]);
      expect(membershipFromNodes([{ id: k, type: 'aws', parentId: 'g', position: { x: 0, y: 0 }, data: {} }] as never)[k]).toBe('g');
      const byId = new Map([['g', { id: 'g' }]]);
      expect(ancestorsOf('x', {}, byId)).toEqual([]);
      expect(lcaContainer(k, 'x', {}, byId)).toBeNull();
      const radial = radialLayout([{ id: 'h' }, { id: 'x' }], [{ source: 'h', target: k }, { source: 'h', target: 'x' }]);
      expect(radial.every((n) => Number.isFinite(n.position.x))).toBe(true);
      // schema: a parent cycle check that is not fooled
      expect(validateDiagram({ services: [], connections: [], groups: [{ id: 'g', parent: k }] }).errors.some((e) => /cycle/.test(e))).toBe(false);
      // compound layout: a service with such an id is a root service; an edge to it is planned
      const plan = planCompoundLayout([{ id: k }, { id: 'b' }], [{ id: 'e', source: 'b', target: k }], {}, {});
      expect(plan.graph.children!.map((c) => c.id)).toEqual([k, 'b']);
      expect(plan.graph.edges).toHaveLength(1);
      // flow layout (inlined into the HTML player)
      const L = layoutFlow({ nodes: [{ id: k, label: 'K' }, { id: 'b', label: 'B' }], edges: [{ id: 'e', from: k, to: 'b' }, { id: 'f', from: 'b', to: 'toString' === k ? 'valueOf' : 'toString' }] });
      expect(Number.isFinite(L.X[k]) && Number.isFinite(L.Y[k])).toBe(true);
      expect(L.layer.b).toBeGreaterThan(L.layer[k]);
      expect(L.edges.map((g) => g.id)).toEqual(['e']);
      expect([...flowActiveSet({ edges: [{ id: k, from: 'a', to: 'b' }] }, { edges: [k, 'constructor' === k ? 'valueOf' : 'constructor'] })!].sort()).toEqual(['a', 'b']);
      // sequence layout (inlined into the HTML player): tone tables and id maps
      const S = layoutSequence({ participants: [{ id: k, label: 'K' }, { id: 'b', label: 'B' }], events: [{ kind: 'message', id: k, from: k, to: 'b', label: 'x' }, { kind: 'message', id: 'm2', from: 'b', to: 'ghost', label: 'y' }], groups: [{ label: 'G', participants: [k], tone: k }] } as never, { tones: { info: '#000' } });
      expect(S.cx(0)).toBeLessThan(S.cx(1));
      expect(S.groupBoxes.every((g: { color?: unknown }) => typeof g.color !== 'function')).toBe(true);
      // editor ops
      const ns = [{ id: 'a', position: { x: 1, y: 2 }, parentId: k }];
      expect(absolutePosition(ns[0], Object.fromEntries(ns.map((n) => [n.id, n])))).toEqual({ x: 1, y: 2 });
      expect(reparentNode(ns, 'a', k).find((n) => n.id === 'a')!.position).toEqual({ x: 1, y: 2 });
      expect(toParentRelative([{ id: 'n', position: { x: 5, y: 5 } }], () => k)[0].position).toEqual({ x: 5, y: 5 });
      expect(distributeCoordinates([{ id: k, position: { x: 0, y: 0 }, selected: true }, { id: 'b', position: { x: 5, y: 0 }, selected: true }, { id: 'c', position: { x: 10, y: 0 }, selected: true }], 'h')!.pos[k]).toBe(0);
    });
  }
});

describe('React lookups on prototype keys', () => {
  const render = (el: React.ReactElement) => renderToStaticMarkup(el);
  for (const k of KEYS) {
    it(`"${k}"`, () => {
      expect(render(React.createElement(TypedDiagramView, { doc: { kind: k } }))).toContain('Tipo de diagrama não suportado');
      expect(reactEntry.getRegisteredComponent(k)).toBeUndefined();
      // A node category / tone / badge named like a prototype member renders with the defaults.
      expect(() => render(React.createElement(reactEntry.FlowPlayer, { flow: { type: k, nodes: [{ id: 'a', label: 'A', tone: k }], edges: [], steps: [{ nodes: ['a'], tone: k, badge: k }] } as never }))).not.toThrow();
      expect(() => render(React.createElement(reactEntry.SequencePlayer, { seq: { participants: [{ id: 'a', label: 'A' }], events: [{ kind: 'message', id: 'm', from: 'a', to: 'a', label: 'x', tone: k, badge: k }] } as never }))).not.toThrow();
      expect(render(React.createElement(reactEntry.AppShell, { app: { pages: [{ id: 'p', label: 'P', components: [{ component: 'page.kpis', props: { items: [{ label: 'x', value: 1, tone: k }] } }] }] } }))).not.toMatch(/function|native code/);
    });
  }
});

describe('every exported table and registry misses on prototype keys', () => {
  // Plain-object tables exported by the entries (functions, arrays, Sets, Maps excluded).
  const tables = Object.entries({ ...core, ...typedEntry, ...reactEntry, DIAGRAM_VIEWS })
    .filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Set) && !(v instanceof Map) && Object.getPrototypeOf(v) === Object.prototype);
  it('finds the tables', () => {
    const names = tables.map(([n]) => n);
    for (const n of ['TONE_COLORS', 'TONE_META', 'DIAGRAM_TONES', 'PLAYER_TONES', 'GROUP_VARIANTS', 'VARIANT_ALIASES', 'UI_STRINGS', 'LANG_LABEL', 'SERVICE_ICONS', 'SHAPE_ICONS', 'DIAGRAM_TYPES', 'DIAGRAM_VIEWS', 'DIAGRAM_THEME', 'PLAYER_THEME']) expect(names, n).toContain(n);
  });
  for (const [name, table] of tables) {
    it(`${name}: no table carries a prototype key, and an own-property lookup misses`, () => {
      for (const k of KEYS) {
        expect(hasOwn(table, k), `${name}.${k}`).toBe(false);
        expect(own(table as Record<string, unknown>, k), `${name}.${k}`).toBeUndefined();
      }
    });
  }
  it('the lookup functions over those tables return their miss value', () => {
    const lookups: [string, (k: string) => unknown, unknown][] = [
      ['toneColor', toneColor, TONE_COLORS.accent], ['toneMeta', toneMeta, TONE_META.accent], ['diagramToneColor', (k) => diagramToneColor(k), DIAGRAM_TONES.info],
      ['resolveVariant', resolveVariant, GROUP_VARIANTS[DEFAULT_VARIANT]], ['variantKey', variantKey, DEFAULT_VARIANT],
      ['ui', (k) => ui(k, 'en'), ''], ['makeLangLabel', (k) => makeLangLabel()(k), k => k],
      ['iconForService', iconForService, null], ['iconForShape', iconForShape, null],
      ['getDiagramType', getDiagramType, null], ['getRegisteredComponent', reactEntry.getRegisteredComponent, undefined],
    ];
    for (const [name, fn, miss] of lookups) for (const k of KEYS) {
      const want = typeof miss === 'function' ? k.toUpperCase() : miss;
      expect(fn(k), `${name}(${k})`).toEqual(want);
    }
    expect(Object.keys(DIAGRAM_TYPES)).toHaveLength(15);
  });
});
