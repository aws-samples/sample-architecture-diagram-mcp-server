// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Every typed-diagram spec (domain/typed) against its own contract: the starter
// document validates and describes itself, steps are a count, and each kind
// rejects the classic mistakes its schema / unique / refs declare. Plus the
// generic checkers the specs share.
import { describe, it, expect } from 'vitest';
import {
  DIAGRAM_TYPES, TYPED_KINDS, getDiagramType, validateTypedDiagram, describeTypedDiagram, exportTypeContracts,
  valuesAt, checkRefs, checkUnique, walkSchema, validateWithSpec,
} from '@aws-sample-live-diagram/core/typed';
import type { JsonSchema, TypedDocBase } from '@aws-sample-live-diagram/core/typed';

type Obj = Record<string, unknown>;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

// Duplicate the first element of the innermost array on `path` ('a[].b[].id').
function duplicateAt(doc: unknown, path: string): boolean {
  const segs = path.split('.');
  const last = segs.map((s, i) => (s.endsWith('[]') ? i : -1)).filter((i) => i >= 0).pop();
  if (last == null) return false;
  const walk = (v: unknown, i: number): boolean => {
    if (!v || typeof v !== 'object') return false;
    const key = segs[i].replace(/\[\]$/, '');
    const x = key ? (v as Obj)[key] : v;
    if (i === last) { if (Array.isArray(x) && x.length) { x.push(clone(x[0])); return true; } return false; }
    if (segs[i].endsWith('[]')) return Array.isArray(x) && x.some((it) => walk(it, i + 1));
    return walk(x, i + 1);
  };
  return walk(doc, 0);
}
// Point the first value at `path` to an id that exists nowhere.
function breakRefAt(doc: unknown, path: string): boolean {
  const segs = path.split('.');
  const walk = (v: unknown, i: number): boolean => {
    if (!v || typeof v !== 'object') return false;
    const arr = segs[i].endsWith('[]'), key = segs[i].replace(/\[\]$/, '');
    const x = (v as Obj)[key];
    if (i === segs.length - 1) {
      if (arr) { if (Array.isArray(x)) { x.push('zz-missing'); return true; } return false; }
      if (x == null) return false;
      (v as Obj)[key] = 'zz-missing'; return true;
    }
    if (arr) return Array.isArray(x) && x.some((it) => walk(it, i + 1));
    return walk(x, i + 1);
  };
  return walk(doc, 0);
}

describe('the typed registry', () => {
  it('lists 15 kinds, each registered under its own kind', () => {
    expect(TYPED_KINDS).toHaveLength(15);
    for (const k of TYPED_KINDS) { expect(DIAGRAM_TYPES[k].kind).toBe(k); expect(getDiagramType(k)).toBe(DIAGRAM_TYPES[k]); }
    expect(getDiagramType('nope')).toBeNull();
    expect(getDiagramType(undefined)).toBeNull();
  });
  it('unknown kinds fail validation; describe never throws on garbage', () => {
    expect(validateTypedDiagram({ kind: 'nope' })).toEqual({ valid: false, errors: ['kind: tipo de diagrama desconhecido "nope"'] });
    expect(validateTypedDiagram(null).valid).toBe(false);
    for (const k of TYPED_KINDS) expect(typeof describeTypedDiagram({ kind: k, title: 'T' })).toBe('string');
    expect(describeTypedDiagram({ kind: 'nope', title: 'Fallback' })).toBe('Fallback');
    expect(describeTypedDiagram(42)).toBe('');
  });
  it('exportTypeContracts is plain JSON, one entry per kind, mirroring the specs', () => {
    const c = exportTypeContracts();
    expect(Object.keys(c)).toEqual(TYPED_KINDS);
    expect(JSON.parse(JSON.stringify(c))).toEqual(c);
    for (const k of TYPED_KINDS) expect(c[k]).toEqual({ label: DIAGRAM_TYPES[k].label, description: DIAGRAM_TYPES[k].description, category: DIAGRAM_TYPES[k].category, schema: DIAGRAM_TYPES[k].schema, unique: DIAGRAM_TYPES[k].unique || [], refs: DIAGRAM_TYPES[k].refs || [] });
  });
});

