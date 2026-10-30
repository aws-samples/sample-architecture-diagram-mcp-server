// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// <FlowPlayer> — the React twin of the MCP's self-contained flow player
// (lib/flow-template.html): workflow, data-flow and lifecycle/state graphs.
// Same layout (layoutFlow, from the one shared lib/flow-layout.js), same
// shapes, colors, edge labels, walkthrough framing (flowFrame) and narration
// card, so a flow embedded in an app or a deck reads exactly like the HTML
// the MCP emits for the same input.
//
// Input: the flow document the MCP's generate_<type>_diagram takes —
//   { type?, title?, subtitle?, direction?, nodes[], edges[], steps[]? }.
// Icons: the HTML inlines them; here the host resolves a node's `icon` ref to
// a URL through `iconUrl(ref)` (a node without a resolvable icon draws no glyph,
// exactly as in the HTML).
//
// Walkthrough: controlled by `activeStep` (index into steps; null/undefined =
// overview, nothing dimmed). Without `activeStep` the component keeps its own
// step and, with `controls`, shows the prev/next pill. The host (a deck's reveal
// store, a page) drives it the same way the HTML player's buttons do.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { layoutFlow, flowActiveSet, flowFrame } from "../flowLayout.js";
import { PLAYER_TONES as TONE, AWS_ORANGE } from "../tones.js";
import { playerThemeCss } from "../playerTheme.js";

const BADGE_TXT = { gate: "◆ GATE", async: "async", sync: "sync", phase: "PHASE", fail: "✕ fail", start: "▶ start", end: "■ end" };
const DEFAULT_KIND = { workflow: "task", dataflow: "process", lifecycle: "state" };
const GUTTER = 396;

// Same escaping + inline markdown as the HTML player (esc() also guards
// attribute values; only http(s)/mailto proof links become anchors).
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const safeUrl = (u) => /^(https?:|mailto:)/i.test(String(u || "").trim()) ? String(u).trim() : "";
function md(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*([^*]+)\*/g, "<i>$1</i>");
}
function lineFrag(lines) {
  if (lines == null) return "";
  if (Array.isArray(lines)) return lines.length > 1 ? "#L" + lines[0] + "-L" + lines[1] : "#L" + lines[0];
  const m = String(lines).match(/(\d+)\s*[-–]\s*(\d+)/);
  if (m) return "#L" + m[1] + "-L" + m[2];
  const one = String(lines).match(/\d+/);
  return one ? "#L" + one[0] : "";
}
function proofHtml(p) {
  if (p == null) return "";
  if (typeof p === "string") return md(p);
  const path = p.path || "", frag = lineFrag(p.lines);
  let url = p.url || "";
  if (!url && p.repo && path) url = String(p.repo).replace(/\/+$/, "") + "/blob/" + (p.ref || "main") + "/" + String(path).replace(/^\/+/, "") + frag;
  const label = p.text || (path ? (path + (frag ? frag.replace("#L", ":").replace("-L", "-") : "")) : url);
  url = safeUrl(url);
  if (!url) return md(label || "");
  return '<a href="' + esc(url) + '" target="_blank" rel="noopener"><code>' + esc(label) + "</code></a>";
}

// Legend per diagram type — the same swatches as the HTML card.
const sw = (c) => <svg width="14" height="14"><rect x="1" y="2" width="12" height="10" rx="2" fill="none" stroke={c} strokeWidth="2" /></svg>;
const dia = (c) => <svg width="14" height="14"><polygon points="7,1 13,7 7,13 1,7" fill="none" stroke={c} strokeWidth="2" /></svg>;
const cir = (c, fill) => <svg width="14" height="14"><circle cx="7" cy="7" r="5.5" fill={fill || "none"} stroke={c} strokeWidth="2" /></svg>;
const cyl = (c) => <svg width="14" height="14"><path d="M2,4 A5 2 0 0 1 12,4 L12,10 A5 2 0 0 1 2,10 Z" fill="none" stroke={c} strokeWidth="1.6" /></svg>;
const arrow = (dash) => <svg width="30" height="10"><line x1="0" y1="5" x2="22" y2="5" stroke="currentColor" strokeWidth="2" strokeDasharray={dash ? "6 4" : undefined} /><path d="M22,1 L30,5 L22,9 z" fill="currentColor" /></svg>;
const LEGENDS = {
  workflow: [[cir("var(--success)", "var(--success)"), "start"], [sw("var(--accent)"), "task"], [dia("var(--warn)"), "decision"], [cir("var(--neutral)"), "end"], [arrow(false), "transition"]],
  dataflow: [[sw("var(--neutral)"), "external"], [sw("var(--accent)"), "process"], [cyl("var(--info)"), "data store"], [arrow(false), "data flow"]],
  lifecycle: [[cir("var(--success)", "var(--success)"), "initial"], [sw("var(--accent)"), "state"], [dia("var(--warn)"), "choice"], [cir("var(--neutral)"), "final"], [arrow(true), "return"]],
};

