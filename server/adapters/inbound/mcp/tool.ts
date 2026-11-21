// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// One MCP tool: name, description, input (a Zod shape) and a handler that calls
// a use case and formats its result as the tool's text. The registry
// (./registry.ts) lists them; ./server.ts registers them; ./contracts.ts
// generates the published tool contracts from the same list.
import type { z } from "zod";
import type { WrittenFile } from "#application/ports/index.ts";
import type { Application } from "#application/index.ts";

/** What a handler returns: the result text, and the files it wrote (embedded by the HTTP transport). */
export interface ToolOutput {
  text: string;
  isError?: boolean;
  written?: readonly WrittenFile[];
}

export interface ToolDef {
  name: string;
  description: string;
  shape: z.ZodRawShape;
  run(args: Record<string, unknown>): Promise<ToolOutput>;
}

/** Define a tool; the handler's argument type is inferred from the shape. */
export function tool<S extends z.ZodRawShape>(name: string, description: string, shape: S, run: (args: z.infer<z.ZodObject<S>>) => Promise<ToolOutput> | ToolOutput): ToolDef {
  return { name, description, shape, run: async (args) => run(args as z.infer<z.ZodObject<S>>) };
}

export const text = (t: string, written?: readonly WrittenFile[]): ToolOutput => (written ? { text: t, written } : { text: t });
export const jsonText = (v: unknown): ToolOutput => ({ text: JSON.stringify(v, null, 2) });
export const errorOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));
export const toolError = (e: unknown): ToolOutput => ({ text: `Error: ${errorOf(e)}`, isError: true });
export const failure = (t: string): ToolOutput => ({ text: t, isError: true });

// When the icon SET is missing (not just one unresolved ref), every node renders
// as a colored initial — and the generate call still "succeeds", so the user only
// finds out when the file opens. Say it in the result the agent is already
// reading, and name the one-call fix.
export function iconSetNotice(app: Application): string {
  if (app.icons.installed()) return "";
  return "\n\n⚠️ The AWS Architecture Icons are not installed, so every node will render as a category-colored initial."
    + "\nFix (once per machine): call setup_icons — it picks up an Icon-package*.zip (or older Asset-Package*.zip) from ~/Downloads, or returns the download link to relay to the user.";
}
