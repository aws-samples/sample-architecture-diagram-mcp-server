// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Floating dock: title/subtitle, zoom controls, guided-walkthrough play/restart,
// language switch, theme toggle, collapse. UI-chrome strings are injected via
// `ui(key)` and `langLabel(code)` so the host owns the chrome i18n table.
import { useReactFlow, getNodesBounds, getViewportForBounds } from "@xyflow/react";
import { useState, useEffect, useRef, useId } from "react";
import { AWS_ORANGE } from "#core/domain/tones.ts";
import { getRegisteredComponent, normalizeSlotEntries } from "#core/application/componentRegistry.ts";
import { EXPORT_FILES, SHARE_CARD, TRANSPARENT_PIXEL_PNG, shareCardLayout } from "#core/application/exports.ts";
import { useCoreHost } from "#core/adapters/react/host.tsx";
import type { FileSaver } from "#core/ports/host.ts";
import type { CSSProperties, ComponentType, ReactElement } from "react";
import type { Node } from "@xyflow/react";

/** The chrome strings the dock asks for. */
export type DockUiKey = "language" | "exportPng" | "shareCard" | "restart" | "pause" | "play" | "theme" | "cost";
/** (key, lang) => label; any wider resolver (e.g. i18n's UiResolver / makeUi) fits. */
export type DockUi = (key: DockUiKey, lang: string) => string;
import type { SlotEntry, SlotEntryInput } from "#core/application/componentRegistry.ts";
import type { CostEntry as CostListEntry } from "#core/domain/costs.ts";

/** An estimate as the dock shows it: its label already resolved to the page language. */
export type DockCostEntry = Omit<CostListEntry, "label"> & { label?: string };
type CostEntry = DockCostEntry;

/** Optional brand mark: an inlined logo (data:image/… only) and a product name. */
export interface DockBranding { logo?: string; name?: string }

/** What a registered custom dock component receives as `ctx`. */
export interface DockContext {
  title?: string; subtitle?: string; dark?: boolean; lang: string; ui: DockUi;
  hasWalk?: boolean; playing?: boolean; costUrl?: string; costLabel?: string; languages: string[];
}

export interface ZoomBarProps {
  title?: string;
  subtitle?: string;
  dark?: boolean;
  visible?: boolean;
  onToggle?: () => void;
  onTheme?: () => void;
  hasWalk?: boolean;
  playing?: boolean;
  onPlay?: () => void;
  onReset?: () => void;
  /** Pulse the play button (nudges a first-time viewer). */
  attention?: boolean;
  lang?: string;
  languages?: string[];
  onLang?: (lang: string) => void;
  ui?: DockUi;
  langLabel?: (lang: string) => string;
  costUrl?: string;
  costLabel?: string;
  showTitle?: boolean;
  /** Several estimates (costs.js): every entry ({ id, env, label, url }). */
  costs?: DockCostEntry[];
  /** The selected cost environment. */
  costEnv?: string;
  costEnvs?: string[];
  onCostEnv?: (env: string) => void;
  /** Dock entries in order ("title" | "dock.title" | { component, props }). Default: DOCK_ITEMS. */
  items?: readonly SlotEntryInput[];
  branding?: DockBranding;
}

type ItemProps = Record<string, unknown> & { width?: number; label?: string };
type DockElement = ReactElement | ReactElement[] | null;
type CustomDockItem = ComponentType<Record<string, unknown>>;

const noopUi: DockUi = (k) => k;
const defLangLabel = (l: string): string => (l || "").toUpperCase();

// Export the current diagram as a PNG, framed to fit ALL nodes (independent of
// the on-screen zoom/pan), at 2x for crisp output. Icons are inlined in the
// diagram, so it works under file://. html-to-image is imported lazily so the
// dock has no cost until the user actually exports.
async function exportDiagramPng(nodes: Node[], dark: boolean | undefined, saver: FileSaver): Promise<void> {
  const el = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!el || !nodes.length) return;
  const { toPng } = await import("html-to-image");
  const W = 1920, H = 1200;
  const vp = getViewportForBounds(getNodesBounds(nodes), W, H, 0.2, 2, 0.12);
  const dataUrl = await toPng(el, {
    backgroundColor: dark ? "#0f1117" : "#f8fafc", width: W, height: H, pixelRatio: 2,
    // A node whose icon wasn't inlined (e.g. a fallback initial) keeps an <img>
    // pointing at a served /icons/… path. Under file:// that fetch throws and
    // would abort the whole export; imagePlaceholder swaps in a transparent 1x1
    // so the export succeeds and the initial fallback shows through instead.
    imagePlaceholder: TRANSPARENT_PIXEL_PNG,
    style: { width: `${W}px`, height: `${H}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` },
  });
  saver.saveUrl(EXPORT_FILES.diagramPng, dataUrl);
}

