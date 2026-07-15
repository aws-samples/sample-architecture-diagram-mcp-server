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

export default function StepCard({ steps, activeStep, lang = "en", Icon }) {
  const idx = Math.min(Math.max(activeStep, 0), steps.length - 1);
  const step = steps[idx] || {};
  const tone = step.tone || "accent";
  const color = resolveToneColor(step.tone, step.color);
  const meta = TONE_META[tone] || TONE_META.accent;
  // Badge is opt-IN: shown only when a step explicitly sets `badge` to a label.
  // (Architecture walkthroughs use the eyebrow, so the tone badge is off by default.)
  const badgeLabel = step.badge && step.badge !== true ? tr(step.badge, lang) : false;
  const showBadge = badgeLabel !== false && badgeLabel !== "";
  const isFull = step.cardSide === "full";
  const chips = step.chips?.map((c) => ({ ...c, label: tr(c.label, lang) }));

  return (
    <CardShell color={color} full={isFull}>
      {/* Step indicator (progress rail + counter) intentionally omitted — the
          external StepFlow rail already shows position/navigation. */}
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

          <CardHeader icon={step.icon} eyebrow={tr(step.eyebrow, lang)} title={tr(step.title, lang)} color={color} big={isFull} Icon={Icon} />

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
