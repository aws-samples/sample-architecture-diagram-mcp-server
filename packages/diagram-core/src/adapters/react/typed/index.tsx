// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Typed diagram views: registry ───
// kind → React view (see quadrant.jsx for the props contract). The pure specs
// live one level up (../); adding a type = spec there + view here.
import { own } from '#core/domain/own.ts'
import type { ComponentType } from 'react'
import { TypedIconContext } from './iconContext.ts'
import type { TypedDocBase, TypedFit, TypedViewProps } from './DiagramSvg.tsx'
import QuadrantView from './quadrant.tsx'
import SwimlaneView from './swimlane.tsx'
import TreeView from './tree.tsx'
import GanttView from './gantt.tsx'
import TimelineView from './timeline.tsx'
import ErView from './er.tsx'
import ClassView from './class.tsx'
import KanbanView from './kanban.tsx'
import JourneyView from './journey.tsx'
import VennView from './venn.tsx'
import LayersView from './layers.tsx'
import FishboneView from './fishbone.tsx'
import WardleyView from './wardley.tsx'
import FlywheelView from './flywheel.tsx'
import WorkflowView from './workflow.tsx'

// Each view's doc type only adds optional fields to TypedDocBase, so every view
// accepts the base contract.
export const DIAGRAM_VIEWS = {
  quadrant: QuadrantView,
  swimlane: SwimlaneView,
  tree: TreeView,
  gantt: GanttView,
  timeline: TimelineView,
  er: ErView,
  'class': ClassView,
  kanban: KanbanView,
  journey: JourneyView,
  venn: VennView,
  layers: LayersView,
  fishbone: FishboneView,
  wardley: WardleyView,
  flywheel: FlywheelView,
  workflow: WorkflowView,
} satisfies Record<string, ComponentType<TypedViewProps>>

/** The view for a kind, looked up by the document's (untrusted) `kind` string. */
const VIEW_BY_KIND: Readonly<Record<string, ComponentType<TypedViewProps>>> = DIAGRAM_VIEWS

export interface TypedDiagramViewProps {
  /** The typed-diagram document; its `kind` picks the view. */
  doc?: TypedDocBase | null
  /** Reveal step: items with index < step are shown; null = all. */
  step?: number | null
  fit?: TypedFit
  /** Host resolver: icon ref → URL (views that draw AWS icons, e.g. workflow). */
  iconUrl?: ((ref: string) => string | null | undefined) | null
}

export function TypedDiagramView({ doc, step = null, fit = 'width', iconUrl = null }: TypedDiagramViewProps) {
  const View = doc?.kind ? own(VIEW_BY_KIND, doc.kind) : undefined
  if (!doc || !View) {
    return <div style={{ border: '2px dashed rgba(251,191,36,.6)', borderRadius: 8, padding: 16, fontSize: 14, color: '#b45309' }}>Tipo de diagrama não suportado: {String(doc?.kind)}</div>
  }
  return <TypedIconContext.Provider value={iconUrl}><View doc={doc} step={step} fit={fit} /></TypedIconContext.Provider>
}

export default TypedDiagramView
