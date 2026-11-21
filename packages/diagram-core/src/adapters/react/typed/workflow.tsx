// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── View: workflow ───
// The core's <FlowPlayer> — the React twin of
// the aws-live-diagram MCP's HTML flow player, sharing its layout, shapes,
// framing and narration card — so a workflow here matches the MCP's HTML for
// the same document. The one typed view that is not a static <DiagramSvg>:
// the player measures its box and frames each walkthrough beat (pan/zoom).
// Step contract: `step` = beat index (0-based) while the deck reveals beats;
// null = overview (nothing dimmed, whole graph fitted).
import { useContext, useMemo } from 'react'
import { FlowPlayer } from '#core/adapters/react/components/FlowPlayer.tsx'
import type { FlowDoc } from '#core/adapters/react/components/FlowPlayer.tsx'
import { layoutFlow } from '#core/domain/flowLayout.ts'
import { TypedIconContext } from './iconContext.ts'
import type { CSSProperties } from 'react'
import type { TypedDocBase, TypedViewProps } from './DiagramSvg.tsx'

/** A workflow typed diagram is a flow document (the FlowPlayer input) with kind 'workflow'. */
export interface WorkflowDoc extends TypedDocBase, FlowDoc {}

export default function WorkflowView({ doc, step = null, fit }: TypedViewProps<WorkflowDoc>) {
  const iconUrl = useContext(TypedIconContext)
  // natural aspect for width-fitted embeds (articles, gallery); decks give a box
  const ratio = useMemo(() => {
    const L = layoutFlow(doc, { hasIcon: n => !!n.icon })
    return Math.max(0.35, Math.min(1.2, L.H / L.W))
  }, [doc])
  const box: CSSProperties = fit === 'contain'
    ? { width: '100%', height: '100%' }
    : { width: '100%', aspectRatio: `1 / ${ratio}`, minHeight: 420, maxHeight: '80vh' }
  return (
    <div style={{ ...box, overflow: 'hidden', borderRadius: 12 }}>
      <FlowPlayer flow={doc} activeStep={step == null ? null : step} iconUrl={iconUrl ?? undefined} />
    </div>
  )
}
