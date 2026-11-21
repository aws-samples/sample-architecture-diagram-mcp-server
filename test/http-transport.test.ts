// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Streamable-HTTP mode (AgentCore Runtime): loopback by default, stateless POST
// /mcp, the non-MCP routes refused — and the sandbox: every path a caller
// names stays inside MCP_OUTPUT_DIR (relative paths resolve there; absolute
// paths outside, `..` and escaping symlinks are rejected, on reads too), and a
// result embeds exactly the files the tool wrote. stdio keeps absolute paths.
import { describe, it, expect, afterAll } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { Server } from 'http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { startHttpServer, HTTP_DEFAULTS, embedWrittenFiles, httpOptionsFromEnv } from '#adapters/inbound/mcp/http.ts';
import { createMcpServer } from '#adapters/inbound/mcp/server.ts';
import { StderrLogger } from '#adapters/outbound/index.ts';
import { remoteLoads } from '#domain/shared/self-contained.ts';
import { appFor } from './support/app';

const ROOT = join(__dirname, '..');
const servers: Server[] = [];
const temps: string[] = [];
afterAll(() => { servers.forEach(s => s.close()); temps.forEach(d => rmSync(d, { recursive: true, force: true })); });
const tmp = (p: string) => { const d = realpathSync(mkdtempSync(join(tmpdir(), p))); temps.push(d); return d; };

/** An HTTP server over a sandbox rooted at `root`. */
async function start(root: string, opts: { host?: string; port?: number } = { port: 0 }) {
  const { registry, pkg } = appFor({}, root);
  const { server, url } = await startHttpServer({ createServer: () => createMcpServer({ registry, pkg, embed: embedWrittenFiles }), logger: new StderrLogger() }, opts);
  servers.push(server);
  return { server, url, pkg };
}

type Content = { type: string; text?: string; resource?: { uri: string; mimeType: string; text?: string; blob?: string } };
const rpc = async (url: string, method: string, params: unknown, id = 1) => {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
  return { status: r.status, body: await r.json() };
};
const call = async (url: string, name: string, args: Record<string, unknown>) => (await rpc(url, 'tools/call', { name, arguments: args }, 3)).body.result as { content: Content[]; isError?: boolean };
const diagram = (outputPath: string, extra: Record<string, unknown> = {}) => ({ title: 'HTTP', services: [{ id: 'a', service: 'AWS Lambda', category: 'compute' }], connections: [], outputPath, ...extra });

