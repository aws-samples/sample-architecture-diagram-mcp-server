// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── App shell: a sidebar + pages page, assembled from components ───
// The document page (caption + tab rail + canvas + dock) presents ONE diagram.
// The app shell presents a small app: a collapsible sidebar (brand, language
// switch, navigation with value badges, a pinned summary card) and pages built
// from cards — headers, form cards whose inputs edit the spec's `data`, result
// panels whose KPIs and rows are formulas over that data (appData.js), section
// bands, service cards, and the live architecture canvas itself.
//
// Everything is declared by the layout (layout.app) and fed by the spec (`data`,
// `metrics`): no domain logic lives here. Styles are plain CSS scoped to .ld-app
// (own class names, zinc neutrals + one accent), injected as a string so the
// single-file build needs no CSS scan.
import { useEffect, useMemo, useState } from "react";
import type { ComponentType, CSSProperties, Dispatch, ReactElement, ReactNode, SetStateAction } from "react";
import { tr } from "#core/i18n.ts";
import { displayValue, evalExpr, formatValue, textValue } from "#core/appData.ts";
import type { AppData, AppDisplayValue, AppExpr, AppFormat, AppMetrics } from "#core/appData.ts";

// ── App document types (mirror the server's app-shell schemas) ──────────────
/** Per-language text: a string, or { en, pt, … }. */
export type AppText = string | Partial<Record<string, string>>;
/** Formulas and displayed values: the appData grammar (evaluated by appData.evalExpr). */
export type { AppExpr, AppDisplayValue };
export type AppValueFormat = AppFormat;
/** Prose that may also be a computed value. */
export type AppTextValue = AppText | AppDisplayValue;
/** Input values a form card edits (`bind`) and formulas read; named formulas (appData). */
export type { AppData, AppMetrics };
export type AppTone = "green" | "accent" | "orange" | "blue" | "purple" | "muted" | "text";

export interface AppOption { value: string | number | boolean; label: AppText; sub?: AppText }
export type AppField =
  | { kind: "segmented"; bind: string; label?: AppText; info?: AppText; options: AppOption[] }
  | { kind: "number"; bind: string; label?: AppText; info?: AppText; min?: number; max?: number; step?: number }
  | { kind: "select"; bind: string; label?: AppText; info?: AppText; options: AppOption[] }
  | { kind: "meter"; bind?: undefined; label?: AppText; info?: AppText; caption?: AppText; value: AppExpr; max: AppExpr; display?: AppDisplayValue; legend?: AppText; right?: AppDisplayValue }
  | { kind: "note"; bind?: undefined; label?: undefined; info?: undefined; text: AppTextValue };
export interface AppKvRow { label: AppText; sub?: AppText; chip?: string; value: AppDisplayValue; tone?: AppTone }
export interface AppTotalRow { label: AppText; value: AppDisplayValue; tone?: AppTone }

/** Props per built-in app-shell component (validated server-side). */
export interface AppBrandProps { title?: AppText; subtitle?: AppText; icon?: string; themeToggle?: boolean }
export type AppLanguageProps = Record<string, never>;
export interface AppNavProps { title?: AppText }
export interface AppSummaryProps {
  eyebrow?: AppText; value?: AppDisplayValue; tone?: AppTone; context?: AppDisplayValue;
  select?: { bind: string; label?: AppText; options: AppOption[] };
  unit?: AppText; rows?: AppKvRow[]; totals?: AppTotalRow[];
  footer?: { icon?: string; label: AppText; value: AppDisplayValue }[];
  collapsed?: boolean;
}
export interface AppPageHeaderProps { eyebrow?: AppText; title: AppText; subtitle?: AppText; icon?: string }
export interface AppFormProps { title: AppText; icon?: string; tone?: AppTone; info?: AppText; fields?: AppField[] }
export interface AppResultProps {
  title: AppText; icon?: string; tone?: AppTone;
  kpis?: { label: AppText; value: AppDisplayValue; tone?: AppTone }[];
  rows?: AppKvRow[]; subtotal?: AppTotalRow; adjustments?: AppTotalRow[]; total?: AppTotalRow;
  callout?: { text: AppTextValue; tone?: "warn" | "info" };
}
export interface AppSectionProps { title: AppText; icon?: string; tone?: AppTone; about?: AppText; aboutLabel?: AppText; eyebrow?: AppText }
export interface AppServiceItem { title: AppText; service?: string; tag?: AppText; value?: AppDisplayValue; tone?: AppTone; text?: AppText }
export interface AppServicesProps { columns?: number; items?: AppServiceItem[] }
export interface AppGridProps { columns?: number; items?: AppEntry[] }
export interface AppTextProps { text: AppTextValue }
export interface AppArchitectureProps { title?: AppText; icon?: string; height?: string; dock?: boolean }

/** A mounted component: an id, or { component, props }. */
export type AppEntry = string | { component: string; props?: Record<string, unknown> };
export interface AppPage { id: string; label: AppText; icon?: string; badge?: AppDisplayValue; components?: AppEntry[] }
/** layout.app: { sidebar?, pages[], startPage? }. */
export interface AppLayout { sidebar?: AppEntry[]; pages?: AppPage[]; startPage?: string }
export interface AppBranding { logo?: string; name?: string }

