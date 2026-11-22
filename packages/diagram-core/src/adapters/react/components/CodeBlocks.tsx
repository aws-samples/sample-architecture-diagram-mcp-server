// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Collapsible code blocks (step card + sequence card) ───
// Several files on one beat: each block has its own header (label + language),
// copy button and chevron; the group header expands or collapses them all; a
// long block shows its first `maxLines` with "show more (N lines)". The open /
// expanded state is remembered per beat while the viewer navigates (keyed by the
// beat object), and print shows every block in full.
//
// Plain CSS with own class names (no utility scan), so the same component works
// in the architecture page and in the standalone sequence player.
import { useId, useState } from "react";
import { useCoreHost } from "#core/adapters/react/host.tsx";
import type { CSSProperties } from "react";
import type { CodeBlock } from "#core/domain/codeBlocks.ts";

interface BeatMemory { open: Set<string>; more: Set<string> }

// Per-beat memory: the beat object (step / event) → { open: Set, more: Set }.
const MEMORY = new WeakMap<object, BeatMemory>();
function memoryOf(key: unknown, blocks: readonly CodeBlock[]): BeatMemory {
  const known = key && typeof key === "object" ? MEMORY.get(key) : undefined;
  if (known) return known;
  const m: BeatMemory = { open: new Set(blocks.filter((b) => !b.collapsed).map((b) => b.id)), more: new Set() };
  if (key && typeof key === "object") MEMORY.set(key, m);
  return m;
}

interface CodeBlocksStrings {
  files: (n: number) => string; expandAll: string; collapseAll: string; copy: string; copied: string;
  more: (n: number) => string; less: string; collapsed: (n: number) => string;
}

const UI: Record<string, CodeBlocksStrings> = {
  en: { files: (n) => `${n} files`, expandAll: "Expand all", collapseAll: "Collapse all", copy: "copy", copied: "copied", more: (n) => `Show more (${n} lines)`, less: "Show less", collapsed: (n) => `collapsed · ${n} lines` },
  pt: { files: (n) => `${n} arquivos`, expandAll: "Expandir tudo", collapseAll: "Recolher tudo", copy: "copiar", copied: "copiado", more: (n) => `Mostrar mais (${n} linhas)`, less: "Mostrar menos", collapsed: (n) => `recolhido · ${n} linhas` },
  es: { files: (n) => `${n} archivos`, expandAll: "Expandir todo", collapseAll: "Contraer todo", copy: "copiar", copied: "copiado", more: (n) => `Mostrar más (${n} líneas)`, less: "Mostrar menos", collapsed: (n) => `contraído · ${n} líneas` },
};
const uiFor = (lang: string | undefined): CodeBlocksStrings => UI[String(lang)] || UI[String(lang || "").split("-")[0]] || UI.en;

function Chevron({ open }: { open: boolean }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s", flex: "0 0 auto" }}><path d="m9 6 6 6-6 6" /></svg>;
}

/**
 * blocks: from codeBlocksOf(); beatKey: the step/event object (state memory);
 * color: accent; lang: UI language; showCopy / showLang: header parts.
 */
export interface CodeBlocksProps {
  /** From codeBlocksOf(). */
  blocks?: readonly CodeBlock[] | null;
  /** The step/event object the open/expanded state is remembered by. */
  beatKey?: object | null;
  color?: string;
  lang?: string;
  showCopy?: boolean;
  showLang?: boolean;
}

