// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Floating dock: title/subtitle, zoom controls, guided-walkthrough play/restart,
// language switch, theme toggle, collapse. UI-chrome strings are injected via
// `ui(key)` and `langLabel(code)` so the host owns the chrome i18n table.
import { useReactFlow } from "@xyflow/react";

const noopUi = (k) => k;
const defLangLabel = (l) => (l || "").toUpperCase();

export default function ZoomBar({
  title, subtitle, dark, visible, onToggle, onTheme,
  hasWalk, playing, onPlay, onReset, attention = false,
  costUrl, costLabel,
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
      {languages.length > 1 && <>
        <div style={{ display: "flex", gap: 2 }} title={ui("language", lang)}>
          {languages.map((l) => (
            <button key={l}
              style={l === lang ? { ...btn, padding: "0 8px", borderColor: "#FF9900", color: "#FF9900", background: "rgba(255,153,0,0.1)", fontWeight: 700, fontSize: 11 } : { ...btn, padding: "0 8px", fontSize: 11 }}
              onClick={() => onLang?.(l)}>
              {langLabel(l)}
            </button>
          ))}
        </div>
        {sep}
      </>}
      <button style={btn} onClick={onTheme} title={ui("theme", lang)}>{dark ? "☀" : "☾"}</button>
      {sep}
      <button style={btn} onClick={onToggle}>▼</button>
    </div>
  );
}
