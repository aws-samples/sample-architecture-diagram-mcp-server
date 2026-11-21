// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Compatibility guard: without any of the newer optional fields, the MCP tools
// and the core components must produce what the release before them produced.
// Fixtures were captured from the commit before the cost/layout work:
//   node test/golden/golden.mjs <base-root> test/golden/fixtures/examples.json test/golden/specs/rich-document.json
//   GOLDEN_CAPTURE=1 GOLDEN_ROOT=<base-root> npx vitest run test/golden.test.ts
// Optional: GOLDEN_USER_SPEC=<spec.json> GOLDEN_USER_FIXTURE=<captured.json> also
// checks a spec of your own (captured the same way) — kept out of the repo.
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve, basename } from 'path';
// @ts-expect-error — plain JS module, no types
import { renderExamples, renderComponents } from './golden/golden.mjs';
import { iconRoot, hasIcons } from './support/deps';

const ROOT = resolve(__dirname, '..');
const FIX = join(__dirname, 'golden', 'fixtures');
const ICONS_PRESENT = hasIcons(iconRoot());
const CAPTURE = !!process.env.GOLDEN_CAPTURE;

// Fields the newer releases ADD on request; a spec that carries them (only the
// user spec does) is compared with them stripped, since the base dropped them.
interface ArchData { costUrl?: string; costLabel?: unknown; steps?: { costUrl?: string; costLabel?: unknown }[]; services?: { icon?: string }[] }
interface Rendered { archData?: ArchData; iconKeys?: string[]; text: string; isError?: boolean }
const strip = (d: ArchData | undefined): ArchData => {
  const out: ArchData = JSON.parse(JSON.stringify(d ?? {}));
  delete out.costUrl; delete out.costLabel;
  for (const s of out.steps || []) { delete s.costUrl; delete s.costLabel; }
  if (!ICONS_PRESENT) for (const s of out.services || []) delete s.icon;
  return out;
};
const textOf = (t: string) => t.replace(/\n\n⚠️ The AWS Architecture Icons are not installed[\s\S]*$/, '');

function compareExamples(base: Record<string, Rendered>, now: Record<string, Rendered>, { stripNew = false } = {}) {
  for (const [name, b] of Object.entries(base)) {
    if (name === '__tools') continue;
    const n = now[name];
    expect(n, `${name} rendered`).toBeTruthy();
    if (!b.archData) { expect(n.archData, `${name} still rejected`).toBeUndefined(); expect(n.text).toBe(b.text); continue; }
    const norm = stripNew ? strip : (d: ArchData | undefined) => (ICONS_PRESENT ? d : strip(d));
    expect(norm(n.archData), `${name} arch-data`).toEqual(norm(b.archData));
    if (ICONS_PRESENT) expect(n.iconKeys, `${name} inlined icons`).toEqual(b.iconKeys);
    expect(textOf(n.text), `${name} tool output`).toBe(textOf(b.text));
  }
}

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
type JsonObj = { [k: string]: Json };
const isObj = (v: Json | undefined): v is JsonObj => !!v && typeof v === 'object' && !Array.isArray(v);

// A JSON Schema `now` accepts every input `base` accepted and requires nothing
// new: same keywords and values, except that objects may gain properties that
// are not required. Returns the incompatibilities found (empty = compatible).
function compatible(base: Json, now: Json | undefined, path: string): string[] {
  if (!isObj(base)) return JSON.stringify(base) === JSON.stringify(now) ? [] : [`${path}: changed`];
  if (!isObj(now)) return [`${path}: removed`];
  const out: string[] = [];
  for (const [k, v] of Object.entries(base)) {
    if (k === 'properties' && isObj(v)) {
      const np = isObj(now.properties) ? now.properties : {};
      for (const [p, d] of Object.entries(v)) out.push(...compatible(d, np[p], `${path}.${p}`));
    } else if (k === 'required') {
      const a = JSON.stringify([...(Array.isArray(v) ? v : [])].sort());
      const b = JSON.stringify([...(Array.isArray(now.required) ? now.required : [])].sort());
      if (a !== b) out.push(`${path}: required ${a} → ${b}`);
    } else if (Array.isArray(v)) {
      const n = now[k];
      if (!Array.isArray(n) || n.length !== v.length) out.push(`${path}.${k}: changed`);
      else v.forEach((item, i) => out.push(...compatible(item, n[i], `${path}.${k}[${i}]`)));
    } else {
      out.push(...compatible(v, now[k], `${path}.${k}`));
    }
  }
  if (!('required' in base) && Array.isArray(now.required) && now.required.length) out.push(`${path}: new required ${JSON.stringify(now.required)}`);
  return out;
}

describe.skipIf(CAPTURE)('golden: MCP tools without new fields', () => {
  it('example specs, a rich document and the builder path render as before', async () => {
    const base = JSON.parse(readFileSync(join(FIX, 'examples.json'), 'utf-8')).examples;
    const now = await renderExamples(ROOT, [join(__dirname, 'golden', 'specs', 'rich-document.json')]);
    compareExamples(base, now);
  }, 60000);

  it('no tool was removed, and existing tool inputs only gained optional fields', async () => {
    const base = JSON.parse(readFileSync(join(FIX, 'examples.json'), 'utf-8')).examples.__tools;
    const now = (await renderExamples(ROOT, [])).__tools;
    for (const [tool, schema] of Object.entries<Json>(base)) {
      expect(now[tool], `tool ${tool}`).toBeTruthy();
      expect(compatible(schema, now[tool], tool)).toEqual([]);
    }
  }, 60000);

  it.skipIf(!process.env.GOLDEN_USER_SPEC)('a user spec renders as before (new fields stripped)', async () => {
    const spec = process.env.GOLDEN_USER_SPEC!;
    const base = JSON.parse(readFileSync(process.env.GOLDEN_USER_FIXTURE!, 'utf-8')).examples;
    const now = await renderExamples(ROOT, [spec]);
    const name = basename(spec);
    compareExamples({ [name]: base[name] }, now, { stripNew: true });
  }, 60000);
});

describe('golden: core components', () => {
  it(CAPTURE ? 'captures component markup from GOLDEN_ROOT' : 'render the same markup with the same props', async () => {
    const root = CAPTURE ? resolve(process.env.GOLDEN_ROOT!) : ROOT;
    const now = await renderComponents(root);
    const file = join(FIX, 'components.json');
    if (CAPTURE) { writeFileSync(file, JSON.stringify(now, null, 2) + '\n'); return; }
    expect(existsSync(file)).toBe(true);
    const base = JSON.parse(readFileSync(file, 'utf-8'));
    for (const k of Object.keys(base)) expect(now[k], k).toBe(base[k]);
  });
});
