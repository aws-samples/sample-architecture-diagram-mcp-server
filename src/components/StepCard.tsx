// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Overlay card for a guided-walkthrough beat. Floats over the canvas (left/right/
// top) or covers it as a full-page modal. Built from the shared cardKit so it
// matches the NodeModal visual language exactly.
import { TONE_META, resolveToneColor, type Tone } from "@/lib/tones";
import { cardShell, CardHeader, Body, Bullets, Section, Chips, type Chip, type BulletItem } from "@/components/cardKit";

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

export default function StepCard({ steps, activeStep }: { steps: WalkStep[]; activeStep: number }) {
  const idx = Math.min(Math.max(activeStep, 0), steps.length - 1);
  const step = steps[idx] || {};
  const tone = (step.tone || "accent") as Tone;
  const color = resolveToneColor(step.tone, step.color);
  const meta = TONE_META[tone] || TONE_META.accent;
  const badgeLabel = step.badge != null ? step.badge : meta.label;
  const showBadge = badgeLabel !== false && badgeLabel !== "";
  const isFull = step.cardSide === "full";

  const counter = (
    <span style={{ marginLeft: "auto", fontSize: 11, fontFamily: "'SF Mono', Menlo, monospace", color: "var(--txt-muted, #94a3b8)" }}>{idx + 1}/{steps.length}</span>
  );

  return (
    <div style={cardShell(color, { full: isFull })}>
      {/* progress rail */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            height: 6, flex: 1, borderRadius: 999,
            background: i <= idx ? resolveToneColor(s.tone, s.color) : "var(--dot, rgba(255,255,255,0.12))",
            transition: "background .3s",
          }} />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {/* badge + step counter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {showBadge && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, color, background: `${color}1F` }}>
              {meta.glyph && <span>{meta.glyph}</span>}{badgeLabel}
            </span>
          )}
          {counter}
        </div>

        <CardHeader icon={step.icon} eyebrow={step.eyebrow} title={step.title} color={color} big={isFull} />

        {step.body && <Body big={isFull}>{step.body}</Body>}
        {step.bullets && <Bullets items={step.bullets} color={color} />}

        {Array.isArray(step.sections) && step.sections.map((sec, si) => (
          <Section key={si} title={sec.title} color={color}>
            {sec.body && <Body>{sec.body}</Body>}
            {sec.bullets && <Bullets items={sec.bullets} color={color} />}
          </Section>
        ))}

        {step.chips && <Chips chips={step.chips} color={color} />}
      </div>
    </div>
  );
}
