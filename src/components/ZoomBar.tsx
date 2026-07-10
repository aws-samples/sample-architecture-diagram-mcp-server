// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { useReactFlow } from "@xyflow/react";

interface Props {
  title: string;
  subtitle?: string;
  dark: boolean;
  visible: boolean;
  onToggle: () => void;
  onTheme: () => void;
  hasWalk?: boolean;    // a guided walkthrough (data.steps) is present
  playing?: boolean;    // walkthrough auto-play running
  onPlay?: () => void;  // toggle walkthrough auto-play
  onReset?: () => void; // jump the walkthrough back to the first beat
}

export default function ZoomBar({ title, subtitle, dark, visible, onToggle, onTheme, hasWalk, playing, onPlay, onReset }: Props) {
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

  const btn: React.CSSProperties = {
    height: 34,
    padding: "0 12px",
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "transparent",
    color: "var(--txt)",
    fontSize: 13,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background .15s",
  };

  const sep = <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 8px" }} />;

  return (
    <div style={{
      position: "absolute",
      bottom: 24,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 30,
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "10px 20px",
      background: dark ? "rgba(26,29,39,0.95)" : "rgba(255,255,255,0.95)",
      border: "1px solid var(--border)",
      borderRadius: 16,
      backdropFilter: "blur(12px)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
    }}>
      {/* Title — wraps to 2 lines so long deck titles aren't truncated */}
      <div style={{ marginRight: 12, minWidth: 0, maxWidth: 320 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--txt)", lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 10, color: "var(--txt-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 320, marginTop: 2 }}>{subtitle}</div>}
      </div>

      {sep}

      {/* Zoom */}
      <button style={btn} onClick={() => zoomOut()}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M8 11h6"/></svg>
      </button>
      <button style={btn} onClick={() => fitView({ padding: 0.02 })}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m11.25-5.25v4.5m0-4.5h-4.5m4.5 0L15 9m-11.25 11.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 5.25v-4.5m0 4.5h-4.5m4.5 0L15 15"/></svg>
      </button>
      <button style={btn} onClick={() => zoomIn()}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M11 8v6m-3-3h6"/></svg>
      </button>

      {sep}

      {/* Walkthrough controls (only when a guided walkthrough is present) */}
      {hasWalk && <>
        <button style={btn} onClick={onReset} title="Restart walkthrough">
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
        <button style={playing ? { ...btn, borderColor: "#FF9900", color: "#FF9900", background: "rgba(255,153,0,0.1)" } : btn}
          onClick={onPlay} title={playing ? "Pause walkthrough" : "Play walkthrough"}>
          {playing
            ? <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
            : <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
        </button>
        {sep}
      </>}

      {/* Theme */}
      <button style={btn} onClick={onTheme}>{dark ? "☀" : "☾"}</button>

      {sep}

      <button style={btn} onClick={onToggle}>▼</button>
    </div>
  );
}
