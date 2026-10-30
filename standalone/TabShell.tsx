// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Multi-tab chrome for the generated HTML — the same sidebar-and-content shell
// the cost-calculator app uses (Tailwind/Catalyst style: a fixed left rail of
// views, a collapse toggle, the panel filling the rest), deep-linkable through
// the URL hash, so ONE self-contained file can carry the live architecture, its
// animated UML sequence, typed diagrams (gantt, ER, swimlane, workflow…) and
// prose sections instead of shipping several files.
//
// A LEFT rail rather than a top bar: view names are prose ("Fluxo de autorização
// do cidadão"), and a horizontal bar has no room for them — it truncates to an
// ellipsis. A column gives each entry a full line, which is also why a document
// can carry a dozen views without the rail turning into a scroll strip.
//
// Only the active panel is MOUNTED: the architecture canvas measures itself on
// mount (ELK layout + fitView), and a hidden container has zero size — so tab
// switching remounts it instead of leaving it laid out against a 0×0 box.
import { useEffect, useMemo, useState } from 'react';
import { tr } from '@aws-sample-live-diagram/core';
import { cardKit, FlowPlayer } from '@aws-sample-live-diagram/core/react';
import { TypedDiagramView } from '@aws-sample-live-diagram/core/typed-react';
import { resolveIcon } from '@/lib/icons';
import { McpIcon } from './McpIcon';
import { SequenceDiagram } from './SequenceDiagram';

type Any = any;

const slugOf = (t: Any) => String(t.slug || t.id);

// Built-in glyph per tab kind, used when the author passes no `icon`.
const GLYPH: Record<string, string> = { architecture: '◫', sequence: '⇄', doc: '☰', typed: '▦' };

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

// A doc tab reads as a document, not as a text dump: a masthead (accent rule +
// headline + lede) over one numbered card per section. The number is derived from
// the order — a decision register is referred to by number in review — and a
// section may carry an optional `badge` for its status ("Aprovada", "Trade-off").
// A typed diagram (the core's typed-react views). A workflow is a player — full
// bleed, with its own walkthrough controls; every other kind is a static SVG laid
// out like a document page under the tab's title.
function TypedPanel({ tab, lang }: Any) {
  const doc = tab.diagram;
  if (doc?.kind === 'workflow') {
    return <div className="ld-typed-flow"><FlowPlayer flow={doc} iconUrl={resolveIcon} controls /></div>;
  }
  return (
    <div className="ld-doc">
      <div className="ld-doc-inner">
        {(tab.title || tab.subtitle || doc?.title) && (
          <div className="ld-doc-head">
            <h2>{tr(tab.title, lang) || doc?.title}</h2>
            {(tab.subtitle || doc?.subtitle) && <p>{cardKit.mdInline(tr(tab.subtitle, lang) || doc?.subtitle)}</p>}
          </div>
        )}
        <TypedDiagramView doc={doc} iconUrl={resolveIcon} />
      </div>
    </div>
  );
}

function DocPanel({ tab, lang }: Any) {
  const sections: Any[] = tab.sections || [];
  return (
    <div className="ld-doc">
      <div className="ld-doc-inner">
        {(tab.title || tab.subtitle) && (
          <div className="ld-doc-head">
            {tab.title && <h2>{tr(tab.title, lang)}</h2>}
            {tab.subtitle && <p>{cardKit.mdInline(tr(tab.subtitle, lang))}</p>}
          </div>
        )}
        <div className="ld-doc-grid">
          {sections.map((s: Any, i: number) => (
            <section key={i} className={`ld-doc-sec${s.code ? ' has-code' : ''}`}>
              {(s.title || s.badge) && (
                <div className="ld-doc-sec-hd">
                  <span className="ld-doc-num">{i + 1}</span>
                  {s.title && <h3>{tr(s.title, lang)}</h3>}
                  {s.badge && <span className="ld-doc-badge">{tr(s.badge, lang)}</span>}
                </div>
              )}
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
      </div>
    </div>
  );
}

/**
 * @param tabs     normalized tab descriptors (lib/html-generator.js → resolveTabs)
 * @param ArchSlot render-prop for the live architecture canvas (kind:'architecture')
 * @param title/subtitle  document identity, shown as the sidebar brand
 */
export function TabShell({ tabs, lang, ArchSlot, ui, title, subtitle }: Any) {
  const list: Any[] = tabs || [];
  const fromHash = () => {
    const h = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#/, '');
    const hit = list.find(t => slugOf(t) === h);
    return hit ? hit.id : list[0]?.id;
  };
  const [activeId, setActiveId] = useState(fromHash);
  const [collapsed, setCollapsed] = useState(false);

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

  const t = (k: string, fb: string) => (ui ? (ui(k, lang) || fb) : fb);
  const brandTitle = tr(title, lang);
  const brandSub = tr(subtitle, lang);

  return (
    <div className={`ld-tabs-shell${collapsed ? ' sb-collapsed' : ''}`}>
      <nav className="ld-side" aria-label={t('views', 'Views')}>
        {brandTitle && (
          <div className="ld-side-brand">
            <span className="ld-side-logo" aria-hidden>◫</span>
            <span className="ld-side-tt">
              <span className="ld-side-title">{brandTitle}</span>
              {brandSub && <span className="ld-side-sub">{brandSub}</span>}
            </span>
          </div>
        )}
        <span className="ld-side-sec">{t('views', 'Views')}</span>
        <div className="ld-side-list">
          {list.map(tab => (
            <button key={tab.id} className={`ld-tab${tab.id === active?.id ? ' active' : ''}`}
              onClick={() => setActiveId(tab.id)}
              aria-current={tab.id === active?.id ? 'page' : undefined}>
              {tab.icon && tab.icon !== 'none'
                ? <McpIcon src={tab.icon} size={17} alt="" />
                : <span className="ld-tab-glyph">{GLYPH[tab.kind] || '•'}</span>}
              <span className="ld-tab-lbl">{tr(tab.label, lang)}</span>
            </button>
          ))}
        </div>
      </nav>
      {/* Chevron parked on the sidebar's edge (it rides along when the rail
          collapses), so a dense canvas can reclaim the full width. */}
      <button className="ld-side-toggle" onClick={() => setCollapsed(c => !c)}
        title={collapsed ? t('expand', 'Expand') : t('collapse', 'Collapse')}
        aria-label={collapsed ? t('expand', 'Expand') : t('collapse', 'Collapse')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <div className="ld-tabs-panel">
        {active?.kind === 'architecture' && <ArchSlot key={active.id} />}
        {active?.kind === 'sequence' && (
          <SequenceDiagram key={active.id} seq={seqPayload} lang={lang} active ui={ui} />
        )}
        {active?.kind === 'doc' && <DocPanel key={active.id} tab={active} lang={lang} />}
        {active?.kind === 'typed' && <TypedPanel key={active.id} tab={active} lang={lang} />}
      </div>
    </div>
  );
}

export default TabShell;
