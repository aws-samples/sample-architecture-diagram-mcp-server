// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { useState, useCallback, useMemo, useEffect, type CSSProperties } from 'react';
import { ReactFlow, Background, BackgroundVariant, useReactFlow, type NodeTypes, type EdgeTypes, type Node, type Edge } from '@xyflow/react';
import { elkLayout, type LayoutDirection, type EdgePaths } from '@/lib/compoundLayout';
import { resolveGroupsAndMembership } from '@/lib/membership';
import AwsNode from '@/components/AwsNode';
import GroupNode from '@/components/GroupNode';
import CustomEdge from '@/components/CustomEdge';
import StepCard, { type WalkStep } from '@/components/StepCard';
import NodeModal, { type NodeDetail } from '@/components/NodeModal';
import ZoomBar from '@/components/ZoomBar';
import { TONE_COLORS, type Tone } from '@/lib/tones';

const nodeTypes: NodeTypes = { aws: AwsNode, group: GroupNode };
const edgeTypes: EdgeTypes = { custom: CustomEdge };

interface Props {
  data: {
    title?: string;
    subtitle?: string;
    services?: any[];
    connections?: any[];
    direction?: LayoutDirection;
    // Optional guided walkthrough: each beat highlights nodes/edges/groups in a
    // tone, dims the rest, and shows an explanatory overlay card. Arrow keys walk it.
    steps?: WalkStep[];
    stepFocus?: boolean; // hide non-active nodes each step (isolate the beat)
    stepZoom?: boolean;  // glide the camera onto each step's nodes
  };
}


/** Resolve multi-lang value: accepts string or {en, pt} object */
function i(val: any, lang: string): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return val[lang] || val.en || val.pt || '';
}

