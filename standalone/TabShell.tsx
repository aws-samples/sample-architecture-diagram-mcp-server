// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Multi-tab chrome for the generated HTML — the same idea as the cost-calculator
// app's CalculatorChrome (a tab rail + one panel per view, deep-linkable through
// the URL hash), so ONE self-contained file can carry the live architecture, its
// animated UML sequence and prose sections instead of shipping three files.
//
// Only the active panel is MOUNTED: the architecture canvas measures itself on
// mount (ELK layout + fitView), and a hidden container has zero size — so tab
// switching remounts it instead of leaving it laid out against a 0×0 box.
import { useEffect, useMemo, useState } from 'react';
import { tr } from '@aws-live-diagram/core';
import { cardKit } from '@aws-live-diagram/core/react';
import { McpIcon } from './McpIcon';
import { SequenceDiagram } from './SequenceDiagram';

type Any = any;

const slugOf = (t: Any) => String(t.slug || t.id);

// Built-in glyph per tab kind, used when the author passes no `icon`.
const GLYPH: Record<string, string> = { architecture: '◫', sequence: '⇄', doc: '☰' };

function Bullets({ items, lang }: Any) {
  if (!items?.length) return null;
  return (
    <ul className="ld-doc-ul">
      {items.map((b: Any, i: number) => {
        const obj = typeof b === 'object' && b && !Array.isArray(b) && (b.text || b.strong) ? b : null;
        const text = tr(obj ? obj.text : b, lang);
        return (
          <li key={i} style={obj?.color ? { ['--dot-c' as any]: obj.color } : undefined}>
            {obj?.glyph ? <span className="ld-doc-glyph" style={{ color: obj.color }}>{obj.glyph}</span> : <i />}
            <span>
              {obj?.strong ? <b>{tr(obj.strong, lang)} — </b> : null}
              {cardKit.mdInline(text)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function DocPanel({ tab, lang }: Any) {
  return (
    <div className="ld-doc">
      {(tab.title || tab.subtitle) && (
        <div className="ld-doc-head">
          {tab.title && <h2>{tr(tab.title, lang)}</h2>}
          {tab.subtitle && <p>{tr(tab.subtitle, lang)}</p>}
        </div>
      )}
      {(tab.sections || []).map((s: Any, i: number) => (
        <section key={i} className="ld-doc-sec">
          {s.title && <h3>{tr(s.title, lang)}</h3>}
          {s.body && <p>{cardKit.mdInline(tr(s.body, lang))}</p>}
          <Bullets items={s.bullets} lang={lang} />
          {s.code && (
            <div className="ld-doc-code">
              {s.codeLabel && <span className="ld-doc-code-lbl">{tr(s.codeLabel, lang)}</span>}
              <pre>{tr(s.code, lang)}</pre>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

/**
 * @param tabs     normalized tab descriptors (lib/html-generator.js → resolveTabs)
 * @param ArchSlot render-prop for the live architecture canvas (kind:'architecture')
 */
export function TabShell({ tabs, lang, ArchSlot, ui }: Any) {
  const list: Any[] = tabs || [];
  const fromHash = () => {
    const h = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#/, '');
    const hit = list.find(t => slugOf(t) === h);
    return hit ? hit.id : list[0]?.id;
  };
  const [activeId, setActiveId] = useState(fromHash);

  // Deep-linking: reflect the tab in the hash, and follow back/forward.
  useEffect(() => {
    const t = list.find(x => x.id === activeId);
    if (!t) return;
    const h = `#${slugOf(t)}`;
    if (window.location.hash !== h) window.history.replaceState(null, '', h);
  }, [activeId]);
  useEffect(() => {
    const onHash = () => setActiveId(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [tabs]);

  const active = list.find(t => t.id === activeId) || list[0];

  // The sequence payload carries its own title/subtitle; a tab that sets them
  // directly supplies the default. Memoized so the player's layout pass (and its
  // step/zoom state) survive re-renders of the shell.
  const seqPayload = useMemo(
    () => (active?.kind === 'sequence' ? { title: active.title, subtitle: active.subtitle, ...(active.sequence || {}) } : null),
    [active],
  );

  return (
    <div className="ld-tabs-shell">
      <nav className="ld-tabs-rail">
        {list.map(t => (
          <button key={t.id} className={`ld-tab${t.id === active?.id ? ' active' : ''}`}
            onClick={() => setActiveId(t.id)} title={tr(t.label, lang)}>
            {t.icon && t.icon !== 'none'
              ? <McpIcon src={t.icon} size={18} alt="" />
              : <span className="ld-tab-glyph">{GLYPH[t.kind] || '•'}</span>}
            <span className="ld-tab-lbl">{tr(t.label, lang)}</span>
          </button>
        ))}
      </nav>
      <div className="ld-tabs-panel">
        {active?.kind === 'architecture' && <ArchSlot key={active.id} />}
        {active?.kind === 'sequence' && (
          <SequenceDiagram key={active.id} seq={seqPayload} lang={lang} active ui={ui} />
        )}
        {active?.kind === 'doc' && <DocPanel key={active.id} tab={active} lang={lang} />}
      </div>
    </div>
  );
}

export default TabShell;
