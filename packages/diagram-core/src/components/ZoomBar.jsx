// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Floating dock: title/subtitle, zoom controls, guided-walkthrough play/restart,
// language switch, theme toggle, collapse. UI-chrome strings are injected via
// `ui(key)` and `langLabel(code)` so the host owns the chrome i18n table.
import { useReactFlow, getNodesBounds, getViewportForBounds } from "@xyflow/react";
import { useState, useEffect, useRef } from "react";
import { AWS_ORANGE } from "../tones.js";
import { getRegisteredComponent, normalizeSlotEntries } from "../componentRegistry.js";

const noopUi = (k) => k;
const defLangLabel = (l) => (l || "").toUpperCase();

// Export the current diagram as a PNG, framed to fit ALL nodes (independent of
// the on-screen zoom/pan), at 2x for crisp output. Icons are inlined in the
// diagram, so it works under file://. html-to-image is imported lazily so the
// dock has no cost until the user actually exports.
async function exportDiagramPng(nodes, dark) {
  const el = document.querySelector(".react-flow__viewport");
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
    imagePlaceholder: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    style: { width: `${W}px`, height: `${H}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` },
  });
  const a = document.createElement("a");
  a.href = dataUrl; a.download = "architecture.png";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// Export a fixed 1200×630 "share card" PNG (the Open Graph / link-preview size):
// the diagram framed to fit all nodes as the background, with a bottom gradient
// scrim carrying the title + subtitle. Suitable for slides, wikis, and link
// unfurls. Same file:// safety as exportDiagramPng (icons inlined, placeholder
// for any un-inlined <img>).
async function exportShareCard(nodes, dark, title, subtitle) {
  const el = document.querySelector(".react-flow__viewport");
  if (!el || !nodes.length) return;
  const { toPng } = await import("html-to-image");
  const W = 1200, H = 630;
  const vp = getViewportForBounds(getNodesBounds(nodes), W, H, 0.2, 2, 0.14);
  const bg = dark ? "#0f1117" : "#f8fafc";
  const diagramUrl = await toPng(el, {
    backgroundColor: bg, width: W, height: H, pixelRatio: 2,
    imagePlaceholder: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    style: { width: `${W}px`, height: `${H}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` },
  });
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = diagramUrl; });

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);

  const PAD = 56;
  const txt = dark ? "#f8fafc" : "#0f1117";
  const muted = dark ? "rgba(248,250,252,0.72)" : "rgba(15,17,23,0.66)";
  const wrap = (s, font, maxW, maxLines) => {
    ctx.font = font;
    const words = String(s || "").split(/\s+/);
    const lines = []; let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; if (lines.length === maxLines) break; }
      else line = test;
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (lines.length === maxLines && ctx.measureText(line).width > maxW) {
      while (line && ctx.measureText(line + "…").width > maxW) line = line.slice(0, -1);
      lines[maxLines - 1] = line + "…";
    }
    return lines;
  };
  // Measure FIRST, then lay the band out from the bottom edge up: the old code
  // used fixed offsets, so a 2-line title pushed its second line — and the
  // subtitle with it — off the 630px canvas. The subtitle also got a single line
  // (cut mid-word with an "…"); it gets two, like the title.
  const titleFont = "700 44px 'Amazon Ember', 'Helvetica Neue', Helvetica, Arial, sans-serif";
  const subFont = "400 24px 'Amazon Ember', 'Helvetica Neue', Helvetica, Arial, sans-serif";
  const TITLE_LEAD = 50, SUB_LEAD = 30, BOTTOM = 46;
  const titleLines = wrap(title, titleFont, W - PAD * 2, 2);
  const subLines = subtitle ? wrap(subtitle, subFont, W - PAD * 2, 2) : [];
  const blockH = titleLines.length * TITLE_LEAD + subLines.length * SUB_LEAD;
  const blockTop = H - BOTTOM - blockH;

  // Bottom scrim so the title stays legible over the diagram — tall enough to
  // cover the whole text block plus the accent bar.
  const scrimH = Math.max(200, H - blockTop + 90);
  const grad = ctx.createLinearGradient(0, H - scrimH, 0, H);
  grad.addColorStop(0, dark ? "rgba(15,17,23,0)" : "rgba(248,250,252,0)");
  grad.addColorStop(1, dark ? "rgba(15,17,23,0.96)" : "rgba(248,250,252,0.97)");
  ctx.fillStyle = grad; ctx.fillRect(0, H - scrimH, W, scrimH);

  // AWS-orange accent bar sitting just above the text block.
  ctx.fillStyle = AWS_ORANGE;
  ctx.fillRect(PAD, blockTop - 26, 48, 6);

  ctx.fillStyle = txt; ctx.font = titleFont; ctx.textBaseline = "alphabetic";
  let y = blockTop + 38;
  for (const l of titleLines) { ctx.fillText(l, PAD, y); y += TITLE_LEAD; }
  if (subLines.length) {
    ctx.fillStyle = muted; ctx.font = subFont;
    y -= 6;
    for (const l of subLines) { ctx.fillText(l, PAD, y); y += SUB_LEAD; }
  }

  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url; a.download = "share-card.png";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// Language picker: a single button showing the active language that opens a popup
