// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Typed diagrams: registry (pure JS) ───
// A typed diagram is a diagram document whose body carries `kind: '<type>'` and
// follows that type's spec (schema + refs). Architecture diagrams (no kind) and
// sequence diagrams (kind 'sequence', own module) are handled separately.
// Part of @aws-sample-live-diagram/core (entry `./typed`): the specs are pure
// and run in the browser, in Node (the MCP, the studio's codegen) and, exported
// as JSON (exportTypeContracts), in a server-side validator.
// Adding a type: create ./<kind>.ts following README.md and list it here.
import { validateWithSpec } from './validate.ts'
import type { TypedDiagramSpec, TypedDocBase } from './validate.ts'
import type { JsonSchema, ValidationResult } from '#core/domain/schemas/jsonSchema.ts'

// The schema / refs / unique checkers, for editors that walk a document.
export { valuesAt, checkRefs, checkUnique, walkSchema, validateWithSpec } from './validate.ts'
export type { TypedDiagramSpec, TypedDocBase, TypedRef, TypedCategory, TypedSpecContract } from './validate.ts'
export type { JsonSchema, JsonSchemaType, ValidationResult } from '#core/domain/schemas/jsonSchema.ts'
import quadrant from './quadrant.ts'
import swimlane from './swimlane.ts'
import tree from './tree.ts'
import gantt from './gantt.ts'
import timeline from './timeline.ts'
import er from './er.ts'
import klass from './class.ts'
import kanban from './kanban.ts'
import journey from './journey.ts'
import venn from './venn.ts'
import layers from './layers.ts'
import fishbone from './fishbone.ts'
import wardley from './wardley.ts'
import flywheel from './flywheel.ts'
import workflow from './workflow.ts'

export type { QuadrantAxis, QuadrantItem, QuadrantDoc } from './quadrant.ts'
export type { SwimlaneLane, SwimlaneStep, SwimlaneFlow, SwimlaneDoc } from './swimlane.ts'
export type { TreeNode, TreeDoc } from './tree.ts'
export type { GanttSection, GanttTask, GanttDoc } from './gantt.ts'
export type { TimelineEvent, TimelineDoc } from './timeline.ts'
export type { ErColumn, ErEntity, ErRelation, ErDoc } from './er.ts'
export type { ClassClass, ClassRelation, ClassDoc } from './class.ts'
export type { KanbanColumn, KanbanCard, KanbanDoc } from './kanban.ts'
export type { JourneyPersona, JourneyStage, JourneyStep, JourneyDoc } from './journey.ts'
export type { VennSet, VennRegion, VennDoc } from './venn.ts'
export type { LayersLayer, LayersSideRail, LayersDoc } from './layers.ts'
export type { FishboneCause, FishboneCategory, FishboneDoc } from './fishbone.ts'
export type { WardleyComponent, WardleyLink, WardleyAnnotation, WardleyDoc } from './wardley.ts'
export type { FlywheelStage, FlywheelInput, FlywheelDoc } from './flywheel.ts'
export type { WorkflowNode, WorkflowEdge, WorkflowProof, WorkflowStep, WorkflowDoc } from './workflow.ts'

import type { QuadrantDoc } from './quadrant.ts'
import type { SwimlaneDoc } from './swimlane.ts'
import type { TreeDoc } from './tree.ts'
import type { GanttDoc } from './gantt.ts'
import type { TimelineDoc } from './timeline.ts'
import type { ErDoc } from './er.ts'
import type { ClassDoc } from './class.ts'
import type { KanbanDoc } from './kanban.ts'
import type { JourneyDoc } from './journey.ts'
import type { VennDoc } from './venn.ts'
import type { LayersDoc } from './layers.ts'
import type { FishboneDoc } from './fishbone.ts'
import type { WardleyDoc } from './wardley.ts'
import type { FlywheelDoc } from './flywheel.ts'
import type { WorkflowDoc } from './workflow.ts'
/** Document type of each typed kind. */
export interface TypedDocByKind {
  quadrant: QuadrantDoc
  swimlane: SwimlaneDoc
  tree: TreeDoc
  gantt: GanttDoc
  timeline: TimelineDoc
  er: ErDoc
  class: ClassDoc
  kanban: KanbanDoc
  journey: JourneyDoc
  venn: VennDoc
  layers: LayersDoc
  fishbone: FishboneDoc
  wardley: WardleyDoc
  flywheel: FlywheelDoc
  workflow: WorkflowDoc
}
/** A typed-diagram kind name. */
export type TypedKind = keyof TypedDocByKind
/** Any typed-diagram document. */
export type TypedDoc = TypedDocByKind[TypedKind]
/** The spec of each kind, typed by its document. */
export type TypedSpecMap = { [K in TypedKind]: TypedDiagramSpec<TypedDocByKind[K]> }
/** The JSON-serialisable contract of one kind (exportTypeContracts). */
export interface TypedTypeContract {
  label: string
  description: string
  category: TypedDiagramSpec['category']
  schema: JsonSchema
  unique: string[]
  refs: TypedDiagramSpec['refs']
}

const SPECS: TypedDiagramSpec[] = [quadrant, swimlane, tree, gantt, timeline, er, klass, kanban, journey, venn, layers, fishbone, wardley, flywheel, workflow]

// Keyed by any string (hosts look a kind up from author data); TypedSpecMap is
// the per-kind view of the same object.
export const DIAGRAM_TYPES: Record<string, TypedDiagramSpec> = Object.fromEntries(SPECS.map(s => [s.kind, s]))
export const TYPED_KINDS = SPECS.map(s => s.kind) as TypedKind[]
// Lookup by an arbitrary (author-supplied) kind.
export const getDiagramType = (kind: unknown): TypedDiagramSpec | null => DIAGRAM_TYPES[String(kind)] || null

// The `kind` of an untyped document, or undefined.
const kindOf = (doc: unknown): unknown => (doc != null && typeof doc === 'object' ? (doc as { kind?: unknown }).kind : undefined)

export function validateTypedDiagram(doc: unknown): ValidationResult {
  const spec = getDiagramType(kindOf(doc))
  if (!spec) return { valid: false, errors: [`kind: tipo de diagrama desconhecido "${kindOf(doc)}"`] }
  return validateWithSpec(spec, doc)
}

export function describeTypedDiagram(doc: unknown): string {
  const spec = getDiagramType(kindOf(doc))
  const title = (): string => (doc != null && typeof doc === 'object' ? (doc as TypedDocBase).title : undefined) || ''
  // A spec's describe assumes a document of its kind; a malformed one may throw.
  try { return spec?.describe ? spec.describe(doc as TypedDocBase) : title() } catch { return title() }
}

// What the Lambda / MCP need, JSON-serialisable (no functions).
export function exportTypeContracts(): Record<TypedKind, TypedTypeContract> {
  return Object.fromEntries(SPECS.map(s => [s.kind, {
    label: s.label, description: s.description, category: s.category,
    schema: s.schema, unique: s.unique || [], refs: s.refs || [],
  }])) as Record<TypedKind, TypedTypeContract>
}
