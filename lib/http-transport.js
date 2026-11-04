// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Streamable-HTTP transport (Amazon Bedrock AgentCore Runtime) ───
// stdio stays the default. `--http` (or MCP_TRANSPORT=http) serves the same
// tools as a STATELESS streamable-HTTP MCP server: POST /mcp only, a fresh
// server + transport per request (AgentCore isolates sessions itself and adds
// the Mcp-Session-Id header).
//
// Exposure: the bind defaults to 127.0.0.1. Only the container image sets
// MCP_HTTP_HOST=0.0.0.0 — inside AgentCore Runtime the container is not
// reachable directly; every call goes through InvokeAgentRuntime, which
// authenticates the caller (IAM SigV4 by default, or the JWT authorizer you
// configure). There is no anonymous mode and this server adds no auth of its
// own: never publish its port beyond localhost (docker run -p 127.0.0.1:8000:8000).
//
// Files: tools write HTML to the container's disk, which the caller cannot
// read, so in HTTP mode every tool result also carries the written .html
// (and .spec.json / .elements.json) as embedded resources. The HTML is
// self-contained — it opens from file:// once saved, without this server.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export const HTTP_DEFAULTS = { host: "127.0.0.1", port: 8000, path: "/mcp", maxBodyBytes: 10 * 1024 * 1024 };
const MAX_EMBED_BYTES = 8 * 1024 * 1024;

/** Paths a tool wrote, from its arguments: outputPath / outPath (+ sidecars). */
function writtenFiles(args) {
  const out = args?.outputPath || args?.outPath;
  if (typeof out !== "string") return [];
  const base = out.replace(/\.html?$/i, "");
  return [out, `${base}.spec.json`, `${base}.elements.json`, `${base}.json`, `${base}.drawio`].filter((p, i, a) => a.indexOf(p) === i);
}

/** Wrap a tool handler so its result embeds the files it wrote (HTTP mode). */
export function withEmbeddedFiles(handler) {
  return async (args, extra) => {
    const res = await handler(args, extra);
    if (!res || res.isError || !Array.isArray(res.content)) return res;
    const extraContent = [];
    for (const p of writtenFiles(args)) {
      try {
        if (!existsSync(p) || statSync(p).size > MAX_EMBED_BYTES) continue;
        const mimeType = p.endsWith(".html") ? "text/html" : p.endsWith(".drawio") ? "application/xml" : "application/json";
        extraContent.push({ type: "resource", resource: { uri: `file:///${basename(p)}`, mimeType, text: readFileSync(p, "utf-8") } });
      } catch { /* best-effort */ }
    }
    return extraContent.length ? { ...res, content: [...res.content, ...extraContent] } : res;
  };
}

/** A fresh MCP server with every tool and contract (one per HTTP request). */
export function buildServer({ TOOLS, PKG, registerContracts, embedFiles = true }) {
  const server = new McpServer({ name: PKG.name, version: PKG.version });
  for (const t of TOOLS) server.tool(t.name, t.description, t.shape, embedFiles ? withEmbeddedFiles(t.handler) : t.handler);
  registerContracts(server);
  return server;
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error("payload too large"), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf-8")) : undefined); }
      catch { reject(Object.assign(new Error("invalid JSON"), { status: 400 })); }
    });
    req.on("error", reject);
  });
}

const jsonRpcError = (res, status, message) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }));
};

/** Start the HTTP server. Resolves to { server, url } once listening. */
export function startHttpServer(deps, opts = {}) {
  const env = opts.env || process.env;
  const host = opts.host ?? (env.MCP_HTTP_HOST || HTTP_DEFAULTS.host);
  const port = opts.port ?? (Number.isFinite(+env.MCP_HTTP_PORT) && env.MCP_HTTP_PORT ? +env.MCP_HTTP_PORT : HTTP_DEFAULTS.port);
  const path = HTTP_DEFAULTS.path;
  const http = createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname === "/ping" && req.method === "GET") { res.writeHead(200, { "content-type": "application/json" }); res.end('{"status":"Healthy"}'); return; }
    if (url.pathname !== path) { jsonRpcError(res, 404, "not found"); return; }
    if (req.method !== "POST") { res.setHeader("allow", "POST"); jsonRpcError(res, 405, "method not allowed (stateless server: POST /mcp only)"); return; }
    let body;
    try { body = await readBody(req, HTTP_DEFAULTS.maxBodyBytes); } catch (e) { jsonRpcError(res, e.status || 400, e.message); return; }
    const server = buildServer(deps);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (e) {
      if (!res.headersSent) jsonRpcError(res, 500, "internal error");
      console.error("[aws-architecture-diagram] http request failed:", e?.message || e);
    }
  });
  return new Promise((resolve, reject) => {
    http.once("error", reject);
    http.listen(port, host, () => {
      const a = http.address();
      resolve({ server: http, url: `http://${typeof a === "object" && a ? `${a.address}:${a.port}` : `${host}:${port}`}${path}` });
    });
  });
}
