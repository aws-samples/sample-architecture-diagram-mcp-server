interface Step {
  id: string;
  label?: string;
  source: string;
  target: string;
}

interface Props {
  steps: Step[];
  activeStep: number | null;
  setActiveStep: (i: number | null) => void;
  serviceNames?: Record<string, string>;
  lang?: string;
}

export default function StepModal({ steps, activeStep, setActiveStep, serviceNames = {}, lang = 'en' }: Props) {
  if (activeStep === null) return null;
  const step = steps[activeStep];
  if (!step) return null;

  const t = lang === 'pt'
    ? { step: 'Passo', prev: '← Anterior', next: 'Próximo →', noDesc: 'Sem descrição.' }
    : { step: 'Step', prev: '← Prev', next: 'Next →', noDesc: 'No description.' };

  const close = () => setActiveStep(null);
  const prev = () => { if (activeStep > 0) setActiveStep(activeStep - 1); };
  const next = () => { if (activeStep < steps.length - 1) setActiveStep(activeStep + 1); };
  const name = (id: string) => serviceNames[id] || id;

  return (
    <div onClick={close} style={{
      position: "absolute", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
        padding: 24, width: 380,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 28, height: 28, borderRadius: "50%", background: "#007CBD", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700,
            }}>{activeStep + 1}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--txt)" }}>{t.step} {activeStep + 1}</span>
          </div>
          <button onClick={close} style={{ background: "none", border: "none", color: "var(--txt-muted)", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ fontSize: 12, color: "var(--txt-muted)", marginBottom: 12 }}>
          <span style={{ fontWeight: 600, color: "var(--txt)" }}>{name(step.source)}</span>
          <span> → </span>
          <span style={{ fontWeight: 600, color: "var(--txt)" }}>{name(step.target)}</span>
        </div>

        <p style={{ fontSize: 13, color: "var(--txt)", lineHeight: 1.6, margin: 0 }}>
          {step.label || t.noDesc}
        </p>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
          <button onClick={prev} disabled={activeStep === 0} style={btn(activeStep === 0)}>{t.prev}</button>
          <span style={{ fontSize: 11, color: "var(--txt-muted)" }}>{activeStep + 1} / {steps.length}</span>
          <button onClick={next} disabled={activeStep === steps.length - 1} style={btn(activeStep === steps.length - 1)}>{t.next}</button>
        </div>
      </div>
    </div>
  );
}

function btn(disabled: boolean): React.CSSProperties {
  return {
    padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)",
    background: "var(--surface)", color: disabled ? "var(--txt-muted)" : "var(--txt)",
    fontSize: 11, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1,
  };
}
