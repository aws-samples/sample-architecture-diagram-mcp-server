// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Logger on stderr — never stdout, which is the stdio MCP protocol stream.
import type { Logger } from "#application/ports/index.ts";

export const LOG_PREFIX = "[aws-architecture-diagram]";

export class StderrLogger implements Logger {
  info(message: string): void { console.error(`${LOG_PREFIX} ${message}`); }
  warn(message: string): void { console.error(`${LOG_PREFIX} ${message}`); }
  error(message: string, cause?: unknown): void {
    const detail = cause === undefined ? "" : ` ${cause instanceof Error ? cause.message : String(cause)}`;
    console.error(`${LOG_PREFIX} ${message}${detail}`);
  }
}