// Export a fixed 1200×630 "share card" PNG (the Open Graph / link-preview size):
// the diagram framed to fit all nodes as the background, with a bottom gradient
// scrim carrying the title + subtitle. Suitable for slides, wikis, and link
// unfurls. Same file:// safety as exportDiagramPng (icons inlined, placeholder
// for any un-inlined <img>).
async function exportShareCard(nodes: Node[], dark: boolean | undefined, title: string | undefined, subtitle: string | undefined, saver: FileSaver): Promise<void> {
  const el = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!el || !nodes.length) return;
  const { toPng } = await import("html-to-image");
  const W = SHARE_CARD.width, H = SHARE_CARD.height;
  const vp = getViewportForBounds(getNodesBounds(nodes), W, H, 0.2, 2, 0.14);
  const bg = dark ? "#0f1117" : "#f8fafc";
  const diagramUrl = await toPng(el, {
    backgroundColor: bg, width: W, height: H, pixelRatio: 2,
    imagePlaceholder: TRANSPARENT_PIXEL_PNG,
    style: { width: `${W}px`, height: `${H}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` },
  });
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = diagramUrl; });

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  // A 2D context is always available on a fresh canvas element.
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);

  const txt = dark ? "#f8fafc" : "#0f1117";
  const muted = dark ? "rgba(248,250,252,0.72)" : "rgba(15,17,23,0.66)";
  // Measure FIRST, then lay the band out from the bottom edge up (application/
  // exports.ts): a 2-line title never pushes the subtitle off the 630px canvas.
  const lay = shareCardLayout(title, subtitle, (font, t) => { ctx.font = font; return ctx.measureText(t).width; });

  // Bottom scrim so the title stays legible over the diagram — tall enough to
  // cover the whole text block plus the accent bar.
  const grad = ctx.createLinearGradient(0, lay.scrimTop, 0, H);
  grad.addColorStop(0, dark ? "rgba(15,17,23,0)" : "rgba(248,250,252,0)");
  grad.addColorStop(1, dark ? "rgba(15,17,23,0.96)" : "rgba(248,250,252,0.97)");
  ctx.fillStyle = grad; ctx.fillRect(0, lay.scrimTop, W, lay.scrimHeight);

  // AWS-orange accent bar sitting just above the text block.
  ctx.fillStyle = AWS_ORANGE;
  ctx.fillRect(lay.accent.x, lay.accent.y, lay.accent.width, lay.accent.height);

  ctx.fillStyle = txt; ctx.font = SHARE_CARD.titleFont; ctx.textBaseline = "alphabetic";
  for (const l of lay.titleLines) ctx.fillText(l.text, l.x, l.y);
  if (lay.subtitleLines.length) {
    ctx.fillStyle = muted; ctx.font = SHARE_CARD.subtitleFont;
    for (const l of lay.subtitleLines) ctx.fillText(l.text, l.x, l.y);
  }

  saver.saveUrl(EXPORT_FILES.shareCardPng, canvas.toDataURL("image/png"));
}

// Language picker: a single button showing the active language that opens a popup
// menu of all offered languages. Scales to any number of languages (a flat button
// row does not), and keeps the dock compact.
interface LangMenuProps {
  lang: string; languages: string[]; onLang?: (lang: string) => void; langLabel: (lang: string) => string;
  ui: DockUi; btn: CSSProperties; dark?: boolean;
}

