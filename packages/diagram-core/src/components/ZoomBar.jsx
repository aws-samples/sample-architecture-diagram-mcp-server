// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Floating dock: title/subtitle, zoom controls, guided-walkthrough play/restart,
// language switch, theme toggle, collapse. UI-chrome strings are injected via
// `ui(key)` and `langLabel(code)` so the host owns the chrome i18n table.
import { useReactFlow } from "@xyflow/react";
import { useState, useEffect, useRef } from "react";

const noopUi = (k) => k;
const defLangLabel = (l) => (l || "").toUpperCase();

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
  costUrl, costLabel,
  hasCard = false, onTextBigger, onTextSmaller, canTextBigger = false, canTextSmaller = false,
  lang = "en", languages = [], onLang,
  ui = noopUi, langLabel = defLangLabel,
}) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

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
        {sep}
      </>}
      {costUrl && <>
        <a href={costUrl} target="_blank" rel="noopener noreferrer" title={costLabel || ui("cost", lang)}
          style={{ ...btn, textDecoration: "none", gap: 6, borderColor: "#FF990066", color: "#FF9900", background: "rgba(255,153,0,0.1)", fontWeight: 700 }}>
          {/* AWS Cost Explorer-style glyph: bar chart in a frame (matches the
              official AWS cost/billing icon language). */}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="17" x2="8" y2="12"/><line x1="12" y1="17" x2="12" y2="8"/><line x1="16" y1="17" x2="16" y2="14"/></svg>
          {costLabel || ui("cost", lang)}
        </a>
        {sep}
      </>}
      {hasCard && (onTextSmaller || onTextBigger) && <>
        <button style={{ ...btn, opacity: canTextSmaller ? 1 : 0.4, cursor: canTextSmaller ? "pointer" : "default", gap: 2 }}
          disabled={!canTextSmaller} onClick={canTextSmaller ? onTextSmaller : undefined} title={ui("textSmaller", lang)}>
          <span style={{ fontSize: 11, fontWeight: 800 }}>A</span><span style={{ fontSize: 15, fontWeight: 800 }}>−</span>
        </button>
        <button style={{ ...btn, opacity: canTextBigger ? 1 : 0.4, cursor: canTextBigger ? "pointer" : "default", gap: 2 }}
          disabled={!canTextBigger} onClick={canTextBigger ? onTextBigger : undefined} title={ui("textLarger", lang)}>
          <span style={{ fontSize: 11, fontWeight: 800 }}>A</span><span style={{ fontSize: 15, fontWeight: 800 }}>+</span>
        </button>
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
