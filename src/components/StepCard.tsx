// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Overlay card for a guided-walkthrough beat. Floats over the canvas (left/right/
// top) or covers it as a full-page modal. Built from the shared cardKit (Tailwind
// + framer-motion) so it matches the NodeModal + the deck's LiveDiagram card.
import { AnimatePresence, motion } from "framer-motion";
import { TONE_META, resolveToneColor, type Tone } from "@/lib/tones";
import { CardShell, CardHeader, Body, Bullets, Section, Chips, type Chip, type BulletItem } from "@/components/cardKit";
import { tr, type Lang } from "@/lib/i18n";

// Content fields may be a plain string or a { <lang>: string } map — resolve
// scalars with tr(); bullet arrays resolve each item's text.
type L = string | Record<string, string>;
function resolveBullets(items: (BulletItem | { text: L; strong?: L; color?: string; icon?: string; glyph?: string })[] | undefined, lang: Lang): BulletItem[] | undefined {
  if (!items) return undefined;
  return items.map((b) => typeof b === "string" ? tr(b as any, lang)
    : { ...b, text: tr((b as any).text, lang), strong: (b as any).strong != null ? tr((b as any).strong, lang) : undefined });
}

export type StepChip = Chip;
export interface StepSection { title?: string; body?: string; bullets?: BulletItem[] }
export interface WalkStep {
  nodes?: string[]; edges?: string[]; groups?: string[];
  tone?: Tone; color?: string; tones?: Record<string, Tone>; edgeTones?: Record<string, Tone>; groupTones?: Record<string, Tone>;
  zoom?: string[]; maxZoom?: number; cardSide?: "left" | "right" | "top" | "full";
  eyebrow?: string; icon?: string; title?: string; body?: string;
  badge?: string | false; bullets?: BulletItem[]; chips?: StepChip[];
  sections?: StepSection[];
}

export default function StepCard({ steps, activeStep, lang = "en" }: { steps: WalkStep[]; activeStep: number; lang?: Lang }) {
  const idx = Math.min(Math.max(activeStep, 0), steps.length - 1);
  const step = steps[idx] || {};
  const tone = (step.tone || "accent") as Tone;
  const color = resolveToneColor(step.tone, step.color);
  const meta = TONE_META[tone] || TONE_META.accent;
  const badgeLabel = step.badge === false ? false : (step.badge != null ? tr(step.badge as any, lang) : meta.label);
  const showBadge = badgeLabel !== false && badgeLabel !== "";
  const isFull = step.cardSide === "full";
  const chips = step.chips?.map((c) => ({ ...c, label: tr(c.label as any, lang) }));

  return (
    <CardShell color={color} full={isFull}>
      {/* progress rail */}
      <div className="flex gap-1.5 mb-3.5">
        {steps.map((s, i) => (
          <div key={i} className="h-1.5 flex-1 rounded-full transition-colors duration-300"
            style={{ background: i <= idx ? resolveToneColor(s.tone, s.color) : "var(--dot, rgba(255,255,255,0.12))" }} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={idx}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          className="flex flex-col gap-[11px]">
          {/* badge + step counter */}
          <div className="flex items-center gap-2">
            {showBadge && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ color, background: `${color}1F` }}>
                {meta.glyph && <span>{meta.glyph}</span>}{badgeLabel}
              </span>
            )}
            <span className="ml-auto text-[11px] font-mono text-[color:var(--txt-muted,#94a3b8)]">{idx + 1}/{steps.length}</span>
          </div>

          <CardHeader icon={step.icon} eyebrow={tr(step.eyebrow as any, lang)} title={tr(step.title as any, lang)} color={color} big={isFull} />

          {step.body && <Body big={isFull}>{tr(step.body as any, lang)}</Body>}
          {step.bullets && <Bullets items={resolveBullets(step.bullets as any, lang)!} color={color} />}

          {Array.isArray(step.sections) && step.sections.map((sec, si) => (
            <Section key={si} title={tr(sec.title as any, lang)} color={color}>
              {sec.body && <Body>{tr(sec.body as any, lang)}</Body>}
              {sec.bullets && <Bullets items={resolveBullets(sec.bullets as any, lang)!} color={color} />}
            </Section>
          ))}

          {chips && <Chips chips={chips} color={color} />}
        </motion.div>
      </AnimatePresence>
    </CardShell>
  );
}