for (const kind of TYPED_KINDS) {
  const spec = DIAGRAM_TYPES[kind];
  describe(`typed spec: ${kind}`, () => {
    it('declares label, description, category and an object schema', () => {
      expect(spec.label).toBeTruthy();
      expect(spec.description).toBeTruthy();
      expect(['process', 'structure', 'planning', 'data', 'software', 'business']).toContain(spec.category);
      expect(spec.schema.type).toBe('object');
    });
    it('empty() is a valid document of the kind, with the given title', () => {
      const doc = spec.empty('Título X') as TypedDocBase;
      expect(doc.kind).toBe(kind);
      expect(doc.title).toBe('Título X');
      expect(validateTypedDiagram(doc)).toEqual({ valid: true, errors: [] });
      expect(validateTypedDiagram(spec.empty())).toEqual({ valid: true, errors: [] });
      expect(spec.empty()).toEqual(spec.empty());
    });
    it('samples (if any) validate', () => {
      for (const s of spec.samples || []) expect(validateTypedDiagram({ ...s, kind }).valid).toBe(true);
    });
    it('describe() is a non-empty plain-text summary; steps() a count', () => {
      const doc = spec.empty();
      const d = describeTypedDiagram(doc);
      expect(d.length).toBeGreaterThan(10);
      expect(d).not.toMatch(/undefined|\[object Object\]/);
      const n = spec.steps(doc);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
    });
    it('rejects an unknown top-level property', () => {
      if (spec.schema.additionalProperties === true) return;
      const r = validateTypedDiagram({ ...clone(spec.empty()), zzUnknown: 1 });
      expect(r.valid).toBe(false);
      expect(r.errors).toContain('diagram.zzUnknown: propriedade desconhecida');
    });
    it('rejects a missing required field and a wrongly typed one', () => {
      for (const req of spec.schema.required || []) {
        const doc = clone(spec.empty()) as Obj;
        delete doc[req];
        const r = validateTypedDiagram(doc);
        expect(r.valid, req).toBe(false);
        expect(r.errors, req).toContain(`diagram.${req}: obrigatório`);
      }
      const typed = (spec.schema.required || []).find((k) => { const t = spec.schema.properties?.[k]?.type; return t && t !== 'number' && t !== 'integer'; });
      if (typed) {
        const doc = { ...clone(spec.empty()), [typed]: 42 };
        expect(validateTypedDiagram(doc).valid).toBe(false);
      }
    });
    it('rejects duplicate ids where the spec wants them unique', () => {
      for (const path of spec.unique || []) {
        const doc = clone(spec.empty());
        if (!duplicateAt(doc, path)) continue;
        const r = validateTypedDiagram(doc);
        expect(r.valid, path).toBe(false);
        expect(r.errors.some((e) => e.startsWith(`${path}: id duplicado`)), path).toBe(true);
      }
    });
    it('rejects dangling references', () => {
      let tested = 0;
      for (const ref of spec.refs || []) {
        const doc = clone(spec.empty());
        if (!breakRefAt(doc, ref.from)) continue;
        tested++;
        const r = validateTypedDiagram(doc);
        expect(r.valid, ref.from).toBe(false);
        expect(r.errors, ref.from).toContain(`${ref.from}: "zz-missing" não existe em ${ref.to}`);
      }
      if ((spec.refs || []).length) expect(tested).toBeGreaterThan(0);
    });
    it('a non-object document is refused', () => {
      expect(validateWithSpec(spec, 'nope')).toEqual({ valid: false, errors: ['diagram: must be an object'] });
    });
  });
}

describe('the generic checkers', () => {
  const doc = { a: { b: 1 }, items: [{ id: 'x', deps: ['y'] }, { id: 'y', deps: [] }, { id: 'x' }], z: null };
  it('valuesAt walks dotted paths and [] arrays', () => {
    expect(valuesAt(doc, 'a.b')).toEqual([1]);
    expect(valuesAt(doc, 'items[].id')).toEqual(['x', 'y', 'x']);
    expect(valuesAt(doc, 'items[].deps[]')).toEqual(['y']);
    expect(valuesAt(doc, 'nope.deeper')).toEqual([]);
    expect(valuesAt(doc, 'z.q')).toEqual([]);
  });
  it('checkUnique and checkRefs', () => {
    expect(checkUnique(doc, ['items[].id'])).toEqual(['items[].id: id duplicado "x"']);
    expect(checkRefs(doc, [{ from: 'items[].deps[]', to: 'items[].id' }])).toEqual([]);
    expect(checkRefs({ ...doc, items: [{ id: 'x', deps: ['q', ''] }] }, [{ from: 'items[].deps[]', to: 'items[].id' }])).toEqual(['items[].deps[]: "q" não existe em items[].id']);
  });
  it('walkSchema: types, enums, bounds, required, additionalProperties, anyOf', () => {
    const schema: JsonSchema = {
      type: 'object', required: ['n'], additionalProperties: false,
      properties: {
        n: { type: 'integer' }, s: { type: 'string', enum: ['a', 'b'] }, l: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'number' } },
        u: { anyOf: [{ type: 'string' }, { type: 'number' }] }, o: { type: 'object', additionalProperties: true, properties: {} },
      },
    };
    const errs = (v: unknown) => { const e: string[] = []; walkSchema(schema, v, 'd', e); return e; };
    expect(errs({ n: 1, s: 'a', l: [1], u: 'x', o: { free: 1 } })).toEqual([]);
    expect(errs({ n: 1.5 })).toEqual(['d.n: esperado integer']);
    expect(errs({ n: 1, s: 'c' })).toEqual(['d.s: deve ser um de a, b']);
    expect(errs({ n: 1, l: [] })).toEqual(['d.l: mínimo 1 item(ns)']);
    expect(errs({ n: 1, l: [1, 2, 3] })).toEqual(['d.l: máximo 2 itens']);
    expect(errs({ n: 1, l: ['x'] })).toEqual(['d.l[0]: esperado number']);
    expect(errs({ n: 1, u: true })).toEqual(['d.u: formato inválido']);
    expect(errs({})).toEqual(['d.n: obrigatório']);
    expect(errs({ n: 1, extra: 1 })).toEqual(['d.extra: propriedade desconhecida']);
    expect(errs({ n: Number.NaN })).toEqual(['d.n: esperado integer']);
  });
  it('a custom check() adds its messages', () => {
    const r = validateWithSpec({ schema: { type: 'object', additionalProperties: true }, check: () => ['custom: nope'] }, {});
    expect(r).toEqual({ valid: false, errors: ['custom: nope'] });
  });
});
