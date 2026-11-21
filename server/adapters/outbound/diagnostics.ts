// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Diagnostics on stderr — never stdout, which is the MCP protocol stream.
import type { Diagnostics } from "#domain/ports/index.ts";

export class StderrDiagnostics implements Diagnostics {
  warn(message: string): void {
    console.error(message);
  }
}
