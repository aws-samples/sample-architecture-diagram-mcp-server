// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// <name>.spec.json, render_from_spec, the layout tools and the CLI, through
// the real server (stdio) and process.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { execFileSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const ROOT = resolve(__dirname, '..');
const archDataOf = (html: string): { layout?: { dock: string[] }; title?: string } => JSON.parse(html.match(/id="arch-data"[^>]*>([\s\S]*?)<\/script>/)![1]);
const spec = JSON.parse(readFileSync(join(ROOT, 'examples', 'serverless-api.json'), 'utf-8'));
let tmp: string;
let client: Client;
const textOf = (r: { content: unknown }) => (r.content as { text: string }[]).map(c => c.text).join('\n');

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'rfs-'));
  mkdirSync(join(tmp, 'layouts'));
  const env = { ...process.env, DIAGRAM_LAYOUTS_DIR: join(tmp, 'layouts'), DIAGRAM_COMPONENTS_DIR: join(tmp, 'none') } as Record<string, string>;
  client = new Client({ name: 'test', version: '1' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(ROOT, 'mcp-server.js')], env, stderr: 'ignore' }));
});
afterAll(async () => { await client.close(); rmSync(tmp, { recursive: true, force: true }); });

describe('spec.json', () => {
  it('is written next to the HTML by default and re-renders to the same page', async () => {
    const out = join(tmp, 'a.html');
    await client.callTool({ name: 'generate_html_diagram', arguments: { ...spec, outputPath: out } });
    const specPath = join(tmp, 'a.spec.json');
    expect(existsSync(specPath)).toBe(true);
    const r = await client.callTool({ name: 'render_from_spec', arguments: { specPath, outPath: join(tmp, 'b.html') } });
    expect(textOf(r)).toContain('Interactive diagram saved');
    expect(readFileSync(join(tmp, 'b.html'), 'utf-8')).toBe(readFileSync(out, 'utf-8'));
  });
  it('writeSpec:false skips it', async () => {
    await client.callTool({ name: 'generate_html_diagram', arguments: { ...spec, outputPath: join(tmp, 'c.html'), writeSpec: false } });
    expect(existsSync(join(tmp, 'c.spec.json'))).toBe(false);
    expect(existsSync(join(tmp, 'c.json'))).toBe(true);
  });
  it('an invalid spec is reported, not rendered', async () => {
    writeFileSync(join(tmp, 'bad.spec.json'), JSON.stringify({ title: 't', services: [{ id: 'x' }], connections: [] }));
    const r = await client.callTool({ name: 'render_from_spec', arguments: { specPath: join(tmp, 'bad.spec.json') } });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/Invalid diagram spec[\s\S]*services\.0/);
  });
});

describe('layout tools', () => {
  it('list/describe components, create/update/validate/list layouts, preview, render with a layout', async () => {
    expect(textOf(await client.callTool({ name: 'list_components', arguments: { slot: 'dock' } }))).toContain('dock.cost');
    expect(JSON.parse(textOf(await client.callTool({ name: 'describe_component', arguments: { id: 'dock.title' } }))).props.type).toBe('object');
    const created = await client.callTool({ name: 'create_layout', arguments: { layout: { name: 'lean', extends: 'cost', patch: [{ op: 'remove', slot: 'dock', component: 'dock.shareCard' }] } } });
    expect(created.isError).toBeFalsy();
    await client.callTool({ name: 'update_layout', arguments: { name: 'lean', patch: [{ op: 'remove', slot: 'dock', component: 'dock.png' }] } });
    const v = JSON.parse(textOf(await client.callTool({ name: 'validate_layout', arguments: { layout: 'lean' } })));
    expect(v.ok).toBe(true);
    expect(v.slots.dock).not.toContain('dock.png');
    expect(textOf(await client.callTool({ name: 'list_layouts', arguments: {} }))).toContain('"lean"');
    const prev = await client.callTool({ name: 'preview_layout', arguments: { layout: 'lean', outputPath: join(tmp, 'prev.html') } });
    expect(textOf(prev)).toContain('Preview saved');
    const out = join(tmp, 'l.html');
    const r = await client.callTool({ name: 'generate_html_diagram', arguments: { ...spec, layout: 'lean', outputPath: out } });
    expect(textOf(r)).toContain('(layout: lean)');
    expect(archDataOf(readFileSync(out, 'utf-8')).layout!.dock).not.toContain('dock.shareCard');
    expect(JSON.parse(readFileSync(join(tmp, 'l.spec.json'), 'utf-8')).layout).toBe('lean');
    const bad = await client.callTool({ name: 'create_layout', arguments: { layout: { name: 'cost' } } });
    expect(bad.isError).toBe(true);
    const nb = await client.callTool({ name: 'build_bundle', arguments: { layout: 'lean' } });
    expect(textOf(nb)).toContain('No custom components');
  });
});

describe('CLI', () => {
  const env = () => ({ ...process.env, DIAGRAM_LAYOUTS_DIR: join(tmp, 'layouts') });
  it('render writes html, elements json and spec json; layout list works', () => {
    const specFile = join(tmp, 'cli.json');
    writeFileSync(specFile, JSON.stringify(spec));
    const out = execFileSync(process.execPath, [join(ROOT, 'mcp-server.js'), 'render', specFile, '--layout', 'cost'], { env: env(), encoding: 'utf-8' });
    expect(out).toContain('(layout: cost)');
    for (const f of ['cli.html', 'cli.json', 'cli.spec.json']) expect(existsSync(join(tmp, f))).toBe(true);
    expect(execFileSync(process.execPath, [join(ROOT, 'mcp-server.js'), 'layout', 'list'], { env: env(), encoding: 'utf-8' })).toContain('"cost"');
  });
  it('fails with a message and exit code 1 on a bad command', () => {
    let code = 0;
    try { execFileSync(process.execPath, [join(ROOT, 'mcp-server.js'), 'layout', 'validate', 'nope'], { env: env(), encoding: 'utf-8', stdio: 'pipe' }); } catch (e) { code = (e as { status: number }).status; }
    expect(code).toBe(1);
  });
});
