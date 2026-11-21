// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The self-contained players: the animated UML sequence and the flow kinds
// (workflow / dataflow / lifecycle). Each writes one HTML file.
import type { FlowHtmlInput, UnresolvedFlowIcon } from "#domain/render/flow.ts";
import type { SequenceHtmlInput, UnresolvedParticipantIcon } from "#domain/render/sequence.ts";
import type { FlowNode } from "#domain/schemas/flow.ts";
import type { Participant } from "#domain/schemas/sequence.ts";
import type { WrittenFile } from "#application/ports/index.ts";
import type { AppDeps } from "./deps.ts";
import { WrittenFiles } from "./files.ts";

export function createPlayers(deps: AppDeps) {
  const { domain, workspace: ws } = deps;
  return {
    writeSequence(outputPath: string, input: SequenceHtmlInput): { written: WrittenFile[] } {
      const files = new WrittenFiles(ws);
      const out = ws.resolve(outputPath);
      files.text(out, domain.sequence.generateSequenceHtml(input));
      return { written: files.list };
    },
    writeFlow(outputPath: string, input: FlowHtmlInput): { written: WrittenFile[] } {
      const files = new WrittenFiles(ws);
      const out = ws.resolve(outputPath);
      files.text(out, domain.flow.generateFlowHtml(input));
      return { written: files.list };
    },
    /** Participants that asked for an icon but resolved none. */
    unresolvedParticipants(participants: readonly Participant[]): UnresolvedParticipantIcon[] {
      return domain.sequence.seqIconResolutionReport(participants);
    },
    /** Flow nodes that asked for an icon but resolved none. */
    unresolvedNodes(nodes: readonly FlowNode[]): UnresolvedFlowIcon[] {
      return domain.flow.flowIconResolutionReport(nodes);
    },
  };
}
export type Players = ReturnType<typeof createPlayers>;