// menu of all offered languages. Scales to any number of languages (a flat button
// row does not), and keeps the dock compact.
function LangMenu({ lang, languages, onLang, langLabel, ui, btn, dark }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
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
export const DOCK_ITEMS = ["brand", "title", "zoom", "png", "shareCard", "walkthrough", "cost", "language", "theme"];
// Items drawn as one cluster (no separator between them).
const TOOL_ITEMS = new Set(["zoom", "png", "shareCard"]);
// A logo is only ever an inlined image (data:image/...), never a remote URL.
const safeLogo = (u) => (typeof u === "string" && /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : undefined);

export default function ZoomBar({
  title, subtitle, dark, visible, onToggle, onTheme,
  hasWalk, playing, onPlay, onReset, attention = false,
  lang = "en", languages = [], onLang,
  ui = noopUi, langLabel = defLangLabel,
  costUrl = undefined, costLabel = undefined, showTitle = true,
  // Layout: dock entries in order ("title" | "dock.title" | { component, props }),
  // and an optional brand mark (inlined logo + product name). Default: DOCK_ITEMS.
  items = undefined, branding = undefined,
}) {
  const { zoomIn, zoomOut, fitView, getNodes } = useReactFlow();

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

  const btn = {
    height: 34, padding: "0 12px", border: "1px solid var(--border)", borderRadius: 8,
    background: "transparent", color: "var(--txt)", fontSize: 13, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s",
  };
  const sep = (k) => <div key={k} style={{ width: 1, height: 20, background: "var(--border)", margin: "0 8px" }} />;
  const logo = safeLogo(branding?.logo);
  const brandName = branding?.name;

  // Each renderer returns the item's element(s), or null when it has nothing to show.
  const render = {
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
      <button key="png" style={btn} title={ui("exportPng", lang)} onClick={() => exportDiagramPng(getNodes(), dark)}>
        {/* download / save-as-image glyph */}
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
      </button>
    ),
    shareCard: () => (
      <button key="shareCard" style={btn} title={ui("shareCard", lang) === "shareCard" ? "Share card (1200×630 PNG)" : ui("shareCard", lang)}
        onClick={() => exportShareCard(getNodes(), dark, title, subtitle)}>
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
    cost: (p) => costUrl ? (
      <a key="cost" href={costUrl} target="_blank" rel="noopener noreferrer" title={costLabel || p.label || ui("cost", lang)}
        data-ld-cost="dock"
        style={{ ...btn, textDecoration: "none", gap: 6, borderColor: "#FF990066", color: AWS_ORANGE, background: "rgba(255,153,0,0.1)", fontWeight: 700 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="17" x2="8" y2="12"/><line x1="12" y1="17" x2="12" y2="8"/><line x1="16" y1="17" x2="16" y2="14"/></svg>
        {costLabel || p.label || ui("cost", lang)}
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
  const entries = normalizeSlotEntries(items, "dock") || DOCK_ITEMS.map((key) => ({ component: key, key, props: {} }));
  const ctx = { title, subtitle, dark, lang, ui, hasWalk, playing, costUrl, costLabel, languages };
  const out = [];
  let prevTool = false;
  const done = new Set();
  for (const { component, key, props } of entries) {
    if (done.has(component)) continue;
    done.add(component);
    let el;
    if (render[key]) el = render[key](props);
    else {
      const Custom = getRegisteredComponent(component);
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
