import { useState, useCallback, useMemo, useEffect } from 'react';
import { ReactFlow, Background, BackgroundVariant, useReactFlow, type NodeTypes, type EdgeTypes, type Node, type Edge } from '@xyflow/react';
import { compoundLayout, type LayoutDirection } from '@/lib/compoundLayout';
import { resolveGroupsAndMembership } from '@/lib/membership';
import { generateIacHandoff, generateCalculatorPayload } from '@/lib/codegen';
import { highlightJson } from '@/lib/codeview';
import { exportPng } from '@/lib/pngExport';
import { downloadDrawio } from '@/lib/drawioExport';
import AwsNode from '@/components/AwsNode';
import GroupNode from '@/components/GroupNode';
import CustomEdge from '@/components/CustomEdge';
import StepModal from '@/components/StepModal';
import ZoomBar from '@/components/ZoomBar';
import { resolveIcon } from '@/lib/icons';

const nodeTypes: NodeTypes = { aws: AwsNode, group: GroupNode };
const edgeTypes: EdgeTypes = { custom: CustomEdge };

interface Props {
  data: {
    title?: string;
    subtitle?: string;
    services?: any[];
    connections?: any[];
    direction?: LayoutDirection;
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
  const [direction, setDirection] = useState<LayoutDirection>(data.direction || 'TB');
  const [dark, setDark] = useState(false); // white background by default (AWS diagram guideline); toggle for dark
  const [lang, setLang] = useState(() => typeof navigator !== 'undefined' && navigator.language?.startsWith('pt') ? 'pt' : 'en');
  const [dockVisible, setDockVisible] = useState(true);
  const [codePanel, setCodePanel] = useState<{ code: string; lang: string } | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [activeNode, setActiveNode] = useState<any | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [infoPanel, setInfoPanel] = useState(false); // ADR + Well-Architected panel
  const t = lang === 'pt'
    ? { iacConfig: 'Configuração IaC', pricing: 'Estimativa', config: 'Configuração', noConfig: 'Sem configuração', details: 'Detalhes' }
    : { iacConfig: 'IaC Configuration', pricing: 'Pricing', config: 'Configuration', noConfig: 'No configuration set', details: 'Details' };

  const serviceNodes: Node[] = useMemo(() =>
    (data.services || []).map(s => ({
      id: s.id,
      type: 'aws',
      position: { x: 0, y: 0 },
      data: { label: i(s.service, lang), icon: s.icon, sub: s.category, role: s.role, config: s.config ? { ...s.config, label: i(s.config.label, lang) } : undefined },
    })), [data, lang]);

  // Radial is a flat hub-and-spoke — skip implicit group derivation so the ring
  // isn't flattened by an aws-cloud container (explicit groups still honored).
  const { groups, membership } = useMemo(() => {
    const declared = (data as any).groups;
    if (direction === 'RADIAL' && !(declared && declared.length)) {
      return { groups: [], membership: {} };
    }
    return resolveGroupsAndMembership(data.services || [], declared);
  }, [data, direction]);

  // A flow step is "playing" whenever a step is selected (manual or auto-play).
  const anyActive = activeStep !== null;

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
        // Radial fans out in all directions, so let edges float (no fixed handle).
        sourceHandle: direction === 'RADIAL' ? undefined : (direction === 'TB' ? 'bottom' : 'right'),
        targetHandle: direction === 'RADIAL' ? undefined : (direction === 'TB' ? 'top' : 'left'),
        data: { label: c.label, stepNumber: i + 1, edgeIndex: idx, bidirectional: c.bidirectional, connType: c.type,
          active: activeStep === i, anyActive, speed },
        animated: true,
      };
    });
  }, [data, direction, activeStep, anyActive, speed]);

  const [allNodes, setAllNodes] = useState<Node[]>(() =>
    compoundLayout(serviceNodes, edges, membership, direction, groups)
  );

  const relayout = useCallback((dir: LayoutDirection) => {
    setDirection(dir);
    setAllNodes(compoundLayout(serviceNodes, edges, membership, dir, groups));
    setTimeout(() => fitView({ padding: 0.02 }), 50);
  }, [serviceNodes, edges, membership, groups, fitView]);

  const exportCode = useCallback((kind: 'iac' | 'calculator') => {
    const services = data.services || [];
    const region = 'sa-east-1';
    const title = i(data.title, lang) || 'Architecture';
    // Both are MCP handoff payloads (JSON): IaC -> awslabs-iac-mcp, calculator -> aws-calculator-mcp.
    const code = kind === 'iac'
      ? generateIacHandoff(services, data.connections || [], title, region, { adr: (data as any).adr, wellArchitected: (data as any).wellArchitected })
      : generateCalculatorPayload(services, title, region);
    setCodePanel({ code, lang: kind });
  }, [data, lang]);

  const slug = useCallback(() => (i(data.title, lang) || 'architecture').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'architecture', [data, lang]);

  const exportImage = useCallback(() => {
    exportPng(allNodes, dark, `${slug()}.png`);
  }, [allNodes, dark, slug]);

  const exportDrawio = useCallback(() => {
    downloadDrawio(allNodes, data.services || [], data.connections || [], i(data.title, lang) || 'Architecture', i(data.subtitle, lang), `${slug()}.drawio`);
  }, [allNodes, data, lang, slug]);

  const serviceNames = useMemo(() => Object.fromEntries((data.services || []).map((s: any) => [s.id, i(s.service, lang)])), [data, lang]);

  const steps = useMemo(() => (data.connections || []).map(c => ({    id: c.id, label: i(c.label, lang), source: c.source, target: c.target,
  })), [data]);

  // Auto-play: advance through steps at a speed-scaled interval; stop at the end.
  useEffect(() => {
    if (!playing) return;
    if (steps.length === 0) { setPlaying(false); return; }
    if (activeStep === null) { setActiveStep(0); return; }
    if (activeStep >= steps.length - 1) {
      const done = setTimeout(() => setPlaying(false), 1600 / speed);
      return () => clearTimeout(done);
    }
    const id = setTimeout(() => setActiveStep(s => (s === null ? 0 : s + 1)), 1600 / speed);
    return () => clearTimeout(id);
  }, [playing, activeStep, steps.length, speed]);

  const playFlow = useCallback(() => {
    if (steps.length === 0) return;
    if (playing) { setPlaying(false); return; }
    setActiveStep(activeStep === null || activeStep >= steps.length - 1 ? 0 : activeStep);
    setPlaying(true);
  }, [playing, activeStep, steps.length]);

  const theme = dark ? 'dark' : 'light';

  return (
    <div className={`awsdiagram-root ${theme}`} data-theme={theme} style={{ width: '100vw', height: '100vh' }}>
      <style>{`
        .awsdiagram-root { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .awsdiagram-root.dark { --bg: #0f1117; --surface: #1a1d27; --node-bg: #1e2230; --node-border: rgba(255,255,255,0.08); --txt: #e2e8f0; --txt-muted: #94a3b8; --border: rgba(255,255,255,0.06); --icon-filter: brightness(0) invert(1); background: var(--bg); color: var(--txt); }
        .awsdiagram-root.light { --bg: #f8fafc; --surface: #ffffff; --node-bg: #ffffff; --node-border: rgba(0,0,0,0.08); --txt: #1e293b; --txt-muted: #64748b; --border: rgba(0,0,0,0.06); --icon-filter: none; background: var(--bg); color: var(--txt); }
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

      <div style={{ width: '100%', height: '100%', position: 'relative' }} onClick={(e) => {
        const badge = (e.target as HTMLElement).closest('.edge-badge');
        if (badge) {
          const num = parseInt(badge.textContent || '0');
          if (num > 0) setActiveStep(num - 1);
        }
      }}>
        <ReactFlow
          nodes={allNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.02 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.2}
          maxZoom={3}
          nodesDraggable={true}
          onNodeClick={(_, node) => {
            if (node.type === 'aws') {
              const svc = (data.services || []).find((s: any) => s.id === node.id);
              if (svc) setActiveNode(svc);
            }
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

        <ZoomBar title={i(data.title, lang) || 'Architecture'} subtitle={i(data.subtitle, lang)} direction={direction} dark={dark} lang={lang} visible={dockVisible} onToggle={() => setDockVisible(!dockVisible)} onDirection={relayout} onTheme={() => setDark(!dark)} onLang={() => setLang(lang === 'pt' ? 'en' : 'pt')} onExport={exportCode} onExportImage={exportImage} onExportDrawio={exportDrawio} hasFlow={steps.length > 0} playing={playing} speed={speed} onPlay={playFlow} onSpeed={() => setSpeed(s => s === 1 ? 2 : s === 2 ? 0.5 : 1)} hasInfo={(((data as any).adr || []).length > 0) || (!!(data as any).wellArchitected && Object.values((data as any).wellArchitected).some(Boolean))} onInfo={() => setInfoPanel(v => !v)} />
        <StepModal steps={steps} activeStep={activeStep} setActiveStep={setActiveStep} serviceNames={serviceNames} lang={lang} />

        {infoPanel && (() => {
          const adrs: any[] = (data as any).adr || [];
          const wa: Record<string, string> | null = (data as any).wellArchitected || null;
          const PILLARS: [string, string][] = [
            ["operational-excellence", lang === 'pt' ? 'Excelência Operacional' : 'Operational Excellence'],
            ["security", lang === 'pt' ? 'Segurança' : 'Security'],
            ["reliability", lang === 'pt' ? 'Confiabilidade' : 'Reliability'],
            ["performance-efficiency", lang === 'pt' ? 'Eficiência de Performance' : 'Performance Efficiency'],
            ["cost-optimization", lang === 'pt' ? 'Otimização de Custos' : 'Cost Optimization'],
            ["sustainability", lang === 'pt' ? 'Sustentabilidade' : 'Sustainability'],
          ];
          const statusColor: Record<string, string> = { accepted: "#3F8624", proposed: "#FF9900", superseded: "#888", rejected: "#DD344C" };
          return (
          <div className="awsdiagram-code-panel" style={{ left: 'auto' }}>
            <div className="awsdiagram-code-header" style={{ flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span style={{ fontSize: 11, fontWeight: 600 }}>{lang === 'pt' ? 'Decisões & Well-Architected' : 'Decisions & Well-Architected'}</span>
                <button className="awsdiagram-btn" onClick={() => setInfoPanel(false)}>✕</button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px' }}>
              {adrs.length > 0 && (
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#007CBD', letterSpacing: 0.5, marginBottom: 10 }}>{lang === 'pt' ? 'Decisões de Arquitetura (ADR)' : 'Architectural Decisions (ADR)'}</div>
              )}
              {adrs.map((a, k) => (
                <div key={k} style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: '#fff', background: statusColor[a.status || 'accepted'] || '#888', padding: '2px 6px', borderRadius: 4 }}>{a.status || 'accepted'}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt)' }}>{i(a.title, lang)}</span>
                  </div>
                  {a.context && <div style={{ fontSize: 11, color: 'var(--txt-muted)', marginTop: 4 }}><b style={{ color: 'var(--txt)' }}>{lang === 'pt' ? 'Contexto: ' : 'Context: '}</b>{i(a.context, lang)}</div>}
                  {a.decision && <div style={{ fontSize: 11, color: 'var(--txt-muted)', marginTop: 4 }}><b style={{ color: 'var(--txt)' }}>{lang === 'pt' ? 'Decisão: ' : 'Decision: '}</b>{i(a.decision, lang)}</div>}
                  {a.consequences && <div style={{ fontSize: 11, color: 'var(--txt-muted)', marginTop: 4 }}><b style={{ color: 'var(--txt)' }}>{lang === 'pt' ? 'Consequências: ' : 'Consequences: '}</b>{i(a.consequences, lang)}</div>}
                </div>
              ))}
              {wa && Object.values(wa).some(Boolean) && (
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#FF9900', letterSpacing: 0.5, margin: '4px 0 10px' }}>AWS Well-Architected</div>
              )}
              {wa && PILLARS.filter(([key]) => wa[key]).map(([key, name]) => (
                <div key={key} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt)' }}>{name}</div>
                  <div style={{ fontSize: 11, color: 'var(--txt-muted)', marginTop: 2, lineHeight: 1.5 }}>{i(wa[key], lang)}</div>
                </div>
              ))}
              {adrs.length === 0 && (!wa || !Object.values(wa).some(Boolean)) && (
                <div style={{ fontSize: 11, color: 'var(--txt-muted)', textAlign: 'center', padding: 20 }}>{lang === 'pt' ? 'Sem decisões ou notas Well-Architected.' : 'No decisions or Well-Architected notes.'}</div>
              )}
            </div>
          </div>
          );
        })()}

        {activeNode && (
          <div onClick={() => setActiveNode(null)} style={{
            position: "absolute", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div onClick={(e) => e.stopPropagation()} style={{
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
              padding: 0, width: 360, maxHeight: "70vh", overflow: "hidden", display: "flex", flexDirection: "column",
            }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {activeNode.icon && <img src={resolveIcon(activeNode.icon) ?? ''} alt="" width={28} height={28} />}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--txt)" }}>{i(activeNode.service, lang)}</div>
                    <div style={{ fontSize: 10, color: "var(--txt-muted)", textTransform: "uppercase" }}>{activeNode.category}</div>
                  </div>
                </div>
                <button onClick={() => setActiveNode(null)} style={{ background: "none", border: "none", color: "var(--txt-muted)", fontSize: 18, cursor: "pointer" }}>✕</button>
              </div>

              {/* Config */}
              <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
                {/* Role — what this component DOES (the WHY) */}
                {activeNode.role && (
                  <div style={{ fontSize: 12, color: "var(--txt)", marginBottom: 14, lineHeight: 1.5 }}>{i(activeNode.role, lang)}</div>
                )}
                {activeNode.config && (activeNode.config.iac || activeNode.config.pricing || activeNode.config.label) ? (
                  <>
                    {activeNode.config.label && (
                      <div style={{ fontSize: 12, color: "var(--txt)", marginBottom: 12, fontStyle: "italic" }}>{i(activeNode.config.label, lang)}</div>
                    )}
                    {activeNode.config.iac && Object.keys(activeNode.config.iac).length > 0 && (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "#007CBD", marginBottom: 8, letterSpacing: 0.5 }}>{t.iacConfig}</div>
                        {Object.entries(activeNode.config.iac).map(([k, v]) => (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                            <span style={{ fontSize: 11, color: "var(--txt-muted)" }}>{k}</span>
                            <span style={{ fontSize: 11, color: "var(--txt)", fontWeight: 500 }}>{String(v)}</span>
                          </div>
                        ))}
                      </>
                    )}
                    {activeNode.config.pricing && Object.keys(activeNode.config.pricing).length > 0 && (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "#FF9900", marginTop: 14, marginBottom: 8, letterSpacing: 0.5 }}>{t.pricing}</div>
                        {Object.entries(activeNode.config.pricing).map(([k, v]) => (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                            <span style={{ fontSize: 11, color: "var(--txt-muted)" }}>{k}</span>
                            <span style={{ fontSize: 11, color: "var(--txt)", fontWeight: 500 }}>{String(v)}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                ) : activeNode.config && typeof activeNode.config === 'object' && Object.keys(activeNode.config).length > 0 ? (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--txt-muted)", marginBottom: 10, letterSpacing: 0.5 }}>{t.config}</div>
                    {Object.entries(activeNode.config).map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ fontSize: 11, color: "var(--txt-muted)" }}>{k}</span>
                        <span style={{ fontSize: 11, color: "var(--txt)", fontWeight: 500 }}>{String(v)}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: "var(--txt-muted)", textAlign: "center", padding: 20 }}>{t.noConfig}</div>
                )}

                {/* Connections - grouped by peer */}
                <div style={{ marginTop: 16, fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--txt-muted)", marginBottom: 8, letterSpacing: 0.5 }}>{lang === 'pt' ? 'Conexões' : 'Connections'}</div>
                {(() => {
                  const conns = (data.connections || []).filter(c => c.source === activeNode.id || c.target === activeNode.id);
                  const grouped: Record<string, { out?: string; in?: string }> = {};
                  conns.forEach(c => {
                    const isOut = c.source === activeNode.id;
                    const other = isOut ? c.target : c.source;
                    if (!grouped[other]) grouped[other] = {};
                    if (isOut) grouped[other].out = i(c.label, lang);
                    else grouped[other].in = i(c.label, lang);
                  });
                  return Object.entries(grouped).map(([other, dir]) => (
                    <div key={other} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: dir.out && dir.in ? "#10b981" : dir.out ? "#FF9900" : "#007CBD", fontWeight: 700, fontSize: 9 }}>
                          {dir.out && dir.in ? "↔" : dir.out ? (lang === 'pt' ? "SAÍDA →" : "OUT →") : (lang === 'pt' ? "← ENTRADA" : "← IN")}
                        </span>
                        <span style={{ color: "var(--txt)", fontWeight: 500 }}>{serviceNames[other] || other}</span>
                      </div>
                      {dir.out && <div style={{ fontSize: 9, color: "var(--txt-muted)", marginLeft: 28, marginTop: 2 }}>→ {dir.out}</div>}
                      {dir.in && <div style={{ fontSize: 9, color: "var(--txt-muted)", marginLeft: 28, marginTop: 2 }}>← {dir.in}</div>}
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}

        {codePanel && (() => {
          const titleLabel = codePanel.lang === 'iac' ? 'IaC → aws-iac-mcp' : 'Pricing → aws-calculator-mcp';
          const desc = codePanel.lang === 'iac'
            ? (lang === 'pt' ? 'Spec da arquitetura + instrução. Cole no agente para gerar IaC de produção via awslabs-iac-mcp (CDK/Terraform/CloudFormation).' : 'Architecture spec + instruction. Paste to the agent to generate production IaC via awslabs-iac-mcp (CDK/Terraform/CloudFormation).')
            : (lang === 'pt' ? 'Payload para estimar custos via aws-calculator-mcp. Cole no agente.' : 'Payload to estimate costs via aws-calculator-mcp. Paste to the agent.');
          return (
          <div className="awsdiagram-code-panel">
            <div className="awsdiagram-code-header" style={{ flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span style={{ fontSize: 11, fontWeight: 600 }}>{titleLabel}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="awsdiagram-btn" onClick={() => { navigator.clipboard?.writeText(codePanel.code); }}>{lang === 'pt' ? 'Copiar' : 'Copy'}</button>
                  <button className="awsdiagram-btn" onClick={() => setCodePanel(null)}>✕</button>
                </div>
              </div>
              <span style={{ fontSize: 10, color: 'var(--txt-muted)' }}>{desc}</span>
            </div>
            <pre className="awsdiagram-code-pre"><code dangerouslySetInnerHTML={{ __html: highlightJson(codePanel.code) }} /></pre>
          </div>
          );
        })()}
      </div>
    </div>
  );
}