/** The host's icon for an AWS service name (app shell icons are by service). */
export type AppServiceIcon = ComponentType<{ service: string; size?: number }>;

/** Everything a part reads besides its own props. */
export interface AppShellContext {
  lang: string;
  languages: string[];
  onLang: (lang: string) => void;
  langLabel: (lang: string) => string;
  dark: boolean;
  onTheme: () => void;
  branding?: AppBranding;
  Icon?: AppServiceIcon;
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
  metrics: AppMetrics;
  pages: AppPage[];
  page: string | undefined;
  setPage: (id: string) => void;
  renderDiagram?: (opts: { dock: boolean }) => ReactNode;
  custom?: (id: string) => unknown;
}
export interface AppPartArgs<P> { props: P; ctx: AppShellContext }
/**
 * A part looked up by id from the layout: its props are spec JSON (validated by
 * the server schema for the built-ins, by the bundle for custom components).
 */
export type AppPartComponent = ComponentType<AppPartArgs<Record<string, unknown>>>;

const TONE: Record<string, string> = {
  green: "var(--app-green)", accent: "var(--app-accent-text)", orange: "var(--app-orange)",
  blue: "var(--app-blue)", purple: "var(--app-purple)", muted: "var(--app-muted)", text: "var(--app-text)",
};
const toneColor = (t: string | undefined): string | undefined => TONE[String(t)] || undefined;

// Small line glyphs (stroke = currentColor) for nav items, card titles and
// headers. An `icon` may also be an AWS service name, resolved by the host Icon.
const GLYPHS = {
  database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>,
  architecture: <><rect x="3" y="3" width="6" height="5" rx="1"/><rect x="15" y="3" width="6" height="5" rx="1"/><rect x="9" y="16" width="6" height="5" rx="1"/><path d="M6 8v3h12V8M12 11v5"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  server: <><rect x="3" y="4" width="18" height="6" rx="1"/><rect x="3" y="14" width="18" height="6" rx="1"/><path d="M7 7h.01M7 17h.01"/></>,
  cpu: <><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></>,
  backup: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
  swap: <><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></>,
  cloud: <><path d="M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
  pin: <><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5"/></>,
  chevronLeft: <path d="m15 6-6 6 6 6"/>,
  chevronRight: <path d="m9 6 6 6-6 6"/>,
  chevronUp: <path d="m6 15 6-6 6 6"/>,
  chevronDown: <path d="m6 9 6 6 6-6"/>,
} satisfies Record<string, ReactElement>;
export const APP_GLYPHS = Object.keys(GLYPHS);

function Glyph({ name, size = 18 }: { name: string; size?: number }) {
  const g: ReactElement | undefined = (GLYPHS as Record<string, ReactElement>)[name];
  if (!g) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "0 0 auto" }}>{g}</svg>;
}

function AppIcon({ icon, Icon, size = 18 }: { icon?: string; Icon?: AppServiceIcon; size?: number }) {
  if (!icon) return null;
  if ((GLYPHS as Record<string, ReactElement>)[icon]) return <Glyph name={icon} size={size} />;
  return Icon ? <span className="ld-app-svc" style={{ width: size, height: size }}><Icon service={icon} size={size} /></span> : null;
}

// ── Sidebar parts ────────────────────────────────────────────────────────────

function BrandHeader({ props, ctx }: AppPartArgs<AppBrandProps>) {
  const { lang, dark, onTheme, branding, Icon } = ctx;
  return (
    <div className="ld-app-brand">
      <div className="ld-app-logo">
        {branding?.logo ? <img src={branding.logo} alt="" /> : <AppIcon icon={props.icon || "chart"} Icon={Icon} size={19} />}
      </div>
      <div className="ld-app-brand-tt">
        <div className="ld-app-brand-title">{tr(props.title, lang) || branding?.name || ""}</div>
        {props.subtitle != null && <div className="ld-app-brand-sub" title={tr(props.subtitle, lang)}>{tr(props.subtitle, lang)}</div>}
      </div>
      {props.themeToggle !== false && (
        <div className="ld-app-theme" role="group" aria-label="theme">
          <button type="button" className={dark ? "on" : ""} onClick={() => !dark && onTheme()} aria-pressed={dark} title="dark"><Glyph name="moon" size={14} /></button>
          <button type="button" className={!dark ? "on" : ""} onClick={() => dark && onTheme()} aria-pressed={!dark} title="light"><Glyph name="sun" size={14} /></button>
        </div>
      )}
    </div>
  );
}

function LanguageSegmented({ ctx }: AppPartArgs<AppLanguageProps>) {
  const { languages, lang, onLang, langLabel } = ctx;
  if (!languages || languages.length < 2) return null;
  return (
    <div className="ld-app-seg ld-app-lang" role="group" aria-label="language">
      {languages.map((l) => (
        <button key={l} type="button" className={l === lang ? "on" : ""} aria-pressed={l === lang} onClick={() => onLang(l)}>{langLabel(l)}</button>
      ))}
    </div>
  );
}