// Styles: the HTML player's, scoped under .lfd (light by default; dark via
// theme="dark" or a `.dark` ancestor when no theme is forced).
const CSS = `
${playerThemeCss(".lfd", '.lfd[data-theme="dark"],:where(.dark) .lfd:not([data-theme="light"])')}
.lfd{position:relative;width:100%;height:100%;overflow:hidden;color:var(--txt);font-family:'Amazon Ember','Helvetica Neue',Helvetica,Arial,sans-serif;user-select:none;touch-action:none;
  background:linear-gradient(90deg,var(--grid) 1px,transparent 1px) 0 0/40px 40px,linear-gradient(0deg,var(--grid) 1px,transparent 1px) 0 0/40px 40px,var(--bg)}
.lfd.lfd-bare{background:linear-gradient(90deg,var(--grid) 1px,transparent 1px) 0 0/40px 40px,linear-gradient(0deg,var(--grid) 1px,transparent 1px) 0 0/40px 40px}
.lfd.lfd-pan{cursor:grab}.lfd.lfd-pan.grabbing{cursor:grabbing}
.lfd>svg{position:absolute;left:0;top:0;transform-origin:0 0}
@media (prefers-reduced-motion: reduce){.lfd *,.lfd *::before,.lfd *::after{animation-duration:.001ms!important;transition-duration:.001ms!important}}
.lfd .card{position:absolute;top:20px;left:20px;z-index:2;width:360px;max-width:calc(100% - 40px);max-height:calc(100% - 40px);overflow:auto;border:1px solid var(--border);border-radius:16px;
  background:var(--card-bg);backdrop-filter:blur(12px);box-shadow:0 12px 34px rgba(0,0,0,.20),0 2px 10px rgba(0,0,0,.14);padding:18px 22px;color:var(--txt);user-select:text;cursor:auto}
.lfd .rail{display:flex;gap:5px;margin-bottom:14px}
.lfd .rail i{height:5px;flex:1;border-radius:4px;background:var(--dot);transition:background .3s}
.lfd .rail i.on{background:var(--orange)}
.lfd .cardhead{display:flex;align-items:center;gap:8px;margin-bottom:11px;min-height:22px}
.lfd .counter{margin-left:auto;font-size:11px;font-family:'SF Mono',Menlo,Consolas,monospace;color:var(--txt-muted)}
.lfd .card .title{font-size:19px;font-weight:700;line-height:1.25;margin-bottom:6px}
.lfd .card .flow{font-size:12.5px;color:var(--txt-muted);margin-bottom:11px}
.lfd .card .parties{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin-bottom:11px}
.lfd .card .pchip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:2px 8px 2px 5px;border-radius:11px;background:var(--orange);border:1px solid var(--orange);color:#16191f}
.lfd .card .pchip .pico{width:15px;height:15px;flex:none;object-fit:contain;border-radius:3px;background:#fff}
.lfd .card .pchip .pdot{width:9px;height:9px;flex:none;border-radius:50%}
.lfd .card .desc{font-size:13.5px;line-height:1.6;color:var(--txt-muted);margin-bottom:11px}
.lfd .card .proof{background:color-mix(in srgb,var(--txt) 6%,transparent);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.5;color:var(--txt)}
.lfd .card .proof a{color:var(--info);text-decoration:none}
.lfd .card .codeblk{margin-top:10px;border:1px solid var(--border);border-radius:8px;overflow:hidden}
.lfd .card .codeblk .hd{background:color-mix(in srgb,var(--txt) 6%,transparent);color:var(--txt-muted);font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;padding:5px 10px}
.lfd .card .codeblk pre{margin:0;padding:10px 12px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:11.5px;line-height:1.5;overflow:auto;white-space:pre;color:var(--txt)}
.lfd code{background:color-mix(in srgb,var(--txt) 8%,transparent);border:1px solid var(--border);border-radius:4px;padding:1px 5px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:11.5px}
.lfd .badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px}
.lfd .b-gate{color:var(--warn);background:color-mix(in srgb,var(--warn) 15%,transparent)}
.lfd .b-async,.lfd .b-sync,.lfd .b-phase{color:var(--info);background:color-mix(in srgb,var(--info) 15%,transparent)}
.lfd .b-fail{color:var(--danger);background:color-mix(in srgb,var(--danger) 15%,transparent)}
.lfd .b-start{color:var(--success);background:color-mix(in srgb,var(--success) 15%,transparent)}
.lfd .b-end{color:var(--neutral);background:color-mix(in srgb,var(--neutral) 18%,transparent)}
.lfd .legend{margin-top:14px;padding-top:12px;border-top:1px solid var(--border);font-size:11px;color:var(--txt-muted);display:flex;gap:10px 14px;flex-wrap:wrap}
.lfd .legend span{display:inline-flex;align-items:center;gap:5px}
.lfd .legend svg{display:block}
.lfd .pill{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);z-index:3;display:flex;align-items:center;gap:6px;padding:8px 14px;border:1px solid var(--border);border-radius:16px;background:var(--pill-bg);backdrop-filter:blur(12px);box-shadow:0 4px 20px rgba(0,0,0,.3)}
.lfd .pill .sep{width:1px;height:20px;background:var(--border);margin:0 5px}
.lfd .pbtn{height:32px;padding:0 10px;border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--txt);font:inherit;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
.lfd .pbtn:disabled{opacity:.35;cursor:default}
.lfd .pill svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2}
.lfd .node{transition:opacity .35s ease}
.lfd .node .box{fill:var(--nodebg);stroke:var(--accent);stroke-width:2;transition:stroke .25s,stroke-width .25s}
.lfd .node.k-start .box,.lfd .node.k-initial .box{stroke:var(--success)}
.lfd .node.k-initial .box{fill:var(--success)}
.lfd .node.k-final .fillinner{fill:var(--neutral)}
.lfd .node.k-final .box,.lfd .node.k-end .box{stroke:var(--neutral)}
.lfd .node.k-decision .box,.lfd .node.k-choice .box{stroke:var(--warn)}
.lfd .node.k-datastore .box,.lfd .node.k-wait .box{stroke:var(--info)}
.lfd .node.k-external .box{stroke:var(--neutral)}
.lfd .node .subbar{stroke:var(--accent);stroke-width:2}
.lfd .node .boxlip{stroke:var(--info);stroke-width:2;fill:none}
.lfd .node .nlabel{fill:var(--txt);font-size:13px;font-weight:700}
.lfd .node .nsub{fill:var(--txt-muted);font-size:11px}
.lfd .node .mk{fill:var(--txt);font-size:12px;font-weight:700}
.lfd .node.dim{opacity:.2}
.lfd .node.active .box{stroke:var(--active,${AWS_ORANGE})!important;stroke-width:3.4;filter:drop-shadow(0 0 6px color-mix(in srgb,var(--active,${AWS_ORANGE}) 55%,transparent))}
.lfd .edge path.line{fill:none;stroke:var(--msg);stroke-width:2;transition:stroke .25s,stroke-width .25s,opacity .3s}
.lfd .edge.k-back path.line,.lfd .edge.dashed path.line{stroke:var(--ret);stroke-dasharray:6 5}
.lfd .edge.k-async path.line{stroke:var(--info)}
.lfd .edge .elbl{font-size:11px;fill:var(--txt)}
.lfd .edge .elblbg{fill:var(--card-bg);opacity:.92}
.lfd .edge.dim{opacity:.14}
.lfd .edge.active path.line{stroke:var(--active,${AWS_ORANGE})!important;stroke-width:3.4;filter:drop-shadow(0 0 4px color-mix(in srgb,var(--active,${AWS_ORANGE}) 55%,transparent))}
.lfd .edge.active .elbl{font-weight:700}
`;

