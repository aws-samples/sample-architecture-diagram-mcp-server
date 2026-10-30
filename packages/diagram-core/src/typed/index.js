// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Typed diagrams: registry (pure JS) ───
// A typed diagram is a diagram document whose body carries `kind: '<type>'` and
// follows that type's spec (schema + refs). Architecture diagrams (no kind) and
// sequence diagrams (kind 'sequence', own module) are handled separately.
// Part of @aws-sample-live-diagram/core (entry `./typed`): the specs are pure
// and run in the browser, in Node (the MCP, the studio's codegen) and, exported
// as JSON (exportTypeContracts), in a server-side validator.
// Adding a type: create ./<kind>.js following README.md and list it here.
import { validateWithSpec } from './validate.js'

// The schema / refs / unique checkers, for editors that walk a document.
export { valuesAt, checkRefs, checkUnique, walkSchema, validateWithSpec } from './validate.js'
import quadrant from './quadrant.js'
import swimlane from './swimlane.js'
import tree from './tree.js'
import gantt from './gantt.js'
import timeline from './timeline.js'
import er from './er.js'
import klass from './class.js'
import kanban from './kanban.js'
import journey from './journey.js'
import venn from './venn.js'
import layers from './layers.js'
import fishbone from './fishbone.js'
import wardley from './wardley.js'
import flywheel from './flywheel.js'
import workflow from './workflow.js'

const SPECS = [quadrant, swimlane, tree, gantt, timeline, er, klass, kanban, journey, venn, layers, fishbone, wardley, flywheel, workflow]

export const DIAGRAM_TYPES = Object.fromEntries(SPECS.map(s => [s.kind, s]))
export const TYPED_KINDS = SPECS.map(s => s.kind)
export const getDiagramType = (kind) => DIAGRAM_TYPES[kind] || null

export function validateTypedDiagram(doc) {
  const spec = getDiagramType(doc?.kind)
  if (!spec) return { valid: false, errors: [`kind: tipo de diagrama desconhecido "${doc?.kind}"`] }
  return validateWithSpec(spec, doc)
}

export function describeTypedDiagram(doc) {
  const spec = getDiagramType(doc?.kind)
  try { return spec?.describe ? spec.describe(doc) : (doc?.title || '') } catch { return doc?.title || '' }
}

// What the Lambda / MCP need, JSON-serialisable (no functions).
export function exportTypeContracts() {
  return Object.fromEntries(SPECS.map(s => [s.kind, {
    label: s.label, description: s.description, category: s.category,
    schema: s.schema, unique: s.unique || [], refs: s.refs || [],
  }]))
}