function NavList({ props, ctx }: AppPartArgs<AppNavProps>) {
  const { pages, page, setPage, lang, data, metrics, Icon } = ctx;
  return (
    <nav className="ld-app-nav" aria-label={tr(props.title, lang) || "Navigation"}>
      <div className="ld-app-nav-title">{tr(props.title, lang) || "Navigation"}</div>
      {pages.map((p) => (
        <button key={p.id} type="button" className={`ld-app-nav-item${p.id === page ? " on" : ""}`} aria-current={p.id === page ? "page" : undefined} onClick={() => setPage(p.id)}>
          <AppIcon icon={p.icon} Icon={Icon} />
          <span className="ld-app-nav-label">{tr(p.label, lang)}</span>
          {p.badge != null && <span className="ld-app-nav-badge">{displayValue(p.badge, data, metrics, lang)}</span>}
        </button>
      ))}
    </nav>
  );
}

function SummaryCard({ props, ctx }: AppPartArgs<AppSummaryProps>) {
  const { lang, data, metrics } = ctx;
  const [open, setOpen] = useState(props.collapsed !== true);
  const v = (x: AppDisplayValue | undefined) => displayValue(x, data, metrics, lang);
  return (
    <section className="ld-app-summary">
      <div className="ld-app-summary-head">
        <div>
          {props.eyebrow != null && <div className="ld-app-eyebrow">{tr(props.eyebrow, lang)}</div>}
          {props.value != null && <div className="ld-app-summary-value" style={{ color: toneColor(props.tone || "green") }}>{v(props.value)}</div>}
          {props.context != null && <div className="ld-app-summary-ctx">{v(props.context)}</div>}
        </div>
        <button type="button" className="ld-app-icon-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} title={open ? "collapse" : "expand"}>
          <Glyph name={open ? "chevronUp" : "chevronDown"} size={16} />
        </button>
      </div>
      {open && (
        <div className="ld-app-summary-body">
          {props.select && <Field field={{ kind: "select", ...props.select }} ctx={ctx} inline />}
          {props.unit != null && <div className="ld-app-summary-unit">{tr(props.unit, lang)}</div>}
          {(props.rows || []).map((r, i) => <KV key={i} label={tr(r.label, lang)} value={v(r.value)} tone={r.tone} />)}
          {(props.totals || []).length > 0 && <div className="ld-app-rule" />}
          {(props.totals || []).map((r, i) => <KV key={i} label={tr(r.label, lang)} value={v(r.value)} tone={r.tone} strong={i === 0} />)}
          {(props.footer || []).length > 0 && (
            <div className="ld-app-summary-foot">
              {props.footer!.map((r, i) => (
                <div key={i} className="ld-app-kv small"><span className="ld-app-kv-l"><Glyph name={r.icon || "info"} size={13} />{tr(r.label, lang)}</span><span className="ld-app-kv-v">{v(r.value)}</span></div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function KV({ label, sub, chip, value, tone, strong }: { label: ReactNode; sub?: ReactNode; chip?: ReactNode; value: ReactNode; tone?: string; strong?: boolean }) {
  return (
    <div className={`ld-app-kv${strong ? " strong" : ""}`}>
      <span className="ld-app-kv-l">{label}{chip && <span className="ld-app-chip">{chip}</span>}{sub && <span className="ld-app-kv-sub"> · {sub}</span>}</span>
      <span className="ld-app-kv-v" style={{ color: toneColor(tone) }}>{value}</span>
    </div>
  );
}

// ── Page parts ───────────────────────────────────────────────────────────────

function PageHeader({ props, ctx }: AppPartArgs<AppPageHeaderProps>) {
  const { lang, Icon } = ctx;
  return (
    <header className="ld-app-page-header">
      {props.eyebrow != null && <div className="ld-app-eyebrow plain">{tr(props.eyebrow, lang)}</div>}
      <h1><AppIcon icon={props.icon} Icon={Icon} size={28} />{tr(props.title, lang)}</h1>
      {props.subtitle != null && <p>{tr(props.subtitle, lang)}</p>}
    </header>
  );
}

function Info({ text, lang }: { text?: AppText; lang: string }) {
  if (text == null) return null;
  const t = tr(text, lang);
  return <span className="ld-app-info" tabIndex={0} title={t} aria-label={t}>i</span>;
}

function Field({ field, ctx, inline }: { field: AppField; ctx: AppShellContext; inline?: boolean }) {
  const { lang, data, metrics, setData } = ctx;
  const f = field;
  const label = f.label != null ? <div className="ld-app-label">{tr(f.label, lang)}<Info text={f.info} lang={lang} /></div> : null;
  const val = f.bind ? data[f.bind] : undefined;
  // A bound value as an input value (a boolean datum is passed through as-is, as before).
  const inputValue = (val ?? "") as string | number;
  const set = (x: string | number | boolean) => f.bind && setData((d) => ({ ...d, [f.bind as string]: x }));
  switch (f.kind) {
    case "segmented":
      return (
        <div className="ld-app-field">
          {label}
          <div className="ld-app-seg wide" role="group">
            {(f.options || []).map((o) => (
              <button key={String(o.value)} type="button" className={o.value === val ? "on" : ""} aria-pressed={o.value === val} onClick={() => set(o.value)}>
                <span>{tr(o.label, lang)}</span>{o.sub != null && <small>{tr(o.sub, lang)}</small>}
              </button>
            ))}
          </div>
        </div>
      );
    case "number":
      return (
        <label className="ld-app-field">
          {label}
          <input className="ld-app-input" type="number" value={inputValue} min={f.min} max={f.max} step={f.step ?? 1}
            onChange={(e) => set(e.target.value === "" ? 0 : +e.target.value)} />
        </label>
      );
    case "select":
      return (
        <label className={`ld-app-field${inline ? " inline" : ""}`}>
          {label}
          <select className="ld-app-input" value={inputValue} onChange={(e) => {
            const o = (f.options || []).find((x) => String(x.value) === e.target.value);
            set(o ? o.value : e.target.value);
          }}>
            {(f.options || []).map((o) => <option key={String(o.value)} value={String(o.value)}>{tr(o.label, lang)}</option>)}
          </select>
        </label>
      );
    case "meter": {
      const cur = Number(evalExpr(f.value, data, metrics)) || 0;
      const max = Number(evalExpr(f.max, data, metrics)) || 0;
      const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
      return (
        <div className="ld-app-field">
          {label}
          <div className="ld-app-meter-row"><span>{tr(f.caption, lang)}</span><b>{f.display != null ? displayValue(f.display, data, metrics, lang) : `${formatValue(cur, {}, lang)} / ${formatValue(max, {}, lang)}`}</b></div>
          <div className="ld-app-meter" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
          <div className="ld-app-meter-row muted"><span>{formatValue(pct, { style: "percent", digits: 1 }, lang)} {tr(f.legend, lang)}</span><span>{f.right != null ? displayValue(f.right, data, metrics, lang) : ""}</span></div>
        </div>
      );
    }
    case "note":
      return <p className="ld-app-note">{f.text != null ? textValue(f.text, data, metrics, lang, tr) : ""}</p>;
    default:
      return null;
  }
}

function FormCard({ props, ctx }: AppPartArgs<AppFormProps>) {
  const { lang, Icon } = ctx;
  return (
    <section className="ld-app-card">
      <div className="ld-app-card-title"><span style={{ color: toneColor(props.tone || "orange") }}><AppIcon icon={props.icon} Icon={Icon} size={17} /></span>{tr(props.title, lang)}{props.info != null && <span className="ld-app-card-info"><Info text={props.info} lang={lang} /></span>}</div>
      {(props.fields || []).map((f, i) => <Field key={i} field={f} ctx={ctx} />)}
    </section>
  );
}

function ResultPanel({ props, ctx }: AppPartArgs<AppResultProps>) {
  const { lang, data, metrics, Icon } = ctx;
  const v = (x: AppDisplayValue) => displayValue(x, data, metrics, lang);
  return (
    <section className="ld-app-card ld-app-result">
      <div className="ld-app-card-title"><span style={{ color: toneColor(props.tone || "green") }}><AppIcon icon={props.icon || "chart"} Icon={Icon} size={17} /></span>{tr(props.title, lang)}</div>
      {(props.kpis || []).length > 0 && (
        <div className="ld-app-kpis">
          {props.kpis!.map((k, i) => (
            <div key={i} className="ld-app-kpi"><b style={{ color: toneColor(k.tone || "green") }}>{v(k.value)}</b><span>{tr(k.label, lang)}</span></div>
          ))}
        </div>
      )}
      {(props.rows || []).length > 0 && <div className="ld-app-rows">{props.rows!.map((r, i) => <KV key={i} label={tr(r.label, lang)} sub={r.sub != null ? tr(r.sub, lang) : undefined} chip={r.chip} value={v(r.value)} tone={r.tone} />)}</div>}
      {props.subtotal && <div className="ld-app-total sub"><span>{tr(props.subtotal.label, lang)}</span><b style={{ color: toneColor(props.subtotal.tone || "green") }}>{v(props.subtotal.value)}</b></div>}
      {(props.adjustments || []).map((r, i) => <KV key={i} label={tr(r.label, lang)} value={v(r.value)} tone={r.tone || "purple"} />)}
      {props.total && <div className="ld-app-total"><span>{tr(props.total.label, lang)}</span><b style={{ color: toneColor(props.total.tone || "blue") }}>{v(props.total.value)}</b></div>}
      {props.callout != null && <div className={`ld-app-callout ${props.callout.tone || "warn"}`}>{textValue(props.callout.text, data, metrics, lang, tr)}</div>}
    </section>
  );
}

function SectionHeader({ props, ctx }: AppPartArgs<AppSectionProps>) {
  const { lang, Icon } = ctx;
  const [about, setAbout] = useState(false);
  return (
    <div className="ld-app-section">
      <div className="ld-app-section-band">
        <h2><span style={{ color: toneColor(props.tone || "orange") }}><AppIcon icon={props.icon} Icon={Icon} size={20} /></span>{tr(props.title, lang)}</h2>
        {props.about != null && <button type="button" className="ld-app-about" onClick={() => setAbout((a) => !a)} aria-expanded={about}><Glyph name="info" size={13} />{tr(props.aboutLabel, lang) || "About"}</button>}
      </div>
      {about && props.about != null && <p className="ld-app-note">{tr(props.about, lang)}</p>}
      {props.eyebrow != null && <div className="ld-app-eyebrow plain">{tr(props.eyebrow, lang)}</div>}
    </div>
  );
}

function ServiceCards({ props, ctx }: AppPartArgs<AppServicesProps>) {
  const { lang, data, metrics, Icon } = ctx;
  return (
    <div className="ld-app-grid" style={{ "--cols": props.columns || 2 } as CSSProperties}>
      {(props.items || []).map((s, i) => (
        <section key={i} className="ld-app-card ld-app-service">
          <div className="ld-app-service-head">
            <div className="ld-app-service-ico">{s.service ? <AppIcon icon={s.service} Icon={Icon} size={26} /> : null}</div>
            <div className="ld-app-service-tt">
              <div className="ld-app-service-name">{tr(s.title, lang)}</div>
              {s.tag != null && <span className="ld-app-tag">{tr(s.tag, lang)}</span>}
            </div>
            {s.value != null && <b className="ld-app-service-val" style={{ color: toneColor(s.tone || "accent") }}>{displayValue(s.value, data, metrics, lang)}</b>}
          </div>
          {s.text != null && <p>{tr(s.text, lang)}</p>}
        </section>
      ))}
    </div>
  );
}

function CardGrid({ props, ctx }: AppPartArgs<AppGridProps>) {
  return (
    <div className="ld-app-grid" style={{ "--cols": props.columns || 3 } as CSSProperties}>
      {(props.items || []).map((e, i) => <PageComponent key={i} entry={e} ctx={ctx} />)}
    </div>
  );
}

function TextBlock({ props, ctx }: AppPartArgs<AppTextProps>) {
  return <p className="ld-app-note">{textValue(props.text, ctx.data, ctx.metrics, ctx.lang, tr)}</p>;
}

function ArchitectureCanvas({ props, ctx }: AppPartArgs<AppArchitectureProps>) {
  const { lang, renderDiagram, Icon } = ctx;
  return (
    <section className="ld-app-arch">
      {props.title != null && <h2 className="ld-app-arch-title"><AppIcon icon={props.icon || "architecture"} Icon={Icon} size={22} />{tr(props.title, lang)}</h2>}
      <div className="ld-app-arch-canvas" style={{ height: props.height || "calc(100vh - 120px)" }}>
        {renderDiagram ? renderDiagram({ dock: props.dock !== false }) : null}
      </div>
    </section>
  );
}

export const APP_COMPONENTS = {
  "sidebar.brand": BrandHeader,
  "sidebar.language": LanguageSegmented,
  "sidebar.nav": NavList,
  "sidebar.summary": SummaryCard,
  "page.header": PageHeader,
  "page.grid": CardGrid,
  "page.form": FormCard,
  "page.result": ResultPanel,
  "page.section": SectionHeader,
  "page.services": ServiceCards,
  "page.text": TextBlock,
  "page.architecture": ArchitectureCanvas,
};
export const APP_SIDEBAR_DEFAULT: string[] = ["sidebar.brand", "sidebar.language", "sidebar.nav", "sidebar.summary"];

// The registry indexed by a layout id: entry props are spec JSON, so a part is
// called with them as-is (the server schema validated them per component).
const builtinPart = (id: string): AppPartComponent | undefined =>
  (APP_COMPONENTS as Record<string, ComponentType<AppPartArgs<never>>>)[id] as AppPartComponent | undefined;

function entryOf(e: AppEntry): { component: string; props: Record<string, unknown> } {
  return typeof e === "string" ? { component: e, props: {} } : { component: e.component, props: e.props || {} };
}

function PageComponent({ entry, ctx }: { entry: AppEntry; ctx: AppShellContext }) {
  const { component, props } = entryOf(entry);
  // A custom part is a host React component (componentRegistry / the `custom` prop).
  const C = builtinPart(component) || (ctx.custom?.(component) as AppPartComponent | null | undefined);
  return C ? <C props={props} ctx={ctx} /> : null;
}

const pageFromHash = (pages: AppPage[]): string | undefined => {
  if (typeof window === "undefined") return undefined;
  const h = decodeURIComponent((window.location.hash || "").replace(/^#/, ""));
  return pages.some((p) => p.id === h) ? h : undefined;
};

/**
 * The app shell.
 *   app        layout.app: { sidebar?, pages[], startPage? }
 *   data       spec.data (initial values; form inputs edit a copy)
 *   metrics    spec.metrics (named formulas)
 *   renderDiagram  ({ dock }) => the architecture canvas element, for page.architecture
 *   custom     (id) => a registered custom component, or undefined
 */
export interface AppShellProps {
  /** layout.app: { sidebar?, pages[], startPage? }. */
  app?: AppLayout;
  /** spec.data (initial values; form inputs edit a copy). */
  data?: AppData;
  /** spec.metrics (named formulas). */
  metrics?: AppMetrics;
  lang?: string;
  languages?: string[];
  onLang?: (lang: string) => void;
  langLabel?: (lang: string) => string;
  dark?: boolean;
  onTheme?: () => void;
  branding?: AppBranding;
  /** ({ dock }) => the architecture canvas element, for page.architecture. */
  renderDiagram?: (opts: { dock: boolean }) => ReactNode;
  /** The host's service icon ({ service, size }). */
  Icon?: AppServiceIcon;
  /** (id) => a registered custom component, or undefined. */
  custom?: (id: string) => unknown;
}

export function AppShell({ app = {}, data: initialData = {}, metrics = {}, lang = "en", languages = [], onLang = (_lang: string) => {}, langLabel = (l: string) => String(l).toUpperCase(), dark = true, onTheme = () => {}, branding, renderDiagram, Icon, custom }: AppShellProps) {
  const pages = useMemo(() => (Array.isArray(app.pages) ? app.pages.filter((p) => p && p.id) : []), [app.pages]);
  const [page, setPageState] = useState<string | undefined>(() => pageFromHash(pages) || app.startPage || pages[0]?.id);
  const [data, setData] = useState(initialData);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => setData(initialData), [initialData]);
  useEffect(() => {
    const onHash = () => { const h = pageFromHash(pages); if (h) setPageState(h); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [pages]);
  const setPage = (id: string) => {
    setPageState(id);
    if (typeof window !== "undefined" && window.history?.replaceState) window.history.replaceState(null, "", `#${encodeURIComponent(id)}`);
  };
  const ctx: AppShellContext = { lang, languages, onLang, langLabel, dark, onTheme, branding, Icon, data, setData, metrics, pages, page, setPage, renderDiagram, custom };
  const sidebar = (Array.isArray(app.sidebar) ? app.sidebar : APP_SIDEBAR_DEFAULT).map(entryOf);
  const pinned = sidebar.filter((e) => e.component === "sidebar.summary");
  const top = sidebar.filter((e) => e.component !== "sidebar.summary");
  const current = pages.find((p) => p.id === page) || pages[0];
  return (
    <div className={`ld-app ${dark ? "dark" : "light"}${collapsed ? " collapsed" : ""}`}>
      <style>{APP_SHELL_CSS}</style>
      <aside className="ld-app-side" aria-hidden={collapsed || undefined}>
        <div className="ld-app-side-top">{top.map((e, i) => { const C = builtinPart(e.component) || (custom?.(e.component) as AppPartComponent | null | undefined); return C ? <C key={i} props={e.props} ctx={ctx} /> : null; })}</div>
        <div className="ld-app-side-bottom">{pinned.map((e, i) => <SummaryCard key={i} props={e.props as AppSummaryProps} ctx={ctx} />)}</div>
      </aside>
      <button type="button" className="ld-app-collapse" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "expand sidebar" : "collapse sidebar"} aria-expanded={!collapsed}>
        <Glyph name={collapsed ? "chevronRight" : "chevronLeft"} size={16} />
      </button>
      <main className="ld-app-main" data-page={current?.id}>
        {(current?.components || []).map((e, i) => <PageComponent key={`${current?.id}:${i}`} entry={e} ctx={ctx} />)}
      </main>
    </div>
  );
}

export const APP_SHELL_CSS = `
.ld-app { --sbw: 300px; position: fixed; inset: 0; display: flex; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 13.5px;
  background: var(--app-bg); color: var(--app-text); }
.ld-app.dark { --app-bg:#09090b; --app-panel:#18181b; --app-card:rgba(255,255,255,.04); --app-card-border:rgba(255,255,255,.08); --app-line:rgba(255,255,255,.08);
  --app-hover:rgba(255,255,255,.05); --app-input:rgba(255,255,255,.05); --app-input-border:rgba(255,255,255,.12); --app-text:#f4f4f5; --app-muted:#a1a1aa;
  --app-accent:#6366f1; --app-accent-soft:rgba(99,102,241,.18); --app-accent-text:#a5b4fc; --app-green:#4ade80; --app-orange:#f59e0b; --app-blue:#38bdf8; --app-purple:#a78bfa; }
.ld-app.light { --app-bg:#f4f4f5; --app-panel:#ffffff; --app-card:#ffffff; --app-card-border:rgba(9,9,11,.08); --app-line:rgba(9,9,11,.08);
  --app-hover:rgba(9,9,11,.04); --app-input:#ffffff; --app-input-border:rgba(9,9,11,.15); --app-text:#18181b; --app-muted:#71717a;
  --app-accent:#4f46e5; --app-accent-soft:rgba(79,70,229,.10); --app-accent-text:#4f46e5; --app-green:#16a34a; --app-orange:#d97706; --app-blue:#0284c7; --app-purple:#7c3aed; }
.ld-app * { box-sizing: border-box; }
.ld-app button { font: inherit; color: inherit; }
.ld-app-side { flex: 0 0 var(--sbw); width: var(--sbw); display: flex; flex-direction: column; justify-content: space-between; gap: 12px; padding: 10px 12px 12px; overflow-y: auto; transition: margin-left .2s ease; }
.ld-app.collapsed .ld-app-side { margin-left: calc(-1 * var(--sbw)); }
.ld-app-collapse { position: absolute; top: 14px; left: calc(var(--sbw) - 14px); z-index: 5; width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--app-line); background: var(--app-panel); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: left .2s ease; }
.ld-app.collapsed .ld-app-collapse { left: 10px; }
.ld-app-main { flex: 1; min-width: 0; overflow-y: auto; margin: 8px 8px 8px 0; padding: 28px 40px 40px; background: var(--app-panel); border-radius: 14px; border: 1px solid var(--app-line); display: flex; flex-direction: column; gap: 20px; }
.ld-app.collapsed .ld-app-main { margin-left: 8px; padding-left: 52px; }
.ld-app-brand { display: flex; align-items: center; gap: 11px; padding: 10px 6px 14px; border-bottom: 1px solid var(--app-line); }
.ld-app-logo { flex: 0 0 auto; width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; background: var(--app-accent-soft); color: var(--app-accent-text); border: 1px solid var(--app-line); overflow: hidden; }
.ld-app-logo img { width: 100%; height: 100%; object-fit: contain; }
.ld-app-brand-tt { flex: 1; min-width: 0; }
.ld-app-brand-title { font-weight: 800; font-size: 15px; letter-spacing: -.3px; }
.ld-app-brand-sub { font-size: 10.5px; color: var(--app-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ld-app-theme { display: flex; gap: 2px; padding: 2px; border-radius: 8px; background: var(--app-hover); }
.ld-app-theme button { width: 24px; height: 24px; border: 0; border-radius: 6px; background: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: .55; }
.ld-app-theme button.on { opacity: 1; background: var(--app-panel); color: var(--app-accent-text); }
.ld-app-seg { display: flex; gap: 4px; padding: 3px; border-radius: 9px; background: var(--app-hover); }
.ld-app-seg button { flex: 1; border: 1px solid transparent; border-radius: 7px; background: transparent; padding: 6px 8px; cursor: pointer; font-weight: 700; font-size: 11.5px; opacity: .6; display: flex; flex-direction: column; align-items: center; gap: 1px; }
.ld-app-seg button small { font-weight: 500; font-size: 10px; color: var(--app-muted); }
.ld-app-seg button.on { opacity: 1; background: var(--app-panel); color: var(--app-accent-text); border-color: var(--app-line); }
.ld-app-seg.wide { background: transparent; padding: 0; gap: 8px; }
.ld-app-seg.wide button { opacity: 1; border-color: var(--app-input-border); padding: 9px 10px; font-size: 12px; }
.ld-app-seg.wide button.on { background: var(--app-accent-soft); border-color: var(--app-accent); color: var(--app-text); }
.ld-app-lang { margin: 10px 0 0; }
.ld-app-nav { display: flex; flex-direction: column; gap: 2px; margin-top: 12px; }
.ld-app-nav-title { font-size: 11px; font-weight: 500; color: var(--app-muted); padding: 10px 8px 6px; }
.ld-app-nav-item { position: relative; display: flex; align-items: center; gap: 11px; width: 100%; padding: 9px 10px; border: 0; border-radius: 8px; background: transparent; cursor: pointer; text-align: left; font-weight: 500; }
.ld-app-nav-item:hover, .ld-app-nav-item.on { background: var(--app-hover); }
.ld-app-nav-item.on { color: var(--app-orange); }
.ld-app-nav-label { flex: 1; min-width: 0; }
.ld-app-nav-badge { flex: 0 0 auto; font-size: 11px; font-weight: 600; color: var(--app-muted); padding: 2px 7px; border-radius: 6px; background: var(--app-hover); white-space: nowrap; }
.ld-app-summary { border: 1px solid var(--app-line); border-radius: 12px; padding: 14px; background: linear-gradient(160deg, var(--app-card), transparent); }
.ld-app-summary-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.ld-app-eyebrow { font-size: 10.5px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: var(--app-muted); }
.ld-app-eyebrow.plain { text-transform: none; letter-spacing: 0; font-weight: 600; font-size: 12px; }
.ld-app-summary-value { font-size: 24px; font-weight: 800; letter-spacing: -.5px; margin-top: 4px; }
.ld-app-summary-ctx { font-size: 11px; color: var(--app-muted); }
.ld-app-summary-body { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.ld-app-summary-unit { text-align: right; font-size: 10px; font-weight: 700; color: var(--app-muted); margin-top: 4px; }
.ld-app-summary-foot { border-top: 1px solid var(--app-line); margin-top: 6px; padding-top: 8px; display: flex; flex-direction: column; gap: 6px; }
.ld-app-icon-btn { width: 26px; height: 26px; border: 0; border-radius: 7px; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--app-muted); }
.ld-app-rule { height: 1px; background: var(--app-line); margin: 4px 0; }
.ld-app-kv { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 12.5px; }
.ld-app-kv.small { font-size: 11.5px; color: var(--app-muted); }
.ld-app-kv.strong { font-weight: 700; }
.ld-app-kv-l { display: inline-flex; align-items: center; gap: 6px; min-width: 0; flex-wrap: wrap; }
.ld-app-kv-sub { color: var(--app-orange); font-size: 11.5px; }
.ld-app-kv-v { font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
.ld-app-chip { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 5px; background: rgba(245,158,11,.15); color: var(--app-orange); }
.ld-app-page-header h1 { display: flex; align-items: center; gap: 12px; margin: 6px 0 4px; font-size: 27px; font-weight: 800; letter-spacing: -.6px; }
.ld-app-page-header p { margin: 0; color: var(--app-muted); }
.ld-app-grid { display: grid; grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr)); gap: 18px; align-items: start; }
@media (max-width: 1100px) { .ld-app-grid { grid-template-columns: repeat(min(var(--cols, 3), 2), minmax(0, 1fr)); } }
@media (max-width: 760px) { .ld-app-grid { grid-template-columns: 1fr; } .ld-app-main { padding: 20px; } }
.ld-app-card { border: 1px solid var(--app-card-border); background: var(--app-card); border-radius: 14px; padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.ld-app-card-title { display: flex; align-items: center; gap: 9px; font-weight: 700; font-size: 14px; }
.ld-app-card-info { margin-left: auto; }
.ld-app-field { display: flex; flex-direction: column; gap: 7px; }
.ld-app-field.inline { flex-direction: row; align-items: center; justify-content: space-between; gap: 10px; }
.ld-app-field.inline .ld-app-input { max-width: 170px; padding: 6px 8px; font-size: 12px; }
.ld-app-label { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 500; }
.ld-app-info { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border-radius: 50%; border: 1px solid var(--app-input-border); font-size: 9.5px; font-weight: 700; color: var(--app-muted); cursor: help; font-style: normal; }
.ld-app-input { width: 100%; padding: 10px 12px; border-radius: 9px; border: 1px solid var(--app-input-border); background: var(--app-input); color: var(--app-text); font: inherit; font-size: 14px; }
.ld-app-input:focus { outline: 2px solid var(--app-accent); outline-offset: 1px; }
.ld-app-meter-row { display: flex; justify-content: space-between; font-size: 11.5px; }
.ld-app-meter-row.muted { color: var(--app-muted); }
.ld-app-meter { height: 6px; border-radius: 4px; background: var(--app-hover); overflow: hidden; }
.ld-app-meter i { display: block; height: 100%; background: linear-gradient(90deg, var(--app-green), var(--app-blue)); border-radius: 4px; }
.ld-app-note { margin: 0; font-size: 12.5px; color: var(--app-muted); line-height: 1.5; }
.ld-app-result { background: linear-gradient(160deg, rgba(74,222,128,.06), var(--app-card)); }
.ld-app-kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 12px; text-align: center; padding-bottom: 14px; border-bottom: 1px solid var(--app-line); }
.ld-app-kpi { display: flex; flex-direction: column; gap: 3px; }
.ld-app-kpi b { font-size: 25px; font-weight: 800; letter-spacing: -.5px; }
.ld-app-kpi span { font-size: 11px; color: var(--app-muted); }
.ld-app-rows { display: flex; flex-direction: column; gap: 10px; }
.ld-app-total { display: flex; justify-content: space-between; align-items: baseline; padding-top: 12px; border-top: 1px solid var(--app-line); font-size: 15px; }
.ld-app-total b { font-size: 19px; font-weight: 800; }
.ld-app-total.sub { font-size: 14px; }
.ld-app-callout { border-radius: 10px; padding: 10px 12px; font-size: 11.5px; line-height: 1.45; border: 1px solid rgba(245,158,11,.4); background: rgba(245,158,11,.08); }
.ld-app-callout.info { border-color: rgba(56,189,248,.4); background: rgba(56,189,248,.08); }
.ld-app-section { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
.ld-app-section-band { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px dashed var(--app-line); border-bottom: 2px solid rgba(245,158,11,.5); }
.ld-app-section-band h2 { margin: 0; display: flex; align-items: center; gap: 10px; font-size: 19px; font-weight: 700; }
.ld-app-about { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--app-line); border-radius: 8px; padding: 5px 10px; background: var(--app-hover); cursor: pointer; font-size: 12px; font-weight: 600; }
.ld-app-service-head { display: flex; align-items: flex-start; gap: 12px; }
.ld-app-service-ico { flex: 0 0 auto; width: 36px; height: 36px; border-radius: 9px; background: var(--app-hover); display: flex; align-items: center; justify-content: center; }
.ld-app-service-tt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.ld-app-service-name { font-weight: 700; font-size: 14.5px; }
.ld-app-tag { align-self: flex-start; font-size: 9.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; padding: 2px 6px; border-radius: 5px; border: 1px solid var(--app-line); color: var(--app-muted); }
.ld-app-service-val { white-space: nowrap; font-size: 15px; }
.ld-app-service p { margin: 0; font-size: 12.5px; color: var(--app-muted); line-height: 1.5; }
.ld-app-svc { display: inline-flex; align-items: center; justify-content: center; }
.ld-app-arch { display: flex; flex-direction: column; gap: 12px; min-height: 0; }
.ld-app-arch-title { margin: 0; display: flex; align-items: center; gap: 10px; font-size: 20px; font-weight: 800; }
.ld-app-arch-canvas { position: relative; border: 1px solid var(--app-line); border-radius: 12px; overflow: hidden; min-height: 420px; }
`;