export function CodeBlocks({ blocks, beatKey, color = "#475569", lang = "en", showCopy = true, showLang = true }: CodeBlocksProps) {
  const { clipboard } = useCoreHost();
  const t = uiFor(lang);
  const uid = useId();
  const mem = memoryOf(beatKey, blocks ?? []);
  const [open, setOpen] = useState(() => new Set(mem.open));
  const [more, setMore] = useState(() => new Set(mem.more));
  const [copied, setCopied] = useState<string | null>(null);
  if (!blocks || !blocks.length) return null;
  const save = (o: Set<string>, m: Set<string>) => { mem.open = o; mem.more = m; };
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); save(n, more); return n; });
  const toggleMore = (id: string) => setMore((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); save(open, n); return n; });
  const all = (on: boolean) => { const n = new Set(on ? blocks.map((b) => b.id) : []); save(n, more); setOpen(n); };
  const copy = (b: CodeBlock) => {
    // Clipboard is often blocked under file:// — the Clipboard port swallows it.
    clipboard.writeText(b.code);
    setCopied(b.id); setTimeout(() => setCopied((c) => (c === b.id ? null : c)), 1400);
  };
  const allOpen = blocks.every((b) => open.has(b.id));
  return (
    <div className="ld-code" style={{ "--ld-code-accent": color } as CSSProperties} data-ld-code-blocks={blocks.length}>
      <style>{CODE_BLOCKS_CSS}</style>
      {blocks.length > 1 && (
        <div className="ld-code-group">
          <span>{t.files(blocks.length)}</span>
          <button type="button" className="ld-code-all" onClick={() => all(!allOpen)} aria-label={allOpen ? t.collapseAll : t.expandAll}>
            {allOpen ? t.collapseAll : t.expandAll}
          </button>
        </div>
      )}
      {blocks.map((b) => {
        const isOpen = open.has(b.id);
        const bodyId = `${uid}-${b.id}`;
        const lines = String(b.code).split("\n");
        const clamp = !more.has(b.id) && lines.length > b.maxLines;
        const shown = clamp ? lines.slice(0, b.maxLines).join("\n") : b.code;
        return (
          <div key={b.id} className={`ld-code-block${isOpen ? " open" : ""}`} data-ld-code-block={b.id}>
            <div className="ld-code-hd">
              <button type="button" className="ld-code-toggle" aria-expanded={isOpen} aria-controls={bodyId} onClick={() => toggle(b.id)}>
                <Chevron open={isOpen} />
                <span className="ld-code-label">{b.label || "code"}</span>
                {showLang && b.lang && <span className="ld-code-lang">{b.lang}</span>}
                {!isOpen && <span className="ld-code-hint">{t.collapsed(b.lineCount)}</span>}
              </button>
              {showCopy && (
                <button type="button" className="ld-code-copy" onClick={() => copy(b)} title={t.copy} aria-label={`${t.copy} ${b.label || ""}`.trim()}>
                  {copied === b.id ? t.copied : t.copy}
                </button>
              )}
            </div>
            <div id={bodyId} className={`ld-code-body${clamp ? " clamped" : ""}`} hidden={!isOpen}>
              <pre>{shown}</pre>
              {lines.length > b.maxLines && (
                <button type="button" className="ld-code-more" aria-expanded={!clamp} aria-controls={bodyId} onClick={() => toggleMore(b.id)}>
                  {clamp ? t.more(lines.length - b.maxLines) : t.less}
                </button>
              )}
              {/* Print shows the whole file even when clamped on screen. */}
              {clamp && <pre className="ld-code-print">{b.code}</pre>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const CODE_BLOCKS_CSS = `
.ld-code { display: flex; flex-direction: column; gap: 6px; }
.ld-code-group { display: flex; align-items: center; justify-content: space-between; font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--txt-muted, #94a3b8); }
.ld-code-all, .ld-code-more { border: 1px solid var(--border, rgba(148,163,184,.4)); background: transparent; color: inherit; border-radius: 6px; padding: 2px 8px; font: inherit; font-size: 10.5px; font-weight: 600; letter-spacing: 0; text-transform: none; cursor: pointer; }
.ld-code-block { border: 1px solid color-mix(in srgb, var(--ld-code-accent) 30%, transparent); border-radius: 8px; overflow: hidden; }
.ld-code-hd { display: flex; align-items: center; gap: 6px; background: var(--ld-code-accent); color: #fff; padding: 0 6px 0 0; }
.ld-code-toggle { flex: 1; min-width: 0; display: flex; align-items: center; gap: 7px; padding: 5px 10px; border: 0; background: transparent; color: inherit; font: inherit; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; cursor: pointer; text-align: left; }
.ld-code-toggle:focus-visible, .ld-code-copy:focus-visible, .ld-code-all:focus-visible, .ld-code-more:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }
.ld-code-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ld-code-lang { flex: 0 0 auto; font-size: 9.5px; font-weight: 700; text-transform: none; letter-spacing: 0; padding: 1px 6px; border-radius: 5px; background: rgba(255,255,255,.2); }
.ld-code-hint { flex: 0 0 auto; margin-left: auto; font-size: 9.5px; font-weight: 600; text-transform: none; letter-spacing: 0; opacity: .85; }
.ld-code-copy { flex: 0 0 auto; border: 0; background: transparent; color: rgba(255,255,255,.9); font: inherit; font-size: 10.5px; font-weight: 600; padding: 2px 6px; border-radius: 5px; cursor: pointer; }
.ld-code-copy:hover { background: rgba(255,255,255,.2); color: #fff; }
.ld-code-body { background: var(--chip-bg, rgba(148,163,184,.1)); }
.ld-code-body pre { margin: 0; padding: 10px 12px; font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre; overflow-x: auto; color: var(--txt, #e2e8f0); }
.ld-code-more { margin: 0 12px 10px; }
.ld-code-print { display: none; }
@media print {
  .ld-code-body[hidden] { display: block !important; }
  .ld-code-body.clamped > pre:not(.ld-code-print) { display: none; }
  .ld-code-body.clamped > pre.ld-code-print { display: block; }
  .ld-code-more, .ld-code-all, .ld-code-copy, .ld-code-hint { display: none !important; }
}
`;
