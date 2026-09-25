// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Shared visual primitives for the overlay cards (StepCard walkthrough +
// NodeModal). Both render the SAME building blocks so they look identical.
// Styled with Tailwind; the accent colour is dynamic (inline). Theme surfaces
// read CSS vars (--card-bg / --txt / --txt-muted / --border / --dot / --chip-bg)
// set by the host app, so light/dark both work.
//
// Icons are drawn by an injected `Icon` component (the shared core Icon, wired
// with the host's resolveAsset/iconBase) passed via the `Icon` prop on the
// pieces that render one (IconTile / CardHeader / Bullets / Chips).
import { useState } from "react";
import { resolveVariant } from "../groupVariants.js";

// Minimal inline-markdown renderer for card text: **bold**, `code`, *italic*,
// and [label](https://url) links (open in a new tab; http/https only).
// Returns an array of React nodes; safe (no HTML injection — plain spans/anchors only).
// Keeps author text readable while allowing light emphasis and inline code.
export function mdInline(str) {
  if (typeof str !== "string") return str;
  const out = [];
  const re = /(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*)/g;
  let last = 0, m, k = 0;
  while ((m = re.exec(str))) {
    if (m.index > last) out.push(str.slice(last, m.index));
    if (m[2] != null && m[3] != null) out.push(
      <a key={k++} href={m[3]} target="_blank" rel="noopener noreferrer"
        className="underline decoration-dotted underline-offset-2 text-[color:var(--accent,#22c55e)] hover:opacity-80">{m[2]}</a>);
    else if (m[4] != null) out.push(<strong key={k++} className="font-bold text-[color:var(--txt,#e2e8f0)]">{m[4]}</strong>);
    else if (m[5] != null) out.push(
      <code key={k++} className="font-mono text-[0.92em] px-1 py-px rounded bg-[color:var(--chip-bg,rgba(148,163,184,0.16))] border border-[color:var(--border,rgba(255,255,255,0.12))]">{m[5]}</code>);
    else if (m[6] != null) out.push(<em key={k++} className="italic">{m[6]}</em>);
    last = m.index + m[0].length;
  }
  if (last < str.length) out.push(str.slice(last));
  return out;
}