function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    read();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(read); ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function FlowNode({ n, m, x, y, iconSrc, cls }) {
  const hw = m.w / 2, hh = m.h / 2;
  const tone = n.tone && TONE[n.tone] ? { stroke: TONE[n.tone] } : undefined;
  let shape;
  if (m.shape === "dot") shape = <circle className="box" cx={x} cy={y} r={hw} style={tone} />;
  else if (m.shape === "ring") shape = <><circle className="box" cx={x} cy={y} r={hw} style={tone} /><circle className="fillinner" cx={x} cy={y} r={hw - 5} stroke="none" /></>;
  else if (m.shape === "diamond") shape = <polygon className="box" points={[[x, y - hh], [x + hw, y], [x, y + hh], [x - hw, y]].map(p => p.join(",")).join(" ")} style={tone} />;
  else if (m.shape === "cylinder") {
    const ry = 8;
    shape = <>
      <path className="box" style={tone} d={"M " + (x - hw) + "," + (y - hh + ry) + " A " + hw + " " + ry + " 0 0 1 " + (x + hw) + "," + (y - hh + ry) + " L " + (x + hw) + "," + (y + hh - ry) + " A " + hw + " " + ry + " 0 0 1 " + (x - hw) + "," + (y + hh - ry) + " Z"} />
      <path className="boxlip" d={"M " + (x - hw) + "," + (y - hh + ry) + " A " + hw + " " + ry + " 0 0 0 " + (x + hw) + "," + (y - hh + ry)} />
    </>;
  } else {
    const rx = m.shape === "stadium" ? hh : (m.shape === "rect" ? 2 : 12);
    shape = <>
      <rect className="box" x={x - hw} y={y - hh} width={m.w} height={m.h} rx={rx} style={tone} />
      {m.shape === "subroutine" && <>
        <line className="subbar" x1={x - hw + 7} y1={y - hh} x2={x - hw + 7} y2={y + hh} />
        <line className="subbar" x1={x + hw - 7} y1={y - hh} x2={x + hw - 7} y2={y + hh} />
      </>}
    </>;
  }
  let text;
  if (m.shape === "dot" || m.shape === "ring") {
    text = n.label ? <text className="mk" x={x} y={y + hh + 14} textAnchor="middle">{n.label}</text> : null;
  } else {
    const lx = m.hasIcon ? x - hw + 44 : x, la = m.hasIcon ? "start" : "middle";
    text = <>
      {m.hasIcon && <image href={iconSrc} x={x - hw + 10} y={y - 13} width="26" height="26" />}
      {n.sub
        ? <><text className="nlabel" x={lx} y={y - 1} textAnchor={la}>{n.label}</text><text className="nsub" x={lx} y={y + 14} textAnchor={la}>{n.sub}</text></>
        : <text className="nlabel" x={lx} y={y + 5} textAnchor={la}>{n.label}</text>}
    </>;
  }
  return <g className={cls} data-id={n.id}>{shape}{text}</g>;
}