function LangMenu({ lang, languages, onLang, langLabel, ui, btn, dark }: LangMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as globalThis.Node | null)) setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", (e) => e.key === "Escape" && setOpen(false));
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button style={{ ...btn, gap: 6 }} title={ui("language", lang)} onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox" aria-expanded={open}>
        {/* globe glyph */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>
        <span style={{ fontSize: 11, fontWeight: 700 }}>{langLabel(lang)}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open && (
        <div role="listbox" style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
          minWidth: 140, maxHeight: 260, overflowY: "auto", padding: 4,
          background: dark ? "rgba(26,29,39,0.98)" : "rgba(255,255,255,0.98)",
          border: "1px solid var(--border)", borderRadius: 10, backdropFilter: "blur(12px)",
          boxShadow: "0 8px 28px rgba(0,0,0,0.35)", zIndex: 40,
        }}>
          {languages.map((l) => {
            const active = l === lang;
            return (
              <button key={l} role="option" aria-selected={active}
                onClick={() => { onLang?.(l); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
                  padding: "8px 10px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13,
                  background: active ? "rgba(255,153,0,0.14)" : "transparent",
                  color: active ? AWS_ORANGE : "var(--txt)", fontWeight: active ? 700 : 500,
                }}>
                <span style={{ width: 16, display: "inline-flex", justifyContent: "center" }}>{active ? "✓" : ""}</span>
                {langLabel(l)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Dock items, in their default order. A layout may pick a subset, an order and
// props (`layout.slots.dock` → data.layout.dock), and mount registered custom
// components; ids without a renderer are skipped.
export const DOCK_ITEMS: string[] = ["brand", "title", "zoom", "png", "shareCard", "walkthrough", "cost", "language", "theme"];
// Items drawn as one cluster (no separator between them).
const TOOL_ITEMS = new Set(["zoom", "png", "shareCard"]);
// A logo is only ever an inlined image (data:image/...), never a remote URL.
const safeLogo = (u: unknown): string | undefined => (typeof u === "string" && /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : undefined);

// Split cost button: the main link opens the selected estimate; the caret opens
// a menu of every estimate (each a link, tagged with its environment) and, when
// there are several environments, a switch that changes which one the dock,
// the step pills and the node modal use.
interface CostSplitProps {
  costUrl: string; costLabel?: string; label: string; costs: DockCostEntry[]; costEnv?: string;
  envList: string[]; onCostEnv?: (env: string) => void; btn: CSSProperties; dark?: boolean;
}

function CostSplit({ costUrl, costLabel, label, costs, costEnv, envList, onCostEnv, btn, dark }: CostSplitProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const current = costs.find((c: CostEntry) => c.url === costUrl);
  const orange: CSSProperties = { textDecoration: "none", borderColor: "#FF990066", color: AWS_ORANGE, background: "rgba(255,153,0,0.1)", fontWeight: 700, whiteSpace: "nowrap" };
  return (
    <div key="costs" style={{ position: "relative", display: "flex", flex: "0 0 auto" }} data-ld-cost-split="">
      <a href={costUrl} target="_blank" rel="noopener noreferrer" title={label} data-ld-cost="dock"
        style={{ ...btn, ...orange, gap: 6, maxWidth: 240, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>
        <span data-ld-cost-label="" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{label}</span>
        {current?.env && <span data-ld-cost-env="" style={{ fontSize: 10, padding: "1px 5px", borderRadius: 5, background: "rgba(255,153,0,0.18)" }}>{current.env}</span>}
      </a>
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} title="estimates" onClick={() => setOpen((o) => !o)}
        style={{ ...btn, ...orange, padding: "0 8px", borderLeft: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}>▾</button>
      {open && (
        <div id={menuId} role="menu" style={{ position: "absolute", bottom: "calc(100% + 8px)", right: 0, minWidth: 240, maxWidth: 360, padding: 6, borderRadius: 12,
          border: "1px solid var(--border)", background: dark ? "rgba(26,29,39,0.98)" : "rgba(255,255,255,0.98)", boxShadow: "0 8px 28px rgba(0,0,0,0.28)", zIndex: 40 }}>
          {envList.length > 1 && (
            <div role="group" aria-label="environment" style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "4px 4px 8px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
              {envList.map((e) => (
                <button key={e} type="button" role="menuitemradio" aria-checked={e === costEnv} onClick={() => onCostEnv?.(e)}
                  style={{ border: "1px solid var(--border)", borderRadius: 7, padding: "3px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                    background: e === costEnv ? "rgba(255,153,0,0.16)" : "transparent", color: e === costEnv ? AWS_ORANGE : "var(--txt)" }}>{e}</button>
              ))}
            </div>
          )}
          {costs.map((c: CostEntry) => (
            <a key={c.id} role="menuitem" href={c.url} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 9px", borderRadius: 8, textDecoration: "none", color: "var(--txt)", fontSize: 12.5, fontWeight: c.url === costUrl ? 700 : 500 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label || c.id}</span>
              {c.env && <span style={{ flex: "0 0 auto", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5, border: "1px solid var(--border)", color: "var(--txt-muted)" }}>{c.env}</span>}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ZoomBar({
  title, subtitle, dark, visible, onToggle, onTheme,
  hasWalk, playing, onPlay, onReset, attention = false,
  lang = "en", languages = [], onLang,
  ui = noopUi, langLabel = defLangLabel,
  costUrl = undefined, costLabel = undefined, showTitle = true,
  // Several estimates (costs.js): every entry ({ id, env, label, url }), the
  // selected environment, the environments, and the switch. With more than one
  // entry the cost button becomes a split button with a menu.
  costs = undefined, costEnv = undefined, costEnvs: envList = undefined, onCostEnv = undefined,
  // Layout: dock entries in order ("title" | "dock.title" | { component, props }),
  // and an optional brand mark (inlined logo + product name). Default: DOCK_ITEMS.
  items = undefined, branding = undefined,
}: ZoomBarProps) {
  const { zoomIn, zoomOut, fitView, getNodes } = useReactFlow();
  const { fileSaver } = useCoreHost();

  if (!visible) {
    return (
      <button onClick={onToggle} style={{
        position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 30,
        width: 40, height: 40, borderRadius: "50%", border: "1px solid var(--border)",
        background: `var(--ld-dock-bg, ${dark ? "rgba(26,29,39,0.95)" : "rgba(255,255,255,0.95)"})`,
        color: "var(--txt)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(12px)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      }}>▲</button>
    );
  }

  const btn: CSSProperties = {
    height: 34, padding: "0 12px", border: "1px solid var(--border)", borderRadius: 8,
    background: "transparent", color: "var(--txt)", fontSize: 13, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s",
  };
  const sep = (k: string) => <div key={k} style={{ width: 1, height: 20, background: "var(--border)", margin: "0 8px" }} />;
  const logo = safeLogo(branding?.logo);
  const brandName = branding?.name;

  // Each renderer returns the item's element(s), or null when it has nothing to show.
  const render: Record<string, (p: ItemProps) => DockElement> = {
    brand: () => (logo || brandName) ? (
      <div key="brand" style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 4 }}>
        {logo && <img src={logo} alt={brandName || ""} style={{ height: 22, width: "auto", display: "block" }} />}
        {brandName && <span style={{ fontSize: 13, fontWeight: 700, color: "var(--txt)", whiteSpace: "nowrap" }}>{brandName}</span>}
      </div>
    ) : null,
    title: (p) => (showTitle && title) ? (
      /* Fixed-width text column: it used to get its width from the nowrap
         subtitle, so once that wraps the flex item would collapse to min-content
         and squeeze the title into a sliver. */
      <div key="title" style={p.width ? { marginRight: 12, flex: `0 0 ${p.width}px`, maxWidth: p.width } : { marginRight: 12, flex: "0 0 300px", maxWidth: 300 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--txt)", lineHeight: 1.2, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{title}</div>
        {/* The subtitle is a sentence, not a tag: it wraps (up to four lines)
            instead of being clipped mid-word with an ellipsis. */}
        {subtitle && <div style={{ fontSize: 10, color: "var(--txt-muted)", lineHeight: 1.35, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden", marginTop: 3 }}>{subtitle}</div>}
      </div>
    ) : null,
    zoom: () => [
      <button key="zoom-out" style={btn} onClick={() => zoomOut({ duration: 300 })}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M8 11h6"/></svg>
      </button>,
      <button key="zoom-fit" style={btn} onClick={() => fitView({ padding: 0.02, duration: 400 })}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m11.25-5.25v4.5m0-4.5h-4.5m4.5 0L15 9m-11.25 11.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 5.25v-4.5m0 4.5h-4.5m4.5 0L15 15"/></svg>
      </button>,
      <button key="zoom-in" style={btn} onClick={() => zoomIn({ duration: 300 })}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M11 8v6m-3-3h6"/></svg>
      </button>,
    ],
    png: () => (
      <button key="png" style={btn} title={ui("exportPng", lang)} onClick={() => exportDiagramPng(getNodes(), dark, fileSaver)}>
        {/* download / save-as-image glyph */}
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
      </button>
    ),
    shareCard: () => (
      <button key="shareCard" style={btn} title={ui("shareCard", lang) === "shareCard" ? "Share card (1200×630 PNG)" : ui("shareCard", lang)}
        onClick={() => exportShareCard(getNodes(), dark, title, subtitle, fileSaver)}>
        {/* share-card glyph: framed image with a title bar */}
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 15l4-4 4 4M14 13l2-2 5 5"/><line x1="7" y1="8" x2="7.01" y2="8"/></svg>
      </button>
    ),
    walkthrough: () => hasWalk ? [
      <button key="restart" style={btn} onClick={onReset} title={ui("restart", lang)}>
        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
      </button>,
      <button key="play"
        className={attention ? "ld-play-attention" : undefined}
        style={playing
          ? { ...btn, borderColor: AWS_ORANGE, color: AWS_ORANGE, background: "rgba(255,153,0,0.1)" }
          : attention
            ? { ...btn, borderColor: AWS_ORANGE, color: AWS_ORANGE, background: "rgba(255,153,0,0.12)" }
            : btn}
        onClick={onPlay} title={playing ? ui("pause", lang) : ui("play", lang)}>
        {playing
          ? <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
          : <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
      </button>,
    ] : null,
    // Cost CTA: only a link to an external estimate (e.g. an AWS Pricing
    // Calculator URL) — the diagram itself never prices anything.
    // Several estimates: a split button — the selected one, and a menu with the
    // others (label + environment tag) and an environment switch.
    costs: (p) => costUrl ? <CostSplit key="costs" {...{ costUrl, costLabel, costs: costs || [], costEnv, envList: envList || [], onCostEnv, btn, dark, label: costLabel || (p.label != null ? p.label : ui("cost", lang)) }} /> : null,
    // One line, always: a long label is clipped with an ellipsis (full text in
    // the tooltip) instead of wrapping and growing the dock taller.
    cost: (p) => ((costs?.length ?? 0) > 1 && costUrl) ? render.costs(p) : costUrl ? (
      <a key="cost" href={costUrl} target="_blank" rel="noopener noreferrer" title={costLabel || p.label || ui("cost", lang)}
        data-ld-cost="dock"
        style={{ ...btn, textDecoration: "none", gap: 6, borderColor: "#FF990066", color: AWS_ORANGE, background: "rgba(255,153,0,0.1)", fontWeight: 700, whiteSpace: "nowrap", flex: "0 0 auto", maxWidth: 240 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "0 0 auto" }}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="17" x2="8" y2="12"/><line x1="12" y1="17" x2="12" y2="8"/><line x1="16" y1="17" x2="16" y2="14"/></svg>
        <span data-ld-cost-label="" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{costLabel || p.label || ui("cost", lang)}</span>
      </a>
    ) : null,
    language: () => languages.length > 1
      ? <LangMenu key="language" lang={lang} languages={languages} onLang={onLang} langLabel={langLabel} ui={ui} btn={btn} dark={dark} />
      : null,
    theme: () => <button key="theme" style={btn} onClick={onTheme} title={ui("theme", lang)}>{dark ? "☀" : "☾"}</button>,
  };

  // Lay the visible items out with a separator between clusters; the hide
  // toggle (▼) always closes the dock so it can be reopened. A layout entry that
  // is not built in mounts the registered custom component of that id.
  const entries = normalizeSlotEntries(items, "dock") || DOCK_ITEMS.map((key): SlotEntry => ({ component: key, key, props: {} }));
  const ctx: DockContext = { title, subtitle, dark, lang, ui, hasWalk, playing, costUrl, costLabel, languages };
  const out: ReactElement[] = [];
  let prevTool = false;
  const done = new Set<string>();
  for (const { component, key, props } of entries) {
    if (done.has(component)) continue;
    done.add(component);
    let el: DockElement;
    if (render[key]) el = render[key](props);
    else {
      // The registry holds the host's React components (registerComponent).
      const Custom = getRegisteredComponent(component) as CustomDockItem | undefined;
      el = Custom ? <Custom key={component} {...props} ctx={ctx} /> : null;
    }
    if (el == null) continue;
    const tool = TOOL_ITEMS.has(key);
    if (out.length && !(tool && prevTool)) out.push(sep(`sep-${component}`));
    out.push(...(Array.isArray(el) ? el : [el]));
    prevTool = tool;
  }
  if (out.length) out.push(sep("sep-hide"));

  return (
    <div style={{
      position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 30,
      display: "flex", alignItems: "center", gap: 6, padding: "10px 20px",
      background: `var(--ld-dock-bg, ${dark ? "rgba(26,29,39,0.95)" : "rgba(255,255,255,0.95)"})`,
      border: "1px solid var(--border)", borderRadius: 16, backdropFilter: "blur(12px)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
    }}>
      {out}
      <button style={btn} onClick={onToggle}>▼</button>
    </div>
  );
}
