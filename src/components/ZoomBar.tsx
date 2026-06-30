import { useReactFlow } from "@xyflow/react";

interface Props {
  title: string;
  subtitle?: string;
  direction: "LR" | "TB";
  dark: boolean;
  lang: string;
  visible: boolean;
  onToggle: () => void;
  onDirection: (d: "LR" | "TB") => void;
  onTheme: () => void;
  onLang: () => void;
  onExport: (kind: "iac" | "calculator") => void;
  onExportImage: () => void;
  onExportDrawio: () => void;
  hasFlow: boolean;
  playing: boolean;
  speed: number;
  onPlay: () => void;
  onSpeed: () => void;
  hasInfo: boolean;
  onInfo: () => void;
}

export default function ZoomBar({ title, subtitle, direction, dark, lang, visible, onToggle, onDirection, onTheme, onLang, onExport, onExportImage, onExportDrawio, hasFlow, playing, speed, onPlay, onSpeed, hasInfo, onInfo }: Props) {
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

  const active = (cond: boolean): React.CSSProperties => cond
    ? { ...btn, borderColor: "#007CBD", color: "#007CBD", background: "rgba(0,124,189,0.1)" }
    : btn;

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
      {/* Title */}
      <div style={{ marginRight: 12, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--txt)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 10, color: "var(--txt-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{subtitle}</div>}
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

      {/* Layout */}
      <button style={active(direction === "TB")} onClick={() => onDirection("TB")}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 3v18m0 0l-6-6m6 6l6-6"/></svg>
      </button>
      <button style={active(direction === "LR")} onClick={() => onDirection("LR")}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12h18m0 0l-6-6m6 6l-6 6"/></svg>
      </button>

      {sep}

      {/* Flow execution */}
      {hasFlow && <>
        <button style={active(playing)} onClick={onPlay} title={lang === 'pt' ? 'Reproduzir fluxo' : 'Play flow'}>
          {playing
            ? <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
            : <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
        </button>
        <button style={btn} onClick={onSpeed} title={lang === 'pt' ? 'Velocidade' : 'Speed'}>{speed}x</button>
        {sep}
      </>}

      {/* Theme + Lang */}
      <button style={btn} onClick={onTheme}>{dark ? "☀" : "☾"}</button>
      <button style={btn} onClick={onLang}>{lang === 'pt' ? 'EN' : 'PT'}</button>

      {sep}

      {/* Architecture decisions & Well-Architected */}
      {hasInfo && <>
        <button style={btn} onClick={onInfo} title={lang === 'pt' ? 'Decisões & Well-Architected' : 'Decisions & Well-Architected'}>ADR</button>
        {sep}
      </>}

      {/* Export: PNG image + MCP handoff payloads */}
      <button style={btn} onClick={onExportImage} title={lang === 'pt' ? 'Exportar PNG' : 'Export PNG'}>PNG</button>
      <button style={btn} onClick={onExportDrawio} title={lang === 'pt' ? 'Exportar .drawio (editável)' : 'Export .drawio (editable)'}>.drawio</button>
      <button style={btn} onClick={() => onExport("iac")} title="IaC via aws-iac-mcp">IaC</button>
      <button style={btn} onClick={() => onExport("calculator")} title="Pricing via aws-calculator-mcp">💰</button>

      {sep}

      <button style={btn} onClick={onToggle}>▼</button>
    </div>
  );
}