export function FlowPlayer({
  flow, activeStep, onStepChange, iconUrl, theme, card = true, controls = false, interactive = true,
  background = true, gutter, className = "", style,
}) {
  const ref = useRef(null);
  const { w: SW, h: SH } = useSize(ref);
  const type = flow?.type || "workflow";
  const defKind = DEFAULT_KIND[type] || "box";
  const doc = useMemo(() => ({ ...flow, nodes: (flow?.nodes || []).map(n => ({ ...n, kind: n.kind || defKind })) }), [flow, defKind]);
  const iconOf = (n) => (n.icon && iconUrl ? iconUrl(n.icon) : null);
  const L = useMemo(() => layoutFlow(doc, { hasIcon: n => !!(n.icon && iconUrl && iconUrl(n.icon)) }), [doc, iconUrl]);
  const STEPS = doc.steps || [];
  const HAS_STEPS = STEPS.length > 0;
  const [own, setOwn] = useState(HAS_STEPS ? 0 : null);
  const controlled = activeStep !== undefined;
  const cur = controlled ? activeStep : own;
  const idx = HAS_STEPS && cur != null ? Math.max(0, Math.min(STEPS.length - 1, cur)) : null;
  const step = idx != null ? STEPS[idx] : null;
  const set = useMemo(() => flowActiveSet(doc, step), [doc, step]);
  const activeE = step ? new Set(step.edges || []) : null;
  const go = (d) => {
    if (!HAS_STEPS) return;
    const next = Math.max(0, Math.min(STEPS.length - 1, (idx ?? -1) + d));
    if (!controlled) setOwn(next);
    onStepChange?.(next);
  };

  // framing (same as the HTML player's frameStep), plus user pan/zoom on top
  const g = gutter != null ? gutter : (card && SW > 760 ? GUTTER : 24);
  const availW = Math.max(120, SW - g - 30), availH = Math.max(120, SH - 40);
  const frame = SW ? flowFrame(L, step && set && set.size ? set : null, availW, availH, g, 12) : { zoom: 1, tx: 0, ty: 0 };
  const [view, setView] = useState(null);           // user override {zoom,tx,ty}
  useEffect(() => { setView(null); }, [idx, SW, SH]);
  const v = view || frame;
  const drag = useRef(null);
  const onPointerDown = (e) => {
    if (!interactive || e.button !== 0 || e.target.closest?.(".card,.pill")) return;
    drag.current = { x: e.clientX, y: e.clientY, tx: v.tx, ty: v.ty, zoom: v.zoom };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.currentTarget.classList.add("grabbing");
  };
  const onPointerMove = (e) => {
    const d = drag.current; if (!d) return;
    setView({ zoom: d.zoom, tx: d.tx + (e.clientX - d.x), ty: d.ty + (e.clientY - d.y) });
  };
  const endDrag = (e) => { if (!drag.current) return; drag.current = null; e.currentTarget.classList.remove("grabbing"); };
  const zoomAt = (f, px, py) => {
    const nz = Math.max(0.25, Math.min(3, v.zoom * f));
    const sx = (px - v.tx) / v.zoom, sy = (py - v.ty) / v.zoom;
    setView({ zoom: nz, tx: px - sx * nz, ty: py - sy * nz });
  };
  useEffect(() => {
    const el = ref.current; if (!el || !interactive) return undefined;
    const onWheel = (e) => {
      if (e.target.closest?.(".card")) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const accent = (step && step.tone && TONE[step.tone]) || AWS_ORANGE;
  const legend = LEGENDS[type] || LEGENDS.workflow;
  const parties = set ? [...set].filter(id => L.nodeById[id]).slice(0, 8) : [];
  return (
    <div ref={ref} data-theme={theme} className={`lfd${interactive ? " lfd-pan" : ""}${background ? "" : " lfd-bare"} ${className}`}
      style={{ "--active": accent, ...style }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
      <style>{CSS}</style>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${L.W} ${L.H}`} width={L.W} height={L.H} role="img" aria-label={doc.title || "Flow diagram"}
        style={{ transform: `translate(${v.tx}px,${v.ty}px) scale(${v.zoom})`, transition: view ? "none" : "transform .45s cubic-bezier(.4,0,.2,1)" }}>
        <defs>
          <marker id="lfd-ah" markerWidth="11" markerHeight="11" refX="8.5" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L10,4 L0,8 z" fill="context-stroke" /></marker>
          <marker id="lfd-ao" markerWidth="13" markerHeight="11" refX="8.5" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L10,4 L0,8" fill="none" stroke="context-stroke" strokeWidth="1.6" /></marker>
        </defs>
        {L.edges.map(({ edge: e, isBack, d, label }) => {
          const on = activeE ? activeE.has(e.id) : false;
          const cls = "edge k-" + (e.kind || (isBack ? "back" : "flow")) + (e.dashed ? " dashed" : "") + (isBack ? " k-back" : "") + (on ? " active" : "") + (HAS_STEPS && activeE && !on ? " dim" : "");
          return (
            <g key={e.id} className={cls} data-id={e.id}>
              <path className="line" d={d} markerEnd={`url(#${e.kind === "async" ? "lfd-ao" : "lfd-ah"})`} style={e.tone && TONE[e.tone] ? { stroke: TONE[e.tone] } : undefined} />
              {label && <>
                <rect className="elblbg" x={label.x - label.w / 2} y={label.y - 9} width={label.w} height="16" rx="4" />
                <text className="elbl" x={label.x} y={label.y + 3} textAnchor="middle">{e.label}</text>
              </>}
            </g>
          );
        })}
        {L.nodes.map(n => {
          const on = set ? set.has(n.id) : false;
          const cls = "node k-" + (n.kind || "box") + (on ? " active" : "") + (HAS_STEPS && set && !on ? " dim" : "");
          return <FlowNode key={n.id} n={n} m={L.M[n.id]} x={L.X[n.id]} y={L.Y[n.id]} iconSrc={iconOf(n)} cls={cls} />;
        })}
      </svg>
      {card && (
        <div className="card">
          {HAS_STEPS && <div className="rail">{STEPS.map((_, i) => <i key={i} className={idx != null && i <= idx ? "on" : undefined} />)}</div>}
          <div className="cardhead">
            {step?.badge && <span className={`badge b-${step.badge}`}>{BADGE_TXT[step.badge] || step.badge}</span>}
            {step && <span className="counter">{idx + 1} / {STEPS.length}</span>}
          </div>
          <div className="title">{step ? step.title || "" : (doc.title || "Flow diagram")}</div>
          {step && parties.length > 0 && (
            <div className="parties">
              {parties.map(id => {
                const n = L.nodeById[id], src = iconOf(n);
                return <span key={id} className="pchip">{src ? <img className="pico" src={src} alt="" /> : <span className="pdot" style={{ background: (n.tone && TONE[n.tone]) || "var(--orange)" }} />}{n.label || id}</span>;
              })}
            </div>
          )}
          {step ? step.flow && <div className="flow">{step.flow}</div> : doc.subtitle && <div className="flow">{doc.subtitle}</div>}
          {step?.desc && <div className="desc" dangerouslySetInnerHTML={{ __html: md(step.desc) }} />}
          {step?.proof && <div className="proof" dangerouslySetInnerHTML={{ __html: proofHtml(step.proof) }} />}
          {step?.code && <div className="codeblk"><div className="hd">{step.codeLabel || "code"}</div><pre>{step.code}</pre></div>}
          <div className="legend">{legend.map(([ico, txt]) => <span key={txt}>{ico} {txt}</span>)}</div>
        </div>
      )}
      {controls && (
        <div className="pill">
          <button type="button" className="pbtn" title="Zoom out" onClick={() => zoomAt(1 / 1.15, SW / 2, SH / 2)}><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3M8 11h6" /></svg></button>
          <button type="button" className="pbtn" title="Fit to view" onClick={() => setView(null)}><svg viewBox="0 0 24 24"><path d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m11.25-5.25v4.5m0-4.5h-4.5m4.5 0L15 9m-11.25 11.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 5.25v-4.5m0 4.5h-4.5m4.5 0L15 15" /></svg></button>
          <button type="button" className="pbtn" title="Zoom in" onClick={() => zoomAt(1.15, SW / 2, SH / 2)}><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3M11 8v6m-3-3h6" /></svg></button>
          {HAS_STEPS && <>
            <span className="sep" />
            <button type="button" className="pbtn" title="Previous" disabled={idx == null || idx <= 0} onClick={() => go(-1)}><svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg></button>
            <button type="button" className="pbtn" title="Next" disabled={idx != null && idx >= STEPS.length - 1} onClick={() => go(1)}><svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg></button>
          </>}
        </div>
      )}
    </div>
  );
}

export default FlowPlayer;
