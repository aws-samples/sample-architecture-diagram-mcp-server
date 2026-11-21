# syntax=docker/dockerfile:1
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
#
# The MCP server as an Amazon Bedrock AgentCore Runtime container: ARM64,
# stateless streamable HTTP on 0.0.0.0:8000, POST /mcp (the MCP protocol
# contract). Build:  finch build --platform linux/arm64 -t architecture-diagram-mcp .
# Local test (never publish beyond localhost):
#   finch run --rm -p 127.0.0.1:8000:8000 architecture-diagram-mcp
# Inside AgentCore the container is not reachable directly; InvokeAgentRuntime
# authenticates every caller (IAM SigV4 or your JWT authorizer). docs/agentcore.md.
#
# AWS Architecture Icons are NOT in this image (AWS Terms of Use: not bundled
# with the project). Diagrams render category-colored initials unless you build
# a private image with ICONS_DIR pointing at a licensed copy (see the docs).
#
# Files: every path a tool call names is confined to MCP_OUTPUT_DIR
# (/tmp/diagrams); results embed the files each call wrote.

FROM --platform=linux/arm64 public.ecr.aws/docker/library/node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/diagram-core/package.json packages/diagram-core/package.json
RUN npm ci --ignore-scripts
COPY . .
# dist/server/ is committed; rebuilding it here keeps the image honest about its sources.
RUN npm run build:core && npm run build:standalone && npm run build:server && npm prune --omit=dev --ignore-scripts

FROM --platform=linux/arm64 public.ecr.aws/docker/library/node:22-slim
ENV NODE_ENV=production \
    MCP_TRANSPORT=http \
    MCP_HTTP_HOST=0.0.0.0 \
    MCP_HTTP_PORT=8000 \
    MCP_OUTPUT_DIR=/tmp/diagrams \
    AWS_DIAGRAM_ICON_ROOT=/app/icons
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
# The server is one esbuild bundle (dist/server/, the core inside it) behind
# the mcp-server.js shim; dist/index.html is the standalone page it fills.
COPY --from=build /app/mcp-server.js ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/schema ./schema
COPY --from=build /app/scripts/fetch-icons.sh ./scripts/fetch-icons.sh
RUN mkdir -p /app/icons /tmp/diagrams && chown -R node:node /tmp/diagrams
USER node
WORKDIR /tmp/diagrams
EXPOSE 8000
CMD ["node", "/app/mcp-server.js", "--http"]
