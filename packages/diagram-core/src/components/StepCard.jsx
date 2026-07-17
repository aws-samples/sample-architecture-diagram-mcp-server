// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The ONE walkthrough-beat card, built from the shared cardKit — used by every
// step layout (drawer / panel / overlay / full). The host positions/animates it
// (see the app); this renders the content: progress rail, tone badge + counter,
// header (icon+eyebrow+title), body, rich bullets, sections, and chips. Content
// fields may be plain strings or { <lang>: string } maps (resolved via tr).
import { AnimatePresence, motion } from "framer-motion";
import { TONE_META, resolveToneColor } from "../tones.js";
import { tr } from "../i18n.js";
import { CardShell, CardHeader, Body, Bullets, Section, Chips, CodeBlock, NumberedSteps } from "./cardKit.jsx";

function resolveBullets(items, lang) {
  if (!items) return undefined;
  return items.map((b) => typeof b === "string" ? tr(b, lang)
    : { ...b, text: tr(b.text, lang), strong: b.strong != null ? tr(b.strong, lang) : undefined });
}

export default function StepCard({ steps, activeStep, lang = "en", Icon, onPick, expanded = false, onToggleExpand, expandLabel = "Expandir", collapseLabel = "Recolher" }) {
  const idx = Math.min(Math.max(activeStep, 0), steps.length - 1);
  const step = steps[idx] || {};
  const tone = step.tone || "accent";
  const color = resolveToneColor(step.tone, step.color);
  const meta = TONE_META[tone] || TONE_META.accent;
  // Badge is opt-IN: shown only when a step explicitly sets `badge` to a label.
  // (Architecture walkthroughs use the eyebrow, so the tone badge is off by default.)
  const badgeLabel = step.badge && step.badge !== true ? tr(step.badge, lang) : false;
  const showBadge = badgeLabel !== false && badgeLabel !== "";
  // `full` sizing is used both by author-pinned full-page steps AND by the
  // viewer-driven expand toggle (onToggleExpand present).
  const isFull = step.cardSide === "full" || expanded;
  const chips = step.chips?.map((c) => ({ ...c, label: tr(c.label, lang) }));

  // Step-flow rail — same aesthetic as the (now-removed) external pill, but
  // hosted in its own header band (see CardShell `header`): numbered circles
  // joined by connectors, done beats filled, the active beat expands to show
  // its eyebrow; a N/total counter sits at the right. The whole rail is the
  // navigation (click a number to jump).
  const flowRail = (
    <div className="flex items-center gap-2" style={{ pointerEvents: "auto" }}>
      <div className="flex items-center flex-wrap gap-y-1 flex-1 min-w-0">
        {steps.map((s, i) => {
          const c = resolveToneColor(s.tone, s.color);
          const active = i === idx;
          const done = i < idx;
          const on = active || done;
          const eyebrow = tr(s.eyebrow, lang);
          return (
            <div key={i} className="flex items-center">
              {i > 0 && <span style={{ width: 12, height: 2, borderRadius: 2, background: i <= idx ? c : "var(--border, rgba(148,163,184,0.3))", transition: "background .25s" }} />}
              <button type="button" onClick={onPick ? () => onPick(i) : undefined} title={eyebrow || `${i + 1}`} aria-label={eyebrow || `${i + 1}`}
                style={{ display: "flex", alignItems: "center", gap: 6, cursor: onPick ? "pointer" : "default",
                  height: 24, padding: active ? "0 10px 0 3px" : 0, minWidth: 24,
                  borderRadius: 999, border: "none", transition: "all .25s", background: active ? c : "transparent" }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  width: 20, height: 20, borderRadius: "50%", fontSize: 10.5, fontWeight: 800,
                  border: on ? "none" : "1.5px solid var(--border, rgba(148,163,184,0.4))",
                  background: active ? "rgba(255,255,255,0.28)" : done ? c : "transparent",
                  color: active ? "#fff" : done ? "#fff" : "var(--txt-muted, #94a3b8)" }}>{i + 1}</span>
                {active && eyebrow && (
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: 0.4 }}>
                    {eyebrow.replace(/^\d+\s*·\s*/, "")}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
      <span className="font-mono text-[11px] shrink-0" style={{ color: "var(--txt-muted, #94a3b8)" }}>{idx + 1}/{steps.length}</span>
      {onToggleExpand && (
        <button type="button" onClick={onToggleExpand}
          title={expanded ? collapseLabel : expandLabel} aria-label={expanded ? collapseLabel : expandLabel}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            width: 24, height: 24, marginLeft: 2, borderRadius: 7, cursor: "pointer",
            border: "1px solid var(--border, rgba(148,163,184,0.4))", background: "transparent",
            color: "var(--txt-muted, #94a3b8)", pointerEvents: "auto" }}>
          {expanded
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 9 4 4m0 0v5m0-5h5m6 6 5 5m0 0v-5m0 5h-5M9 15l-5 5m0 0v-5m0 5h5m6-6 5-5m0 0v5m0-5h-5"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>}
        </button>
      )}
    </div>
  );

  return (
    <CardShell color={color} full={isFull} header={flowRail}>
      <AnimatePresence mode="wait">
        <motion.div key={idx}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          className="flex flex-col gap-[11px]">
          {showBadge && (
            <span className="inline-flex items-center self-start gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ color, background: `${color}1F` }}>
              {meta.glyph && <span>{meta.glyph}</span>}{badgeLabel}
            </span>
          )}

          {/* eyebrow pill omitted here — the active beat in the header step-flow
              rail already shows it; showing it twice was redundant. */}
          <CardHeader icon={step.icon} title={tr(step.title, lang)} color={color} big={isFull} Icon={Icon} />

          {step.body && <Body big={isFull}>{tr(step.body, lang)}</Body>}
          {step.bullets && <Bullets items={resolveBullets(step.bullets, lang)} color={color} Icon={Icon} />}
          {step.process && <NumberedSteps items={step.process.map(p => typeof p === "string" ? { text: tr(p, lang) } : { ...p, label: tr(p.label, lang), text: tr(p.text, lang) })} color={color} Icon={Icon} />}
          {step.code && <CodeBlock code={tr(step.code, lang)} label={step.codeLabel != null ? tr(step.codeLabel, lang) : undefined} color={color} />}

          {Array.isArray(step.sections) && step.sections.map((sec, si) => (
            <Section key={si} title={tr(sec.title, lang)} color={color}>
              {sec.body && <Body>{tr(sec.body, lang)}</Body>}
              {sec.bullets && <Bullets items={resolveBullets(sec.bullets, lang)} color={color} Icon={Icon} />}
            </Section>
          ))}

          {chips && <Chips chips={chips} color={color} Icon={Icon} />}
        </motion.div>
      </AnimatePresence>
    </CardShell>
  );
}
