# Running the server on Amazon Bedrock AgentCore Runtime

The server speaks MCP over **stdio** by default. For Amazon Bedrock AgentCore
Runtime it also serves the same tools as a **stateless streamable-HTTP** MCP
server, which is what the runtime's MCP protocol contract requires:

| Requirement (AgentCore MCP contract) | This server |
|---|---|
| Stateless streamable HTTP | `--http` / `MCP_TRANSPORT=http`: a fresh server + transport per request, no session state |
| Host `0.0.0.0`, port `8000` | The container image sets `MCP_HTTP_HOST=0.0.0.0`, `MCP_HTTP_PORT=8000` |
| `POST /mcp` | Only `POST /mcp` (plus `GET /ping`); anything else is 404/405 |
| ARM64 container | `Dockerfile` builds `linux/arm64` |

Sources: [MCP protocol contract](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-mcp-protocol-contract.html),
[Deploy MCP servers in AgentCore Runtime](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-mcp.html),
[ProtocolConfiguration (port / path defaults)](https://docs.aws.amazon.com/bedrock-agentcore-control/latest/APIReference/API_ProtocolConfiguration.html).

## Security model

- **Outside a container the HTTP listener binds to `127.0.0.1`.** The
  `0.0.0.0` bind exists only inside the image, where no port is published.
- **The server has no authentication of its own.** Inside AgentCore Runtime the
  container is not reachable directly: every call goes through
  `InvokeAgentRuntime`, and the runtime authenticates the caller. Configure
  inbound auth on the runtime — there is no anonymous option here:
  - **IAM (SigV4) — recommended** for agents, Lambda functions and other AWS
    callers: grant `bedrock-agentcore:InvokeAgentRuntime` on the runtime ARN to
    exactly the roles that should use it.
  - **JWT (OAuth 2.0)** for MCP clients outside AWS: attach a JWT authorizer
    (e.g. an Amazon Cognito user pool or your identity provider) with an
    allowed audience / client list. Callers send a bearer token.
  - Authorization is action-level on your side: who may invoke the runtime is
    the IAM policy or the authorizer's allowed clients — scope both narrowly.
- **Never publish the port beyond localhost** when testing locally:
  `-p 127.0.0.1:8000:8000`, not `-p 8000:8000`. Do not put the container behind
  a public load balancer.
- Request bodies are capped at 10 MB.

## Files: one sandboxed folder, and the HTML comes back in the result

In HTTP mode every path a tool call names — output paths, the diagram or spec
it reads, a layout's theme CSS and branding images — is confined to ONE folder,
`MCP_OUTPUT_DIR` (`/tmp/diagrams` in the image; the working directory when
unset). Relative paths resolve inside it; an absolute path outside it, a `..`
that climbs out of it and a symlink whose target leaves it are rejected with a
clean tool error (`path … is outside the allowed output directory …`). Saved
layouts, custom components and built bundles (the operator's own
`DIAGRAM_LAYOUTS_DIR` / `DIAGRAM_COMPONENTS_DIR` / `DIAGRAM_BUNDLE_CACHE`) stay
readable. The stdio server and the CLI are not sandboxed: there the caller is
the local user.

The caller cannot read the container's disk, so every tool result also carries
**exactly the files that call wrote**, as embedded resources (each up to 8 MB):
`text/html` for the diagram, plus `<name>.spec.json` and the elements `.json`
when written, `.drawio` from the draw.io tools, and PNG / GIF (base64 blobs) /
SVG from `render_diagram_media`. Nothing else in the folder is attached. The
HTML is self-contained — icons inlined, no remote script, style, font or
image — so the client saves it and opens it from `file://` without this
server. Pass a plain file name as `outputPath` (e.g. `diagram.html`).

## Icons

The AWS Architecture Icons are **not** in the image: the project does not
redistribute them (AWS Architecture Icons Terms of Use), and `.dockerignore`
keeps local icon folders out of the build context. Without them, nodes render
as category-colored initials. To get icons in your own deployment, build a
**private** image that copies a licensed copy of the Asset Package into
`/app/icons` (the image sets `AWS_DIAGRAM_ICON_ROOT=/app/icons`), and keep that
image in a private Amazon ECR repository.

## Steps (not run by this project)

1. **Build** (ARM64), e.g. with Finch or Docker:

   ```bash
   finch build --platform linux/arm64 -t architecture-diagram-mcp .
   ```

2. **Test locally** — loopback only:

   ```bash
   finch run --rm -p 127.0.0.1:8000:8000 architecture-diagram-mcp
   curl -s http://127.0.0.1:8000/mcp -H 'content-type: application/json' \
     -H 'accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -c 300
   ```

   Or without a container: `MCP_OUTPUT_DIR=/tmp/diagrams node mcp-server.js --http`
   (binds `127.0.0.1:8000`).

3. **Push** to a private Amazon ECR repository (image scanning on, no public
   repository policy).

4. **Create the runtime** with the MCP protocol (`serverProtocol: MCP`; port
   8000 and path `/mcp` are the defaults), the image URI, an execution role with
   only ECR pull and CloudWatch Logs permissions, and **inbound auth** (IAM, or a
   JWT authorizer as above). The AgentCore starter toolkit (`agentcore
   configure --protocol MCP` / `agentcore launch`) or the
   `CreateAgentRuntime` API both work.

5. **Verify the gate before sharing:** call `InvokeAgentRuntime` without
   credentials (or with a token from a client that is not allowed) and require a
   denial from the runtime's authorizer; then call it with an allowed identity
   and check `tools/list`.

6. **Invoke** from an MCP client through the runtime endpoint (SigV4-signed, or
   with the bearer token), and save the `text/html` resource of a render result.
