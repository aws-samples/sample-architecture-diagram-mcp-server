// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The drafts of the staged builders, as kept in a SessionStore.
import type { Connection, Group, Service, Step, Tab } from "#domain/schemas/architecture.ts";
import type { FlowEdge, FlowNode, FlowStep, FlowType } from "#domain/schemas/flow.ts";
import type { Participant, SeqEvent, SeqFragment, SeqGroup } from "#domain/schemas/sequence.ts";

/** An architecture draft: a spec being assembled (diagram_create → diagram_add_* → diagram_render). */
export interface DiagramDraft {
  title: string;
  subtitle: string;
  direction: "LR" | "TB";
  services: Service[];
  connections: Connection[];
  groups: Group[];
  steps: Step[];
  tabs?: Tab[];
  stepZoom: boolean;
  stepFocus: boolean;
  [option: string]: unknown;
}

export interface SequenceDraft {
  title: string;
  subtitle: string;
  participants: Participant[];
  events: SeqEvent[];
  fragments: SeqFragment[];
  groups: SeqGroup[];
  autoActivate: boolean;
  autoplay: boolean;
  stepMs?: number;
}

export interface FlowDraft {
  type: FlowType;
  title: string;
  subtitle: string;
  direction: "TB" | "LR";
  nodes: FlowNode[];
  edges: FlowEdge[];
  steps: FlowStep[];
  autoplay: boolean;
  stepMs?: number;
}
