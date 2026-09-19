// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Floating dock: title/subtitle, zoom controls, guided-walkthrough play/restart,
// language switch, theme toggle, collapse. UI-chrome strings are injected via
// `ui(key)` and `langLabel(code)` so the host owns the chrome i18n table.
import { useReactFlow, getNodesBounds, getViewportForBounds } from "@xyflow/react";
import { useState, useEffect, useRef } from "react";

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

  // Bottom scrim so the title stays legible over the diagram.
  const scrimH = 200;
  const grad = ctx.createLinearGradient(0, H - scrimH, 0, H);
  grad.addColorStop(0, dark ? "rgba(15,17,23,0)" : "rgba(248,250,252,0)");
  grad.addColorStop(1, dark ? "rgba(15,17,23,0.96)" : "rgba(248,250,252,0.97)");
  ctx.fillStyle = grad; ctx.fillRect(0, H - scrimH, W, scrimH);

  // AWS-orange accent bar + title/subtitle text.
  const PAD = 56;
  ctx.fillStyle = "#FF9900";
  ctx.fillRect(PAD, H - 118, 48, 6);
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
  const titleFont = "700 44px 'Amazon Ember', 'Helvetica Neue', Helvetica, Arial, sans-serif";
  const titleLines = wrap(title, titleFont, W - PAD * 2, 2);
  ctx.fillStyle = txt; ctx.font = titleFont; ctx.textBaseline = "alphabetic";
  let y = H - 92 + 44;
  for (const l of titleLines) { ctx.fillText(l, PAD, y); y += 50; }
  if (subtitle) {
    const subFont = "400 24px 'Amazon Ember', 'Helvetica Neue', Helvetica, Arial, sans-serif";
    const subLines = wrap(subtitle, subFont, W - PAD * 2, 1);
    ctx.fillStyle = muted; ctx.font = subFont;
    if (subLines[0]) ctx.fillText(subLines[0], PAD, y + 4);
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
                  color: active ? "#FF9900" : "var(--txt)", fontWeight: active ? 700 : 500,
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

export default function ZoomBar({
  title, subtitle, dark, visible, onToggle, onTheme,
  hasWalk, playing, onPlay, onReset, attention = false,
  onRecord, recording = false, canRecord = false,
  lang = "en", languages = [], onLang,
  ui = noopUi, langLabel = defLangLabel,
}) {
  const { zoomIn, zoomOut, fitView, getNodes } = useReactFlow();

  if (!visible) {
    return (
      <button onClick={onToggle} style={{
        position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 30,
        width: 40, height: 40, borderRadius: "50%", border: "1px solid var(--border)",
        background: dark ? "rgba(26,29,39,0.95)" : "rgba(255,255,255,0.95)",
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
  const sep = <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 8px" }} />;

  return (
    <div style={{
      position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 30,
      display: "flex", alignItems: "center", gap: 6, padding: "10px 20px",
      background: dark ? "rgba(26,29,39,0.95)" : "rgba(255,255,255,0.95)",
      border: "1px solid var(--border)", borderRadius: 16, backdropFilter: "blur(12px)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
    }}>
      <div style={{ marginRight: 12, minWidth: 0, maxWidth: 320 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--txt)", lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 10, color: "var(--txt-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 320, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {sep}
      <button style={btn} onClick={() => zoomOut({ duration: 300 })}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M8 11h6"/></svg>
      </button>
      <button style={btn} onClick={() => fitView({ padding: 0.02, duration: 400 })}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m11.25-5.25v4.5m0-4.5h-4.5m4.5 0L15 9m-11.25 11.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 5.25v-4.5m0 4.5h-4.5m4.5 0L15 15"/></svg>
      </button>
      <button style={btn} onClick={() => zoomIn({ duration: 300 })}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M11 8v6m-3-3h6"/></svg>
      </button>
      <button style={btn} title={ui("exportPng", lang)} onClick={() => exportDiagramPng(getNodes(), dark)}>
        {/* download / save-as-image glyph */}
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
      </button>
      <button style={btn} title={ui("shareCard", lang) === "shareCard" ? "Share card (1200×630 PNG)" : ui("shareCard", lang)}
        onClick={() => exportShareCard(getNodes(), dark, title, subtitle)}>
        {/* share-card glyph: framed image with a title bar */}
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 15l4-4 4 4M14 13l2-2 5 5"/><line x1="7" y1="8" x2="7.01" y2="8"/></svg>
      </button>
      {sep}
      {hasWalk && <>
        <button style={btn} onClick={onReset} title={ui("restart", lang)}>
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
        <button
          className={attention ? "ld-play-attention" : undefined}
          style={playing
            ? { ...btn, borderColor: "#FF9900", color: "#FF9900", background: "rgba(255,153,0,0.1)" }
            : attention
              ? { ...btn, borderColor: "#FF9900", color: "#FF9900", background: "rgba(255,153,0,0.12)" }
              : btn}
          onClick={onPlay} title={playing ? ui("pause", lang) : ui("play", lang)}>
          {playing
            ? <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
            : <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
        </button>
        {canRecord && (
          <button
            style={recording
              ? { ...btn, borderColor: "#DD344C", color: "#DD344C", background: "rgba(221,52,76,0.12)", gap: 6 }
              : btn}
            onClick={onRecord} disabled={recording}
            title={recording
              ? (ui("recording", lang) === "recording" ? "Recording walkthrough…" : ui("recording", lang))
              : (ui("recordWebm", lang) === "recordWebm" ? "Record walkthrough (WebM)" : ui("recordWebm", lang))}>
            {/* record-dot glyph; pulses while recording */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="7">{recording && <animate attributeName="opacity" values="1;0.3;1" dur="1.1s" repeatCount="indefinite" />}</circle>
            </svg>
            {recording && <span style={{ fontSize: 11, fontWeight: 800 }}>REC</span>}
          </button>
        )}
        {sep}
      </>}
      {languages.length > 1 && <>
        <LangMenu lang={lang} languages={languages} onLang={onLang} langLabel={langLabel} ui={ui} btn={btn} dark={dark} />
        {sep}
      </>}
      <button style={btn} onClick={onTheme} title={ui("theme", lang)}>{dark ? "☀" : "☾"}</button>
      {sep}
      <button style={btn} onClick={onToggle}>▼</button>
    </div>
  );
}