// Fenced code block for the card — a labeled request/snippet (e.g. the POST).
// Pass { code, lang?, label? }. Monospace, scrollable, subtle surface.
// `onSend` (stage mode, see stage.js) adds a second button next to `copiar`
// that types this snippet on the stage's live prompt, un-executed — so the
// presenter only presses Enter and nothing is pasted on camera.
export function CodeBlock({ code, label, color, onSend, sendLabel = "cmd", sendTitle }) {
  if (!code) return null;
  const c = color || "#475569";
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const copy = () => {
    try { navigator.clipboard?.writeText(code); } catch { /* clipboard blocked (file://) — no-op */ }
    setCopied(true); setTimeout(() => setCopied(false), 1400);
  };
  const send = () => { onSend?.(); setSent(true); setTimeout(() => setSent(false), 1400); };
  const btn = "flex items-center gap-1 px-1.5 py-0.5 rounded text-white/90 hover:text-white hover:bg-white/20 transition-colors normal-case tracking-normal font-semibold";
  return (
    <div className="rounded-lg overflow-hidden border" style={{ borderColor: `${c}40` }}>
      <div className="flex items-center justify-between px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-white" style={{ background: c }}>
        <span>{label || "código"}</span>
        <span className="flex items-center gap-0.5">
          {onSend && (
            <button type="button" onClick={send} className={btn}
              title={sendTitle || "Digitar este comando no prompt (sem executar)"}>
              {sent
                ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>{sendLabel}</>
                : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 10 4 4-4 4"/><path d="M20 4v7a3 3 0 0 1-3 3H13"/></svg>{sendLabel}</>}
            </button>
          )}
          <button type="button" onClick={copy} className={btn} title="Copiar">
            {copied
              ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>copiado</>
              : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>copiar</>}
          </button>
        </span>
      </div>
      <pre className="m-0 px-3 py-2.5 text-[12px] leading-relaxed font-mono whitespace-pre overflow-x-auto text-[color:var(--txt,#e2e8f0)] bg-[color:var(--chip-bg,rgba(148,163,184,0.1))]">{code}</pre>
    </div>
  );
}

export function CardShell({ color, full, header, footer, children }) {
  // Optional `header` renders as a full-bleed band (its own surface + divider),
  // OUTSIDE the body padding, so a step-flow rail reads as a distinct header
  // strip. Body keeps the usual padding; when `full`, the body scrolls but the
  // header stays pinned on top. Optional `footer` is the mirror band at the
  // bottom (stage terminal slot) — also outside the scrolling body, so it stays
  // put while a long beat scrolls.
  const bodyPad = full ? "px-7 py-6" : "px-[22px] py-[18px]";
  return (
    <div
      // max-h: cap at 88vh on its own, but also never exceed the wrapper
      // (max-h-full) — so a side card whose wrapper sets maxHeight can grow to
      // that and then scroll its body, instead of being clipped at a fixed 88vh.
      className="relative rounded-2xl border text-[color:var(--txt,#e2e8f0)] overflow-hidden flex flex-col max-h-[88vh] [max-height:100%]"
      // Fully opaque surface (no blur) so text never competes with the diagram
      // behind it; a thicker accent border + a top accent bar anchor the tone.
      // pointerEvents:auto re-enables interaction on the card itself — the
      // StepOverlay wrapper sets pointerEvents:none so clicks on the empty area
      // AROUND the card still pan the canvas, but that also swallowed clicks on
      // the card's own links/CTA/code-copy; the card must opt back in.
      style={{ pointerEvents: "auto", borderColor: `${color}59`, background: "var(--card-solid, var(--card-bg, #181c28))", boxShadow: `0 16px 40px ${color}2e, 0 4px 14px rgba(0,0,0,0.28)` }}
    >
      <span className="absolute top-0 left-0 right-0 h-1 z-10" style={{ background: color }} aria-hidden />
      {header && (
        <div className="shrink-0 px-4 pt-3 pb-2.5 border-b"
          style={{ borderColor: `${color}33`, background: `${color}0f` }}>
          {header}
        </div>
      )}
      {/* Body scrolls whenever the card is height-constrained (full modal OR a
          side card capped by its wrapper), so long content never clips. */}
      <div className={`${bodyPad} overflow-y-auto min-h-0`}>
        {children}
      </div>
      {footer && (
        <div className="shrink-0 px-3 pt-2.5 pb-3 border-t"
          style={{ borderColor: `${color}33`, background: `${color}0f` }}>
          {footer}
        </div>
      )}
    </div>
  );
}

export function IconTile({ icon, color, size = 38, Icon }) {
  const inner = Math.round(size * 0.64);
  return (
    <span className="flex items-center justify-center shrink-0 rounded-lg border" style={{ width: size, height: size, background: `${color}14`, borderColor: `${color}55` }}>
      {Icon && <Icon src={icon} size={inner} alt="" style={{ objectFit: "contain" }} />}
    </span>
  );
}

export function CardHeader({ icon, eyebrow, title, color, big, trailing, Icon }) {
  return (
    <div className="flex items-center gap-[11px]">
      {icon && <IconTile icon={icon} color={color} size={big ? 44 : 38} Icon={Icon} />}
      <div className="flex-1 min-w-0">
        {eyebrow && (
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold uppercase tracking-widest text-white"
            style={{ background: color }}>{eyebrow}</span>
        )}
        {/* When there's no eyebrow pill, the title occupies the row alone (no top gap). */}
        {title && <h3 className={`${big ? "text-[25px]" : "text-[19px]"} font-bold leading-tight m-0 ${eyebrow ? "mt-1" : ""} text-[color:var(--txt,#e2e8f0)]`}>{title}</h3>}
      </div>
      {trailing}
    </div>
  );
}

export function Body({ children, big }) {
  // Higher-contrast body: use the primary text colour (not muted) so the lead
  // paragraph reads cleanly on both light and dark card surfaces.
  return <p className={`${big ? "text-[15px]" : "text-[13.5px]"} leading-relaxed m-0 text-[color:var(--txt,#e2e8f0)] opacity-90`}>{typeof children === "string" ? mdInline(children) : children}</p>;
}

// Numbered process list — a sequence of steps, each a colored numbered bubble +
// bold label + description (sisu-mec "Corte zero-downtime" style). Item shape:
// { label, text, color?, ok? }. `ok:true` swaps the number for a ✓ (done step).
export function NumberedSteps({ items, color, Icon }) {
  if (!items?.length) return null;
  return (
    <ol className="flex flex-col gap-2 m-0 p-0 list-none">
      {items.map((it, i) => {
        const o = typeof it === "string" ? { text: it } : it;
        const c = o.color || color || "#8C4FFF";
        return (
          <li key={i} className="flex items-center gap-3">
            <span className="flex items-center justify-center shrink-0 rounded-full text-white font-black"
              style={{ width: 24, height: 24, fontSize: 12, background: c, boxShadow: `0 0 10px ${c}66` }}>
              {o.ok === true
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                : (i + 1)}
            </span>
            <div className="flex items-baseline gap-2 min-w-0 rounded-lg px-3 py-1.5 flex-1 backdrop-blur-sm"
              style={{ background: "var(--chip-bg, rgba(148,163,184,0.1))", border: `1px solid ${c}33`, borderLeft: `3px solid ${c}` }}>
              {o.label && <span className="text-[13px] font-bold shrink-0" style={{ color: c }}>{mdInline(o.label)}</span>}
              {o.text && <span className="text-[12.5px] text-[color:var(--txt,#e2e8f0)] opacity-90">{mdInline(o.text)}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const GLYPH_COLOR = { "✓": "#10B981", "✕": "#EF4444", "≈": "#F59E0B", "△": "#F59E0B" };

export function Bullets({ items, color, Icon }) {
  if (!items?.length) return null;
  return (
    <ul className="flex flex-col gap-1.5 mt-0.5 p-0 list-none">
      {items.map((b, i) => {
        const o = typeof b === "string" ? { text: b } : b;
        const mk = o.color || (o.glyph && GLYPH_COLOR[o.glyph]) || color;
        let strong = o.strong, text = o.text;
        if (!strong) {
          const m = /^(.{2,40}?)\s*[—:]\s+(.+)$/.exec(o.text);
          if (m) { strong = m[1]; text = m[2]; }
        }
        return (
          <li key={i} className="flex items-start gap-[9px] text-[13px] leading-snug text-[color:var(--txt,#e2e8f0)] opacity-90">
            {o.icon
              ? <IconTile icon={o.icon} color={mk} size={18} Icon={Icon} />
              : o.glyph
                ? <span className="mt-px shrink-0 font-black text-xs w-3.5 text-center" style={{ color: mk }}>{o.glyph}</span>
                : <span className="mt-[7px] w-[5px] h-[5px] rounded-full shrink-0" style={{ background: mk }} />}
            <span>
              {strong && <span className="font-bold text-[color:var(--txt,#e2e8f0)] opacity-100">{mdInline(strong)}{text ? " — " : ""}</span>}
              {mdInline(text)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function Section({ title, color, children }) {
  return (
    <div className="flex flex-col gap-2 pt-3.5 mt-1 border-t-2 border-[color:var(--border,rgba(255,255,255,0.08))]">
      {title && (
        <h4 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide m-0" style={{ color }}>
          <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: color }} aria-hidden />
          {title}
        </h4>
      )}
      {children}
    </div>
  );
}

export function KeyValues({ rows }) {
  if (!rows?.length) return null;
  return (
    <div className="grid gap-x-4 gap-y-1" style={{ gridTemplateColumns: "auto 1fr" }}>
      {rows.map(([k, v], i) => [
        <span key={`k${i}`} className="text-xs font-mono text-[color:var(--txt-muted,#94a3b8)]">{k}</span>,
        <span key={`v${i}`} className="text-xs font-semibold text-[color:var(--txt,#e2e8f0)]">{String(v)}</span>,
      ])}
    </div>
  );
}

const CHIP_COLOR = { true: "#10B981", false: "#EF4444", warn: "#F59E0B" };
const CHIP_GLYPH = { true: "✓", false: "✗", warn: "≈" };
export function Chips({ chips, color, Icon }) {
  if (!chips?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-0.5">
      {chips.map((c, i) => {
        const key = c.ok === true ? "true" : c.ok === false ? "false" : c.ok === "warn" ? "warn" : null;
        const cc = key ? CHIP_COLOR[key] : color;
        return (
          <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold text-[color:var(--txt,#e2e8f0)]"
            style={{ background: `${cc}1a`, border: `1.5px solid ${cc}59` }}>
            {c.icon && Icon && <Icon src={c.icon} size={16} alt="" style={{ objectFit: "contain" }} />}
            {key ? <span className="font-black" style={{ color: cc }}>{CHIP_GLYPH[key]}</span> : <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cc }} />}
            {c.label}
          </span>
        );
      })}
    </div>
  );
}

export { resolveVariant };