export function StandaloneApp({ data }: Props) {
  const { fitView } = useReactFlow();
  // Horizontal layout only (LR); direction is fixed for this animated-diagram build.
  const direction: LayoutDirection = 'LR';
  const [dark, setDark] = useState(false); // white background by default (AWS diagram guideline); toggle for dark
  const [lang] = useState(() => typeof navigator !== 'undefined' && navigator.language?.startsWith('pt') ? 'pt' : 'en');
  const [dockVisible, setDockVisible] = useState(true);
  const speed = 1; // flow-dot speed (fixed; the speed control was removed)

  const serviceNodes: Node[] = useMemo(() =>
    (data.services || []).map(s => ({
      id: s.id,
      type: 'aws',
      position: { x: 0, y: 0 },
      data: { label: i(s.service, lang), icon: s.icon, sub: s.category, role: i(s.role, lang), config: s.config },
    })), [data, lang]);

  // Node detail modal — opens when a diagram node is clicked.
  const [detailNode, setDetailNode] = useState<NodeDetail | null>(null);

  const { groups, membership } = useMemo(() => {
    return resolveGroupsAndMembership(data.services || [], (data as any).groups);
  }, [data]);

  // ── Guided walkthrough (data.steps) ──────────────────────────────────────
  // Separate from the connection-playback above: a hand-authored sequence of
  // beats that tint nodes/edges/groups and show an overlay card. -1 = none.
  const walkSteps = useMemo<WalkStep[]>(() => (Array.isArray(data.steps) ? data.steps : []), [data]);
  const hasWalk = walkSteps.length > 0;
  const [walkStep, setWalkStep] = useState(-1);
  const walkActive = hasWalk && walkStep >= 0;

  // Per-step tone maps for nodes / edges / groups.
  const { nodeTone, edgeTone, groupTone } = useMemo(() => {
    const nt: Record<string, Tone> = {}, et: Record<string, Tone> = {}, gt: Record<string, Tone> = {};
    if (walkActive) {
      const step = walkSteps[Math.min(walkStep, walkSteps.length - 1)];
      const tone = (step?.tone || 'accent') as Tone;
      for (const id of (step?.nodes || [])) nt[id] = tone;
      for (const id of (step?.edges || [])) et[id] = tone;
      for (const id of (step?.groups || [])) gt[id] = tone;
      if (step?.tones) for (const [id, tv] of Object.entries(step.tones)) nt[id] = tv as Tone;
      if (step?.edgeTones) for (const [id, tv] of Object.entries(step.edgeTones)) et[id] = tv as Tone;
      if (step?.groupTones) for (const [id, tv] of Object.entries(step.groupTones)) gt[id] = tv as Tone;
    }
    return { nodeTone: nt, edgeTone: et, groupTone: gt };
  }, [walkSteps, walkStep, walkActive]);

  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [edgePaths, setEdgePaths] = useState<EdgePaths>({});

  const edges: Edge[] = useMemo(() => {
    const targetCount: Record<string, number> = {};
    return (data.connections || []).map((c, i) => {
      const idx = targetCount[c.target] || 0;
      targetCount[c.target] = idx + 1;
      return {
        id: c.id,
        source: c.source,
        target: c.target,
        type: 'custom',
        // Horizontal (LR): edges leave the right, enter the left.
        sourceHandle: 'right',
        targetHandle: 'left',
        data: { label: c.label, edgeIndex: idx, bidirectional: c.bidirectional, connType: c.type,
          // Only the guided walkthrough lights edges now (flow playback removed).
          active: walkActive ? !!edgeTone[c.id] : false,
          tone: edgeTone[c.id],
          anyActive: walkActive,
          speed, routed: edgePaths[c.id] },
        animated: true,
      };
    });
  }, [data, direction, speed, edgePaths, walkActive, edgeTone]);

  // Structural edge list for layout — only source/target/id, NOT the per-step
  // tone/animation data. This keeps ELK from re-running on every play tick.
  const layoutEdges: Edge[] = useMemo(
    () => (data.connections || []).map(c => ({ id: c.id, source: c.source, target: c.target })),
    [data]
  );

  // ELK layout is async; run it whenever the STRUCTURE or direction changes and
  // re-fit once positions land. A cancel token guards against out-of-order results.
  useEffect(() => {
    let cancelled = false;
    elkLayout(serviceNodes, layoutEdges, membership, direction, groups).then(({ nodes, edgePaths }) => {
      if (cancelled) return;
      setAllNodes(nodes);
      setEdgePaths(edgePaths);
      setTimeout(() => fitView({ padding: 0.02 }), 50);
    });
    return () => { cancelled = true; };
  }, [serviceNodes, layoutEdges, membership, direction, groups, fitView]);

  // stepFocus: show ONLY the active step's nodes + their ancestor group boxes.
  const visibleIds = useMemo<Set<string> | null>(() => {
    if (!data.stepFocus || !walkActive) return null; // null = show all
    const vis = new Set<string>(Object.keys(nodeTone));
    const groupById = new Map(groups.map(g => [g.id, g]));
    for (const id of Object.keys(nodeTone)) {
      let p: string | undefined = (membership as Record<string, string>)[id];
      const seen = new Set<string>();
      while (p && !seen.has(p)) { seen.add(p); vis.add(p); p = groupById.get(p)?.parent; }
    }
    return vis;
  }, [data.stepFocus, walkActive, nodeTone, membership, groups]);

  // Decorate the laid-out nodes with walkthrough tone + focus visibility.
  const decoratedNodes = useMemo<Node[]>(() => allNodes.map(n => {
    const hidden = visibleIds ? !visibleIds.has(n.id) : false;
    if (n.type === 'aws') {
      return { ...n, hidden, data: { ...n.data, active: !!nodeTone[n.id], tone: nodeTone[n.id], anyActive: walkActive } };
    }
    // group node: tint its border + glow when this step selects it.
    const gt = groupTone[n.id];
    if (gt) {
      const gc = TONE_COLORS[gt] || TONE_COLORS.accent;
      return { ...n, hidden, style: { ...n.style, border: `2.5px solid ${gc}`, background: `${gc}14`, boxShadow: `0 0 0 3px ${gc}33` } };
    }
    return { ...n, hidden };
  }), [allNodes, nodeTone, groupTone, walkActive, visibleIds]);

  // stepZoom: glide the camera onto the active step's nodes (or its `zoom` list).
  useEffect(() => {
    if (!data.stepZoom || !walkActive) return;
    const step = walkSteps[Math.min(walkStep, walkSteps.length - 1)];
    const focusIds = (step?.zoom || step?.nodes || []);
    const maxZoom = step?.maxZoom ?? 2.2;
    const laidOut = new Set(allNodes.map(n => n.id));
    const present = focusIds.filter(id => laidOut.has(id));
    const t = setTimeout(() => {
      if (present.length) fitView({ nodes: present.map(id => ({ id })), padding: 0.35, duration: 700, maxZoom });
      else fitView({ padding: 0.02, duration: 700 });
    }, 120);
    return () => clearTimeout(t);
  }, [data.stepZoom, walkActive, walkStep, walkSteps, fitView, allNodes]);

  // Auto-play the walkthrough: advance one beat at a time; stop at the end.
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing || !hasWalk) return;
    if (walkStep >= walkSteps.length - 1) {
      const done = setTimeout(() => setPlaying(false), 2600);
      return () => clearTimeout(done);
    }
    const id = setTimeout(() => setWalkStep(s => Math.min(s + 1, walkSteps.length - 1)), 2600);
    return () => clearTimeout(id);
  }, [playing, hasWalk, walkStep, walkSteps.length]);

  const togglePlay = useCallback(() => {
    if (!hasWalk) return;
    setPlaying(p => {
      if (!p) setWalkStep(s => (s < 0 || s >= walkSteps.length - 1 ? 0 : s)); // restart from 0 if unstarted/at end
      return !p;
    });
  }, [hasWalk, walkSteps.length]);

  // Reset the walkthrough to its initial state — no beat active, overlay hidden,
  // full diagram shown (stops autoplay). -1 = pre-walkthrough state. Also snaps
  // the camera back to fit the whole diagram, since the stepZoom effect only
  // runs while a beat is active and won't fire for the -1 state.
  const resetWalk = useCallback(() => {
    if (!hasWalk) return;
    setPlaying(false);
    setWalkStep(-1);
    fitView({ padding: 0.02, duration: 500 });
  }, [hasWalk, fitView]);

  // Arrow keys drive the guided walkthrough (only when data.steps is present).
  useEffect(() => {
    if (!hasWalk) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault(); setPlaying(false); setWalkStep(s => Math.min(s + 1, walkSteps.length - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault(); setPlaying(false); setWalkStep(s => Math.max(s - 1, -1));
      } else if (e.key === 'Home') { setPlaying(false); setWalkStep(0); }
      else if (e.key === 'End') { setPlaying(false); setWalkStep(walkSteps.length - 1); }
      else if (e.key === 'Escape') { setPlaying(false); setWalkStep(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasWalk, walkSteps.length]);

  // Which side the overlay card pins to this step (default right; 'top' flows above).
  const cardSide = walkActive ? (walkSteps[Math.min(walkStep, walkSteps.length - 1)]?.cardSide || 'right') : 'right';

  const theme = dark ? 'dark' : 'light';

  return (
    <div className={`awsdiagram-root ${theme}`} data-theme={theme} style={{ width: '100vw', height: '100vh' }}>
      <style>{`
        .awsdiagram-root { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .awsdiagram-root.dark { --bg: #0f1117; --surface: #1a1d27; --node-bg: #1e2230; --node-border: rgba(255,255,255,0.08); --txt: #e2e8f0; --txt-muted: #94a3b8; --border: rgba(255,255,255,0.06); --icon-filter: brightness(0) invert(1); --card-bg: rgba(24,28,40,0.94); --dot: rgba(255,255,255,0.12); --chip-bg: rgba(148,163,184,0.14); background: var(--bg); color: var(--txt); }
        .awsdiagram-root.light { --bg: #f8fafc; --surface: #ffffff; --node-bg: #ffffff; --node-border: rgba(0,0,0,0.08); --txt: #1e293b; --txt-muted: #64748b; --border: rgba(0,0,0,0.06); --icon-filter: none; --card-bg: rgba(255,255,255,0.96); --dot: rgba(0,0,0,0.12); --chip-bg: rgba(100,116,139,0.1); background: var(--bg); color: var(--txt); }
        .awsdiagram-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 20px; border-bottom: 2px solid #FF9900; background: var(--surface); }
        .awsdiagram-header h1 { font-size: 14px; font-weight: 600; margin: 0; }
        .awsdiagram-header p { font-size: 11px; color: var(--txt-muted); margin: 2px 0 0; }
        .awsdiagram-btn { padding: 5px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--txt); font-size: 10px; cursor: pointer; }
        .awsdiagram-btn:hover { border-color: #FF9900; color: #FF9900; }
        .awsdiagram-btn.active { border-color: #3b82f6; color: #3b82f6; }
        .awsdiagram-code-panel { position: absolute; top: 12px; right: 12px; bottom: 12px; width: 520px; z-index: 50; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; }
        .awsdiagram-code-panel textarea { flex: 1; overflow: auto; padding: 12px; font-size: 11px; font-family: 'SF Mono', Menlo, monospace; line-height: 1.6; margin: 0; color: var(--txt); background: transparent; border: none; resize: none; outline: none; }
        .awsdiagram-code-pre { flex: 1; overflow: auto; padding: 12px; font-size: 11px; font-family: 'SF Mono', Menlo, monospace; line-height: 1.6; margin: 0; color: var(--txt); background: transparent; white-space: pre; }
        .awsdiagram-code-pre .hljs-attr { color: #79b8ff; }
        .awsdiagram-code-pre .hljs-string { color: #9ecbff; }
        .awsdiagram-code-pre .hljs-number, .awsdiagram-code-pre .hljs-literal { color: #f8c555; }
        .awsdiagram-root.light .awsdiagram-code-pre .hljs-attr { color: #005cc5; }
        .awsdiagram-root.light .awsdiagram-code-pre .hljs-string { color: #032f62; }
        .awsdiagram-root.light .awsdiagram-code-pre .hljs-number, .awsdiagram-root.light .awsdiagram-code-pre .hljs-literal { color: #b08800; }
        .awsdiagram-code-header { display: flex; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--border); }
        .react-flow__node-group { pointer-events: none; }
      `}</style>

      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <ReactFlow
          nodes={decoratedNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.02 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.2}
          maxZoom={3}
          nodesDraggable={true}
          onNodeClick={(_e, n) => {
            if (n.type !== 'aws') return;
            setDetailNode({ id: n.id, label: String(n.data.label || n.id), icon: n.data.icon as string | undefined, category: n.data.sub as string | undefined, role: n.data.role as string | undefined, config: n.data.config as NodeDetail['config'] });
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'} />
          <svg style={{ position: 'absolute', width: 0, height: 0 }}>
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#4a90d9" />
              </marker>
            </defs>
          </svg>
        </ReactFlow>

        {/* Guided walkthrough overlay card — floats over the canvas (left/right),
            flows above it (top), or covers the whole page as a centered modal
            with a backdrop (full — good for an intro/overview beat). */}
        {walkActive && (() => {
          if (cardSide === 'full') {
            return (
              <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, background: dark ? 'rgba(6,8,12,0.72)' : 'rgba(15,23,42,0.45)', backdropFilter: 'blur(6px)', pointerEvents: 'none' }}>
                <div style={{ width: 'min(90%, 720px)' }}>
                  <StepCard steps={walkSteps} activeStep={walkStep} />
                </div>
              </div>
            );
          }
          const posStyle: CSSProperties = cardSide === 'top'
            ? { top: 16, left: '50%', transform: 'translateX(-50%)', width: 'min(80%, 760px)' }
            : cardSide === 'left'
              ? { top: 16, left: 16, width: 'min(34%, 420px)' }
              : { top: 16, right: 16, width: 'min(34%, 420px)' };
          return (
            <div style={{ position: 'absolute', zIndex: 30, pointerEvents: 'none', ...posStyle }}>
              <StepCard steps={walkSteps} activeStep={walkStep} />
            </div>
          );
        })()}

        <NodeModal node={detailNode} onClose={() => setDetailNode(null)} />

        <ZoomBar title={i(data.title, lang) || 'Architecture'} subtitle={i(data.subtitle, lang)} dark={dark} visible={dockVisible} onToggle={() => setDockVisible(!dockVisible)} onTheme={() => setDark(!dark)} hasWalk={hasWalk} playing={playing} onPlay={togglePlay} onReset={resetWalk} />

      </div>
    </div>
  );
}
