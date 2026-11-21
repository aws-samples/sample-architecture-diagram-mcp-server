// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Streamable-HTTP transport (Amazon Bedrock AgentCore Runtime) ───
// stdio stays the default. `--http` (or MCP_TRANSPORT=http) serves the same
// tools as a STATELESS streamable-HTTP MCP server: POST /mcp only, a fresh
// server + transport per request (AgentCore isolates sessions itself and adds
// the Mcp-Session-Id header). GET /ping answers the runtime's health check.
//
// Exposure: the bind defaults to 127.0.0.1. Only the container image sets
// MCP_HTTP_HOST=0.0.0.0 — inside AgentCore Runtime the container is not
// reachable directly; every call goes through InvokeAgentRuntime, which
// authenticates the caller (IAM SigV4 by default, or the JWT authorizer you
// configure). There is no anonymous mode and this server adds no auth of its
// own: never publish its port beyond localhost (docker run -p 127.0.0.1:8000:8000).
//
// Files: the composition gives the tools a SANDBOXED workspace (MCP_OUTPUT_DIR),
// and the caller cannot read the container's disk, so every tool result also
// carries the files that tool reported as written, as embedded resources. The
// HTML is self-contained — it opens from file:// once saved, without this server.
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Logger, WrittenFile } from "#application/ports/index.ts";
import type { Embedder } from "./server.ts";

export const HTTP_DEFAULTS = { host: "127.0.0.1", port: 8000, path: "/mcp", maxBodyBytes: 10 * 1024 * 1024 };
export const MAX_EMBED_BYTES = 8 * 1024 * 1024;

const TEXT_TYPES = new Set(["text/html", "application/json", "application/xml", "image/svg+xml"]);

/** Embed the written files (≤ 8 MiB each) as resources: text for text types, base64 blobs for images/PDF. */
export const embedWrittenFiles: Embedder = (written: readonly WrittenFile[]) => {
  const out: ReturnType<Embedder> = [];
  for (const f of written) {
    try {
      if (statSync(f.path).size > MAX_EMBED_BYTES) continue;
      const uri = `file:///${basename(f.path)}`;
      out.push(TEXT_TYPES.has(f.mimeType)
        ? { type: "resource", resource: { uri, mimeType: f.mimeType, text: readFileSync(f.path, "utf-8") } }
        : { type: "resource", resource: { uri, mimeType: f.mimeType, blob: readFileSync(f.path).toString("base64") } });
    } catch { /* best-effort */ }
  }
  return out;
};

/** Host and port from MCP_HTTP_HOST / MCP_HTTP_PORT (the composition root passes its environment). */
export function httpOptionsFromEnv(env: Readonly<Record<string, string | undefined>>): { host: string; port: number } {
  const port = env.MCP_HTTP_PORT && Number.isFinite(+env.MCP_HTTP_PORT) ? +env.MCP_HTTP_PORT : HTTP_DEFAULTS.port;
  return { host: env.MCP_HTTP_HOST || HTTP_DEFAULTS.host, port };
}

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

function readBody(req: IncomingMessage, limit: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, "payload too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf-8")) : undefined); }
      catch { reject(new HttpError(400, "invalid JSON")); }
    });
    req.on("error", reject);
  });
}

const jsonRpcError = (res: ServerResponse, status: number, message: string) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }));
};

export interface HttpServerDeps {
  /** A fresh, unconnected MCP server for one request. */
  createServer(): McpServer;
  logger: Logger;
}

/** Start the HTTP server. Resolves to { server, url } once listening. */
export function startHttpServer(deps: HttpServerDeps, { host = HTTP_DEFAULTS.host, port = HTTP_DEFAULTS.port }: { host?: string; port?: number } = {}): Promise<{ server: Server; url: string }> {
  const path = HTTP_DEFAULTS.path;
  const http = createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname === "/ping" && req.method === "GET") { res.writeHead(200, { "content-type": "application/json" }); res.end('{"status":"Healthy"}'); return; }
    if (url.pathname !== path) { jsonRpcError(res, 404, "not found"); return; }
    if (req.method !== "POST") { res.setHeader("allow", "POST"); jsonRpcError(res, 405, "method not allowed (stateless server: POST /mcp only)"); return; }
    let body: unknown;
    try { body = await readBody(req, HTTP_DEFAULTS.maxBodyBytes); } catch (e) { jsonRpcError(res, e instanceof HttpError ? e.status : 400, e instanceof Error ? e.message : String(e)); return; }
    const server = deps.createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (e) {
      if (!res.headersSent) jsonRpcError(res, 500, "internal error");
      deps.logger.error("http request failed:", e);
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