describe('HTTP transport', () => {
  it('binds to 127.0.0.1 unless MCP_HTTP_HOST says otherwise', async () => {
    expect(HTTP_DEFAULTS.host).toBe('127.0.0.1');
    expect(httpOptionsFromEnv({})).toEqual({ host: '127.0.0.1', port: 8000 });
    expect(httpOptionsFromEnv({ MCP_HTTP_HOST: '0.0.0.0', MCP_HTTP_PORT: '9000' })).toEqual({ host: '0.0.0.0', port: 9000 });
    const { server, url } = await start(tmp('ld-http-'));
    expect((server.address() as { address: string }).address).toBe('127.0.0.1');
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
  });

  it('stateless: initialize + tools/list + a relative render whose result embeds exactly the files it wrote', async () => {
    const root = tmp('ld-http-');
    // A stale neighbour with a sidecar-like name: the old transport guessed names and would embed it.
    mkdirSync(join(root, 'out'));
    writeFileSync(join(root, 'out', 'd.drawio'), '<mxfile/>');
    const { url, pkg } = await start(root);
    const init = await rpc(url, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '1' } });
    expect(init.status).toBe(200);
    expect(init.body.result.serverInfo.name).toBe(pkg.name);
    const list = await rpc(url, 'tools/list', {}, 2);
    expect(list.body.result.tools).toHaveLength(57);
    const res = await call(url, 'generate_html_diagram', diagram('out/d.html'));
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain('Interactive diagram saved: out/d.html');
    expect(existsSync(join(root, 'out', 'd.html'))).toBe(true);
    const embedded = res.content.filter(c => c.type === 'resource').map(c => c.resource!);
    expect(embedded.map(r => r.uri).sort()).toEqual(['file:///d.html', 'file:///d.json', 'file:///d.spec.json']);
    const html = embedded.find(r => r.mimeType === 'text/html')!;
    expect(html.text).toContain('<title>HTTP</title>');
    expect(remoteLoads(html.text)).toEqual([]);
    // writeSpec:false → no spec.json written, so none embedded.
    const noSpec = await call(url, 'generate_html_diagram', diagram('e.html', { writeSpec: false }));
    expect(noSpec.content.filter(c => c.type === 'resource').map(c => c.resource!.uri).sort()).toEqual(['file:///e.html', 'file:///e.json']);
  }, 60000);

  it('rejects `..` traversal and absolute paths outside the output directory (writes and reads)', async () => {
    const root = tmp('ld-http-');
    const outside = tmp('ld-outside-');
    writeFileSync(join(outside, 'x.html'), '<script id="arch-data" type="application/json">{"title":"t"}</script>');
    const { url } = await start(root);
    for (const outputPath of ['../x.html', 'a/../../x.html', join(outside, 'y.html'), '/etc/x.html']) {
      const res = await call(url, 'generate_html_diagram', diagram(outputPath));
      expect(res.isError, outputPath).toBe(true);
      expect(res.content[0].text, outputPath).toMatch(/outside the allowed output directory/);
      expect(res.content.some(c => c.type === 'resource')).toBe(false);
    }
    expect(existsSync(join(outside, 'y.html'))).toBe(false);
    const read = await call(url, 'export_diagram_json', { diagramPath: join(outside, 'x.html') });
    expect(read.isError).toBe(true);
    expect(read.content[0].text).toMatch(/outside the allowed output directory/);
    const spec = await call(url, 'render_from_spec', { specPath: '../in.json' });
    expect(spec.isError).toBe(true);
    expect(spec.content[0].text).toMatch(/outside the allowed output directory/);
    // An absolute path INSIDE the root is fine.
    const inside = await call(url, 'generate_html_diagram', diagram(join(root, 'abs.html'), { writeSpec: false }));
    expect(inside.isError).toBeFalsy();
  }, 60000);

  it('rejects symlinks that escape the output directory', async () => {
    const root = tmp('ld-http-');
    const outside = tmp('ld-outside-');
    symlinkSync(outside, join(root, 'link'));
    symlinkSync(join(outside, 'nowhere.html'), join(root, 'dangling.html'));
    const { url } = await start(root);
    for (const outputPath of ['link/x.html', 'link/deep/x.html', 'dangling.html']) {
      const res = await call(url, 'generate_html_diagram', diagram(outputPath));
      expect(res.isError, outputPath).toBe(true);
      expect(res.content[0].text, outputPath).toMatch(/outside the allowed output directory/);
    }
    expect(existsSync(join(outside, 'x.html'))).toBe(false);
    expect(existsSync(join(outside, 'nowhere.html'))).toBe(false);
  }, 60000);

  it('confines layout assets (theme CSS) read by the domain', async () => {
    const root = tmp('ld-http-');
    const outside = tmp('ld-outside-');
    writeFileSync(join(outside, 'brand.css'), '.x{color:red}');
    writeFileSync(join(root, 'ok.css'), '.ok{color:blue}');
    const { url } = await start(root);
    const bad = await call(url, 'generate_html_diagram', diagram('l.html', { layout: { extends: 'default', theme: { css: join(outside, 'brand.css') } } }));
    expect(bad.isError).toBe(true);
    expect(bad.content[0].text).toMatch(/outside the allowed output directory/);
    const ok = await call(url, 'generate_html_diagram', diagram('l.html', { layout: { extends: 'default', theme: { css: 'ok.css' } } }));
    expect(ok.isError, ok.content[0].text).toBeFalsy();
    expect(ok.content.find(c => c.resource?.mimeType === 'text/html')!.resource!.text).toContain('.ok{color:blue}');
  }, 60000);

  it('refuses anything but POST /mcp (and /ping), and oversized bodies', async () => {
    const { url } = await start(tmp('ld-http-'));
    expect((await fetch(url)).status).toBe(405);
    expect((await fetch(url.replace('/mcp', '/other'), { method: 'POST', body: '{}' })).status).toBe(404);
    expect((await fetch(url.replace('/mcp', '/ping'))).status).toBe(200);
    const big = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x: 'a'.repeat(11 * 1024 * 1024) }) }).catch(() => ({ status: 413 }));
    expect(big.status).toBe(413);
  }, 60000);
});

describe('stdio transport', () => {
  it('still writes to any absolute path, and embeds nothing', async () => {
    const out = join(tmp('ld-stdio-'), 'nested', 's.html');
    const client = new Client({ name: 't', version: '1' });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(ROOT, 'mcp-server.js')], cwd: tmp('ld-cwd-'), stderr: 'ignore' }));
    try {
      const res = await client.callTool({ name: 'generate_html_diagram', arguments: diagram(out) }) as { content: Content[]; isError?: boolean };
      expect(res.isError).toBeFalsy();
      expect(existsSync(out)).toBe(true);
      expect(res.content.every(c => c.type === 'text')).toBe(true);
    } finally { await client.close(); }
  }, 60000);
});
