// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The contracts are generated from the same definitions the server registers
// (the tool registry → server/adapters/inbound/mcp/contracts.ts); these tests prove the three copies agree
// — committed schema/, what the running server announces and serves — and
// that real specs validate against them.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync } from 'fs';
import { join, resolve, relative } from 'path';
import { tmpdir } from 'os';
import Ajv2020 from 'ajv/dist/2020.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SCHEMA_BASE, documentContracts } from '#adapters/inbound/mcp/contracts.ts';
import { contracts } from './support/app';

const schemaFiles = () => contracts.files();
const schemaNames = () => contracts.names();

const ROOT = resolve(__dirname, '..');
const SCHEMA = join(ROOT, 'schema');
const files: Record<string, string> = schemaFiles();
const list = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? list(join(d, e.name)) : [join(d, e.name)]);

let client: Client;
let tmp: string;
beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'contracts-'));
  client = new Client({ name: 'test', version: '1' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(ROOT, 'mcp-server.js')], stderr: 'ignore' }));
});
afterAll(async () => { await client.close(); rmSync(tmp, { recursive: true, force: true }); });

describe('schema/ is in sync with the definitions', () => {
  it('every generated file is committed with the same content, and nothing else is there', () => {
    const committed = list(SCHEMA).map(f => relative(SCHEMA, f));
    expect(committed.sort()).toEqual(Object.keys(files).sort());
    for (const [f, c] of Object.entries(files)) expect(readFileSync(join(SCHEMA, f), 'utf-8'), f).toBe(c);
  });
});

describe('the running server serves the same contracts', () => {
  it('tools/list input schemas equal schema/tools/*.input.schema.json', async () => {
    const { tools } = await client.listTools();
    expect(tools.map(t => t.name).sort()).toEqual(Object.keys(files).filter(f => f.startsWith('tools/')).map(f => f.slice(6, -'.input.schema.json'.length)).sort());
    for (const t of tools) {
      const { $id, title, ...file } = JSON.parse(files[`tools/${t.name}.input.schema.json`]);
      expect($id).toBe(`${SCHEMA_BASE}tools/${t.name}.input.schema.json`);
      expect(title).toBe(`${t.name} input`);
      expect(t.inputSchema, t.name).toEqual(file);
    }
  });
  it('resources/list has every contract and resources/read returns the file content', async () => {
    const { resources } = await client.listResources();
    const uris = resources.map(r => r.uri).sort();
    expect(uris).toEqual(schemaNames().map((n: string) => `schema://${n}`).sort());
    for (const name of ['diagram', 'typed/er', 'layout', 'components', 'openapi', 'tools/generate_html_diagram']) {
      const r = await client.readResource({ uri: `schema://${name}` });
      const key = name === 'openapi' ? 'openapi.yaml' : name === 'components' ? 'component-catalog.schema.json' : name.startsWith('tools/') ? `${name}.input.schema.json` : `${name}.schema.json`;
      expect((r.contents[0] as { text: string }).text, name).toBe(files[key]);
    }
  });
  it('get_schema returns the same content', async () => {
    const r = await client.callTool({ name: 'get_schema', arguments: { name: 'diagram' } });
    expect((r.content as { text: string }[])[0].text).toBe(files['diagram.schema.json']);
    const names = JSON.parse((await client.callTool({ name: 'get_schema', arguments: { name: 'list' } }) as { content: { text: string }[] }).content[0].text);
    expect(names).toEqual(schemaNames());
  });
});

describe('specs validate against the generated schemas', () => {
  // The x-* annotations of the typed specs are declared as keywords so the
  // validator stays strict about everything else.
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false, strictTuples: false });
  const xKeys = new Set<string>();
  const collect = (v: unknown) => { if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (k.startsWith('x-')) xKeys.add(k); collect(x); } };
  const docs = documentContracts() as Record<string, object>;
  Object.values(docs).forEach(collect);
  for (const k of xKeys) ajv.addKeyword(k);
  for (const s of Object.values(docs)) ajv.addSchema(s);
  const validate = (id: string, doc: unknown) => {
    const v = ajv.getSchema(`${SCHEMA_BASE}${id}.schema.json`)!;
    return { ok: v(doc) as boolean, errors: v.errors };
  };
  const spec = (f: string) => { const s = JSON.parse(readFileSync(f, 'utf-8')); delete s.outputPath; return s; };

  it('examples/*.json: valid, except event-bus-radial (RADIAL is not a direction, the server rejects it too)', () => {
    for (const f of readdirSync(join(ROOT, 'examples')).filter(x => x.endsWith('.json'))) {
      const r = validate('diagram', spec(join(ROOT, 'examples', f)));
      expect(r.ok, `${f}: ${JSON.stringify(r.errors)}`).toBe(f !== 'event-bus-radial.json');
    }
  });
  it('the rich golden document and a spec.json written by the server validate (spec schema)', async () => {
    const rich = spec(join(__dirname, 'golden', 'specs', 'rich-document.json'));
    expect(validate('diagram', rich).ok).toBe(true);
    await client.callTool({ name: 'generate_html_diagram', arguments: { ...rich, outputPath: join(tmp, 'r.html') } });
    const written = JSON.parse(readFileSync(join(tmp, 'r.spec.json'), 'utf-8'));
    // No unresolvable URL by default (the $ids are identifiers, not a published location).
    expect(written.$schema).toBeUndefined();
    const r = validate('spec', written);
    expect(r.ok, JSON.stringify(r.errors)).toBe(true);
  });
  it('a typed tab is checked by its kind, and the layout/component schemas reject what the server rejects', () => {
    const base = { title: 't', services: [], connections: [] };
    const venn = { kind: 'venn', sets: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] };
    expect(validate('diagram', { ...base, tabs: [{ id: 'arch', kind: 'architecture' }, { id: 'v', kind: 'typed', diagram: venn }] }).ok).toBe(true);
    expect(validate('diagram', { ...base, tabs: [{ id: 'v', kind: 'typed', diagram: { kind: 'venn', sets: [] } }] }).ok).toBe(false);
    expect(validate('layout', { extends: 'cost', patch: [{ op: 'remove', slot: 'dock', component: 'dock.png' }] }).ok).toBe(true);
    expect(validate('layout', { theme: { light: { bg: 'red;}' } } }).ok).toBe(false);
    expect(validate('component-catalog', { dock: ['dock.cost', { component: 'dock.title', props: { width: 200 } }] }).ok).toBe(true);
    expect(validate('component-catalog', { dock: [{ component: 'dock.title', props: { width: 5 } }] }).ok).toBe(false);
    for (const t of ['workflow', 'dataflow', 'lifecycle']) {
      expect(validate(`flow-${t}`, { type: t, title: 'x', nodes: [{ id: 'a', label: 'A' }], edges: [] }).ok, t).toBe(true);
    }
  });
  it.skipIf(!process.env.GOLDEN_USER_SPEC)('a user spec (GOLDEN_USER_SPEC) validates', () => {
    const r = validate('diagram', spec(process.env.GOLDEN_USER_SPEC!));
    expect(r.ok, JSON.stringify(r.errors?.slice(0, 5))).toBe(true);
  });
  it('$refs between files are relative and resolve', () => {
    for (const s of Object.values(docs)) for (const m of JSON.stringify(s).matchAll(/"\$ref":"([^"#]+)/g)) {
      expect(m[1].startsWith('.'), m[1]).toBe(true);
    }
    expect(existsSync(join(SCHEMA, 'typed', 'er.schema.json'))).toBe(true);
  });
});
