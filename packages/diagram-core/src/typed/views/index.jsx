// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Typed diagram views: registry ───
// kind → React view (see quadrant.jsx for the props contract). The pure specs
// live one level up (../); adding a type = spec there + view here.
import { TypedIconContext } from './iconContext.js'
import QuadrantView from './quadrant.jsx'
import SwimlaneView from './swimlane.jsx'
import TreeView from './tree.jsx'
import GanttView from './gantt.jsx'
import TimelineView from './timeline.jsx'
import ErView from './er.jsx'
import ClassView from './class.jsx'
import KanbanView from './kanban.jsx'
import JourneyView from './journey.jsx'
import VennView from './venn.jsx'
import LayersView from './layers.jsx'
import FishboneView from './fishbone.jsx'
import WardleyView from './wardley.jsx'
import FlywheelView from './flywheel.jsx'
import WorkflowView from './workflow.jsx'

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
}

export function TypedDiagramView({ doc, step = null, fit = 'width', iconUrl = null }) {
  const View = DIAGRAM_VIEWS[doc?.kind]
  if (!View) {
    return <div style={{ border: '2px dashed rgba(251,191,36,.6)', borderRadius: 8, padding: 16, fontSize: 14, color: '#b45309' }}>Tipo de diagrama não suportado: {String(doc?.kind)}</div>
  }
  return <TypedIconContext.Provider value={iconUrl}><View doc={doc} step={step} fit={fit} /></TypedIconContext.Provider>
}

export default TypedDiagramView
