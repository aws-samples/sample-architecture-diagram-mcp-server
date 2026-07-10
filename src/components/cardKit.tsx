// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Shared visual primitives for the overlay cards (StepCard walkthrough + the
// NodeModal node-detail). Both cards render the SAME building blocks so they
// look identical: accent-bordered blurred shell, icon+eyebrow+title header,
// body/bullets/sections, key-value rows, and status chips.
import type { CSSProperties, ReactNode } from "react";
import { resolveIcon, iconFilter } from "@/lib/icons";

// ── Shell ────────────────────────────────────────────────────────────────────
export function cardShell(color: string, opts: { full?: boolean } = {}): CSSProperties {
  return {
    borderRadius: 16,
    border: `1px solid ${color}66`,
    background: "var(--card-bg, rgba(24,28,40,0.92))",
    boxShadow: `0 12px 34px ${color}26, 0 2px 10px rgba(0,0,0,0.22)`,
    backdropFilter: "blur(10px)",
    padding: opts.full ? "26px 30px" : "18px 22px",
    maxHeight: opts.full ? "82vh" : undefined,
    overflowY: opts.full ? "auto" : undefined,
    color: "var(--txt, #e2e8f0)",
  };
}

// ── Icon tile ──────────────────────────────────────────────────────────────
export function IconTile({ icon, color, size = 38 }: { icon: string; color: string; size?: number }) {
  const inner = Math.round(size * 0.64);
  return (
    <span style={{ width: size, height: size, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: `${color}14`, border: `1.5px solid ${color}55` }}>
      <img src={resolveIcon(icon) ?? String(icon)} alt="" width={inner} height={inner} style={{ objectFit: "contain", filter: iconFilter(icon) }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
    </span>
  );
}

// ── Header (icon + eyebrow + title, optional trailing slot) ──────────────────
export function CardHeader({ icon, eyebrow, title, color, big, trailing }: {
  icon?: string; eyebrow?: string; title?: string; color: string; big?: boolean; trailing?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      {icon && <IconTile icon={icon} color={color} size={big ? 44 : 38} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        {eyebrow && <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color }}>{eyebrow}</div>}
        {title && <h3 style={{ fontSize: big ? 25 : 19, fontWeight: 700, lineHeight: 1.18, color: "var(--txt, #e2e8f0)", margin: eyebrow ? "2px 0 0" : 0 }}>{title}</h3>}
      </div>
      {trailing}
    </div>
  );
}

// ── Body paragraph ───────────────────────────────────────────────────────────
export function Body({ children, big }: { children: ReactNode; big?: boolean }) {
  return <p style={{ fontSize: big ? 15 : 14, lineHeight: 1.6, color: "var(--txt-muted, #cbd5e1)", margin: 0 }}>{children}</p>;
}

// ── Bullet list ──────────────────────────────────────────────────────────────
// A bullet is either a plain string or a styled object:
//   { text, strong?, color?, icon?, glyph? }
// - strong: lead text rendered bold before the rest (split on the first "—"/":"
//   if not given explicitly via {strong,text})
// - color: overrides the marker/lead colour for this bullet
// - icon:  small icon in place of the dot marker
// - glyph: a single char/emoji marker (e.g. "✓", "✕", "→") in place of the dot
export type BulletItem = string | { text: string; strong?: string; color?: string; icon?: string; glyph?: string };

const CHIP_GLYPH_COLOR: Record<string, string> = { "✓": "#10B981", "✕": "#EF4444", "≈": "#F59E0B", "△": "#F59E0B" };

export function Bullets({ items, color }: { items: BulletItem[]; color: string }) {
  if (!items?.length) return null;
  return (
    <ul style={{ display: "flex", flexDirection: "column", gap: 6, margin: "2px 0 0", padding: 0, listStyle: "none" }}>
      {items.map((b, i) => {
        const o = typeof b === "string" ? { text: b } : b;
        const mk = o.color || (o.glyph && CHIP_GLYPH_COLOR[o.glyph]) || color;
        // Auto-derive a bold lead from "Lead — rest" / "Lead: rest" when not given.
        let strong = o.strong, text = o.text;
        if (!strong) {
          const m = /^(.{2,40}?)\s*[—:]\s+(.+)$/.exec(o.text);
          if (m) { strong = m[1]; text = m[2]; }
        }
        return (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13, lineHeight: 1.45, color: "var(--txt-muted, #cbd5e1)" }}>
            {o.icon
              ? <IconTile icon={o.icon} color={mk} size={18} />
              : o.glyph
                ? <span style={{ marginTop: 1, flexShrink: 0, fontWeight: 900, color: mk, fontSize: 12, width: 14, textAlign: "center" }}>{o.glyph}</span>
                : <span style={{ marginTop: 7, width: 5, height: 5, borderRadius: 999, flexShrink: 0, background: mk }} />}
            <span>
              {strong && <span style={{ fontWeight: 700, color: "var(--txt, #e2e8f0)" }}>{strong}{text ? " — " : ""}</span>}
              {text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ── Titled section (divider + heading + body/bullets/children) ───────────────
export function Section({ title, color, children }: { title?: string; color: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingTop: 13, borderTop: "1px solid var(--border, rgba(255,255,255,0.08))" }}>
      {title && <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color, margin: 0 }}>{title}</h4>}
      {children}
    </div>
  );
}

// ── Key/value grid (IaC, pricing, any spec table) ────────────────────────────
export function KeyValues({ rows }: { rows: [string, string][] }) {
  if (!rows?.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 16px" }}>
      {rows.map(([k, v], i) => [
        <span key={`k${i}`} style={{ fontSize: 12, color: "var(--txt-muted, #94a3b8)", fontFamily: "'SF Mono', Menlo, monospace" }}>{k}</span>,
        <span key={`v${i}`} style={{ fontSize: 12, color: "var(--txt, #e2e8f0)", fontWeight: 600 }}>{String(v)}</span>,
      ])}
    </div>
  );
}

// ── Status chips row ─────────────────────────────────────────────────────────
export interface Chip { label: string; ok?: true | false | "warn"; icon?: string }
const CHIP_COLOR = { true: "#10B981", false: "#EF4444", warn: "#F59E0B" } as const;
const CHIP_GLYPH = { true: "✓", false: "✗", warn: "≈" } as const;
export function Chips({ chips, color }: { chips: Chip[]; color: string }) {
  if (!chips?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
      {chips.map((c, i) => {
        const key = c.ok === true ? "true" : c.ok === false ? "false" : c.ok === "warn" ? "warn" : null;
        const cc = key ? CHIP_COLOR[key] : color;
        return (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, color: "var(--txt, #e2e8f0)", background: "var(--chip-bg, rgba(148,163,184,0.12))", border: "1px solid var(--border, rgba(255,255,255,0.1))" }}>
            {c.icon && <img src={resolveIcon(c.icon) ?? c.icon} alt="" width={14} height={14} style={{ objectFit: "contain", filter: iconFilter(c.icon) }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
            {key ? <span style={{ fontWeight: 900, color: cc }}>{CHIP_GLYPH[key]}</span> : <span style={{ width: 6, height: 6, borderRadius: 999, flexShrink: 0, background: cc }} />}
            {c.label}
          </span>
        );
      })}
    </div>
  );
}
