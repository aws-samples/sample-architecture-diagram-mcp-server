// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Streamable-HTTP mode (AgentCore Runtime): loopback by default, stateless POST
// /mcp, the written HTML returned in the tool result (self-contained), and the
// non-MCP routes refused.
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
// @ts-expect-error — plain JS module, no types
import { startHttpServer, HTTP_DEFAULTS } from '../lib/http-transport.js';
// @ts-expect-error — plain JS module, no types
import { TOOLS, PKG } from '../lib/tools.js';
// @ts-expect-error — plain JS module, no types
import { registerContracts } from '../lib/contracts.js';
// @ts-expect-error — plain JS module, no types
import { remoteLoads } from '../lib/self-contained.js';

const servers: any[] = [];
afterAll(() => servers.forEach(s => s.close()));

const rpc = async (url: string, method: string, params: unknown, id = 1) => {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
  return { status: r.status, body: await r.json() };
};

describe('HTTP transport', () => {
  it('binds to 127.0.0.1 unless MCP_HTTP_HOST says otherwise', async () => {
    expect(HTTP_DEFAULTS.host).toBe('127.0.0.1');
    const { server, url } = await startHttpServer({ TOOLS, PKG, registerContracts }, { port: 0, env: {} });
    servers.push(server);
    expect(server.address().address).toBe('127.0.0.1');
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
  });
  it('stateless: initialize + tools/list + a render whose result embeds the self-contained HTML', async () => {
    const { server, url } = await startHttpServer({ TOOLS, PKG, registerContracts }, { port: 0, env: {} });
    servers.push(server);
    const init = await rpc(url, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '1' } });
    expect(init.status).toBe(200);
    expect(init.body.result.serverInfo.name).toBe(PKG.name);
    const list = await rpc(url, 'tools/list', {}, 2);
    expect(list.body.result.tools.map((t: any) => t.name)).toContain('generate_html_diagram');
    const out = join(mkdtempSync(join(tmpdir(), 'ld-http-')), 'd.html');
    const call = await rpc(url, 'tools/call', { name: 'generate_html_diagram', arguments: { title: 'HTTP', services: [{ id: 'a', service: 'AWS Lambda', category: 'compute' }], connections: [], outputPath: out } }, 3);
    const html = call.body.result.content.find((c: any) => c.type === 'resource' && c.resource.mimeType === 'text/html');
    expect(html.resource.uri).toBe('file:///d.html');
    expect(html.resource.text).toContain('<title>HTTP</title>');
    expect(remoteLoads(html.resource.text)).toEqual([]);
  }, 60000);
  it('refuses anything but POST /mcp (and /ping), and oversized bodies', async () => {
    const { server, url } = await startHttpServer({ TOOLS, PKG, registerContracts }, { port: 0, env: {} });
    servers.push(server);
    expect((await fetch(url)).status).toBe(405);
    expect((await fetch(url.replace('/mcp', '/other'), { method: 'POST', body: '{}' })).status).toBe(404);
    expect((await fetch(url.replace('/mcp', '/ping'))).status).toBe(200);
    const big = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x: 'a'.repeat(11 * 1024 * 1024) }) }).catch(() => ({ status: 413 }));
    expect(big.status).toBe(413);
  }, 60000);
});
