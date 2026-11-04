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

FROM --platform=linux/arm64 public.ecr.aws/docker/library/node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/diagram-core/package.json packages/diagram-core/package.json
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build:core && npm run build:standalone && npm prune --omit=dev --ignore-scripts

FROM --platform=linux/arm64 public.ecr.aws/docker/library/node:22-slim
ENV NODE_ENV=production \
    MCP_TRANSPORT=http \
    MCP_HTTP_HOST=0.0.0.0 \
    MCP_HTTP_PORT=8000 \
    AWS_DIAGRAM_ICON_ROOT=/app/icons
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/mcp-server.js ./
COPY --from=build /app/lib ./lib
COPY --from=build /app/dist ./dist
COPY --from=build /app/schema ./schema
COPY --from=build /app/packages/diagram-core/src ./packages/diagram-core/src
COPY --from=build /app/packages/diagram-core/package.json ./packages/diagram-core/package.json
RUN mkdir -p /app/icons /tmp/diagrams && chown -R node:node /tmp/diagrams
USER node
WORKDIR /tmp/diagrams
EXPOSE 8000
CMD ["node", "/app/mcp-server.js", "--http"]
