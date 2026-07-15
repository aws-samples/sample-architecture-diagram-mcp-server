// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Shared visual primitives for the overlay cards (StepCard walkthrough + the
// NodeModal node-detail). Both cards render the SAME building blocks so they
// look identical. Styled with Tailwind (dark: keys off the root .dark class);
// the accent colour is dynamic so it stays as an inline style. Theme-dependent
// surfaces read CSS vars (--card-bg / --txt / --txt-muted / --border / --dot /
// --chip-bg) set by StandaloneApp, so light/dark both work — and it all inlines
// into the single-file HTML at build time (Tailwind → CSS, framer → JS).
import type { ReactNode } from "react";
import { resolveIcon, iconFilter } from "@/lib/icons";

// ── Shell ────────────────────────────────────────────────────────────────────
export function CardShell({ color, full, children }: { color: string; full?: boolean; children: ReactNode }) {
  return (
    <div
      className={`rounded-2xl border backdrop-blur-md text-[color:var(--txt,#e2e8f0)] ${full ? "px-7 py-6 max-h-[82vh] overflow-y-auto" : "px-[22px] py-[18px]"}`}
      style={{ borderColor: `${color}66`, background: "var(--card-bg, rgba(24,28,40,0.92))", boxShadow: `0 12px 34px ${color}26, 0 2px 10px rgba(0,0,0,0.22)` }}
    >
      {children}
    </div>
  );
}

// ── Icon tile ──────────────────────────────────────────────────────────────
export function IconTile({ icon, color, size = 38 }: { icon: string; color: string; size?: number }) {
  const inner = Math.round(size * 0.64);
  return (
    <span className="flex items-center justify-center shrink-0 rounded-lg border" style={{ width: size, height: size, background: `${color}14`, borderColor: `${color}55` }}>
      <img src={resolveIcon(icon) ?? String(icon)} alt="" width={inner} height={inner} className="object-contain" style={{ filter: iconFilter(icon) }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
    </span>
  );
}

// ── Header (icon + eyebrow + title, optional trailing slot) ──────────────────
export function CardHeader({ icon, eyebrow, title, color, big, trailing }: {
  icon?: string; eyebrow?: string; title?: string; color: string; big?: boolean; trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-[11px]">
      {icon && <IconTile icon={icon} color={color} size={big ? 44 : 38} />}
      <div className="flex-1 min-w-0">
        {eyebrow && <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>{eyebrow}</div>}
        {title && <h3 className={`${big ? "text-[25px]" : "text-[19px]"} font-bold leading-tight m-0 ${eyebrow ? "mt-0.5" : ""} text-[color:var(--txt,#e2e8f0)]`}>{title}</h3>}
      </div>
      {trailing}
    </div>
  );
}

// ── Body paragraph ───────────────────────────────────────────────────────────
export function Body({ children, big }: { children: ReactNode; big?: boolean }) {
  return <p className={`${big ? "text-[15px]" : "text-sm"} leading-relaxed m-0 text-[color:var(--txt-muted,#cbd5e1)]`}>{children}</p>;
}

// ── Bullet list ──────────────────────────────────────────────────────────────
// A bullet is either a plain string or a styled object:
//   { text, strong?, color?, icon?, glyph? }
export type BulletItem = string | { text: string; strong?: string; color?: string; icon?: string; glyph?: string };
const GLYPH_COLOR: Record<string, string> = { "✓": "#10B981", "✕": "#EF4444", "≈": "#F59E0B", "△": "#F59E0B" };

export function Bullets({ items, color }: { items: BulletItem[]; color: string }) {
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
          <li key={i} className="flex items-start gap-[9px] text-[13px] leading-snug text-[color:var(--txt-muted,#cbd5e1)]">
            {o.icon
              ? <IconTile icon={o.icon} color={mk} size={18} />
              : o.glyph
                ? <span className="mt-px shrink-0 font-black text-xs w-3.5 text-center" style={{ color: mk }}>{o.glyph}</span>
                : <span className="mt-[7px] w-[5px] h-[5px] rounded-full shrink-0" style={{ background: mk }} />}
            <span>
              {strong && <span className="font-bold text-[color:var(--txt,#e2e8f0)]">{strong}{text ? " — " : ""}</span>}
              {text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ── Titled section (divider + heading + children) ────────────────────────────
export function Section({ title, color, children }: { title?: string; color: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[7px] pt-[13px] border-t border-[color:var(--border,rgba(255,255,255,0.08))]">
      {title && <h4 className="text-xs font-bold uppercase tracking-wide m-0" style={{ color }}>{title}</h4>}
      {children}
    </div>
  );
}

// ── Key/value grid (IaC, pricing, any spec table) ────────────────────────────
export function KeyValues({ rows }: { rows: [string, string][] }) {
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

// ── Status chips row ─────────────────────────────────────────────────────────
export interface Chip { label: string; ok?: true | false | "warn"; icon?: string }
const CHIP_COLOR = { true: "#10B981", false: "#EF4444", warn: "#F59E0B" } as const;
const CHIP_GLYPH = { true: "✓", false: "✗", warn: "≈" } as const;
export function Chips({ chips, color }: { chips: Chip[]; color: string }) {
  if (!chips?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-0.5">
      {chips.map((c, i) => {
        const key = c.ok === true ? "true" : c.ok === false ? "false" : c.ok === "warn" ? "warn" : null;
        const cc = key ? CHIP_COLOR[key] : color;
        return (
          <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-[color:var(--txt,#e2e8f0)] bg-[color:var(--chip-bg,rgba(148,163,184,0.12))] border border-[color:var(--border,rgba(255,255,255,0.1))]">
            {c.icon && <img src={resolveIcon(c.icon) ?? c.icon} alt="" width={14} height={14} className="object-contain" style={{ filter: iconFilter(c.icon) }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
            {key ? <span className="font-black" style={{ color: cc }}>{CHIP_GLYPH[key]}</span> : <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cc }} />}
            {c.label}
          </span>
        );
      })}
    </div>
  );
}
