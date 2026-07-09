// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Compact floating card OVERLAID on the diagram canvas for guided walkthroughs.
// Sits inside the drawing (absolute-positioned by the parent) so the
// architecture keeps its full size instead of being pushed aside. Ported from
// the slide-deck LiveDiagram StepCard (Tailwind → inline styles).
import { resolveIcon } from "@/lib/icons";
import { TONE_COLORS, TONE_META, type Tone } from "@/lib/tones";

export interface StepChip { label: string; ok?: true | false | "warn"; icon?: string; }
export interface WalkStep {
  nodes?: string[]; edges?: string[]; groups?: string[];
  tone?: Tone; tones?: Record<string, Tone>; edgeTones?: Record<string, Tone>; groupTones?: Record<string, Tone>;
  zoom?: string[]; maxZoom?: number; cardSide?: "left" | "right" | "top";
  eyebrow?: string; icon?: string; title?: string; body?: string;
  badge?: string | false; bullets?: string[]; chips?: StepChip[];
}

export default function StepCard({ steps, activeStep }: { steps: WalkStep[]; activeStep: number }) {
  const idx = Math.min(Math.max(activeStep, 0), steps.length - 1);
  const step = steps[idx] || {};
  const tone = (step.tone || "survive") as Tone;
  const color = TONE_COLORS[tone] || TONE_COLORS.survive;
  const meta = TONE_META[tone] || TONE_META.survive;
  const badgeLabel = step.badge != null ? step.badge : meta.label;
  const showBadge = badgeLabel !== false && badgeLabel !== "";

  return (
    <div style={{
      borderRadius: 16, overflow: "hidden",
      border: `1px solid ${color}66`,
      background: "var(--card-bg, rgba(24,28,40,0.92))",
      boxShadow: `0 10px 30px ${color}30, 0 2px 8px rgba(0,0,0,0.15)`,
      backdropFilter: "blur(8px)",
      padding: "16px 20px",
    }}>
      {/* progress rail */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            height: 6, flex: 1, borderRadius: 999,
            background: i <= idx ? (TONE_COLORS[(s.tone || tone) as Tone] || color) : "var(--dot, rgba(255,255,255,0.12))",
            transition: "background .3s",
          }} />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {showBadge && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, color, background: `${color}1F` }}>
              <span>{meta.glyph}</span>{badgeLabel}
            </span>
          )}
          <span style={{ marginLeft: "auto", fontSize: 11, fontFamily: "monospace", color: "var(--txt-muted, #94a3b8)" }}>{idx + 1}/{steps.length}</span>
        </div>

        {step.eyebrow && (
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color }}>{step.eyebrow}</span>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {step.icon && (
            <span style={{ width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(255,255,255,0.06)", border: `1.5px solid ${color}55` }}>
              <img src={resolveIcon(step.icon) ?? String(step.icon)} alt="" width={24} height={24} style={{ objectFit: "contain" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </span>
          )}
          {step.title && <h3 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.15, color: "var(--txt, #e2e8f0)", margin: 0 }}>{step.title}</h3>}
        </div>

        {step.body && <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--txt-muted, #cbd5e1)", margin: 0 }}>{step.body}</p>}

        {Array.isArray(step.bullets) && step.bullets.length > 0 && (
          <ul style={{ display: "flex", flexDirection: "column", gap: 6, margin: "2px 0 0", padding: 0, listStyle: "none" }}>
            {step.bullets.map((b, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, lineHeight: 1.35, color: "var(--txt-muted, #cbd5e1)" }}>
                <span style={{ marginTop: 6, width: 6, height: 6, borderRadius: 999, flexShrink: 0, background: color }} />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        {Array.isArray(step.chips) && step.chips.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            {step.chips.map((c, i) => {
              const cc = c.ok === true ? "#10B981" : c.ok === false ? "#EF4444" : c.ok === "warn" ? "#F59E0B" : color;
              const glyph = c.ok === true ? "✓" : c.ok === false ? "✗" : c.ok === "warn" ? "≈" : null;
              return (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, color: "var(--txt, #e2e8f0)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  {c.icon && <img src={resolveIcon(c.icon) ?? c.icon} alt="" width={14} height={14} style={{ objectFit: "contain" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                  {glyph
                    ? <span style={{ fontWeight: 900, color: cc }}>{glyph}</span>
                    : <span style={{ width: 6, height: 6, borderRadius: 999, flexShrink: 0, background: cc }} />}
                  {c.label}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
