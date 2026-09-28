// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Optional header band above the canvas: what this diagram IS, in words.
//
// A diagram opened cold (an email attachment, a wiki link) gives the reader
// nodes and arrows but no framing — the title only lives in the small floating
// dock. `caption` puts a badge + headline + one paragraph of context at the top,
// so the file explains itself. Entirely optional: absent => nothing renders and
// the layout is byte-identical to before.
//
// Visual language follows the Tailwind page-header pattern (badge, tracking-tight
// display headline, measured prose column, right-aligned stat rail) expressed as
// inline styles + one <style> block, so it needs no stylesheet plumbing and
// survives the single-file build. In a tabbed document the SHELL renders it above
// the rail (see StandaloneApp), so the band always sits at the very top.
import React from "react";
import { tr } from "../i18n.js";

const ORANGE = "#FF9900";

/** Normalize the author shape into { eyebrow, title, text, meta[] } (or null). */
export function resolveCaption(caption, lang = "en") {
  if (!caption) return null;
  // String shorthand: the description. The diagram's own title stays in the dock.
  const raw = typeof caption === "string" || caption.en || caption.pt
    ? { text: caption }
    : caption;
  const eyebrow = tr(raw.eyebrow, lang) || "";
  const title = tr(raw.title, lang) || "";
  const text = tr(raw.text, lang) || "";
  const meta = (Array.isArray(raw.meta) ? raw.meta : [])
    .map(m => tr(m, lang)).filter(Boolean);
  if (!eyebrow && !title && !text && !meta.length) return null;
  return { eyebrow, title, text, meta };
}

// "Ambiente: produção" reads as a labelled fact, not a tag — so split it into a
// stat (tiny uppercase label over the value). Anything without a "Label: value"
// shape stays a single line, sized like the value.
function splitStat(s) {
  const m = /^\s*([^:]{2,22}):\s+(.+)$/.exec(s);
  return m ? { label: m[1], value: m[2] } : { label: null, value: s };
}

export function DiagramCaption({ caption, lang = "en", vars = {} }) {
  const c = resolveCaption(caption, lang);
  if (!c) return null;
  const txt = `var(${vars.txt || "--txt"}, inherit)`;
  const muted = `var(${vars.txtMuted || "--txt-muted"}, #64748b)`;
  const border = `var(${vars.border || "--border"}, rgba(0,0,0,.08))`;
  const surface = `var(${vars.surface || "--surface"}, #fff)`;
  return (
    <header className="ld-caption" style={{ borderBottom: `1px solid ${border}`, color: txt }}>
      <style>{CAPTION_CSS}</style>
      {/* Two hairlines doing the work of a heavy header bar: a warm 2px accent
          that fades out across the top, and the divider above the canvas. */}
      <span aria-hidden="true" className="ld-caption-accent" />
      {/* A soft orange bloom behind the badge — the only colour in the band, so
          the header reads as part of the diagram instead of a pasted-on title. */}
      <span aria-hidden="true" className="ld-caption-glow" />
      <div className="ld-caption-row">
        <div className="ld-caption-main">
          {c.eyebrow && (
            <span className="ld-caption-badge">
              <i aria-hidden="true" />
              {c.eyebrow}
            </span>
          )}
          {c.title && <h1 className="ld-caption-title">{c.title}</h1>}
          {c.text && <p className="ld-caption-text">{c.text}</p>}
        </div>
        {c.meta.length > 0 && (
          // Stat rail: right-aligned on a wide viewport, wrapping under the prose
          // on a narrow one. Divider rules instead of chips, so version/date/owner
          // scan as metadata rather than competing with the headline.
          <dl className="ld-caption-meta">
            {c.meta.map((m, i) => {
              const { label, value } = splitStat(m);
              return (
                <div key={i} className={`ld-caption-stat${label ? "" : " bare"}`}>
                  {label && <dt>{label}</dt>}
                  <dd>{value}</dd>
                </div>
              );
            })}
          </dl>
        )}
      </div>
    </header>
  );
}

// Scoped to .ld-caption, and every colour goes through the same '--*' vars the
// rest of the frame uses, so light/dark flips with the diagram.
const CAPTION_CSS = `
.ld-caption {
  position: relative; overflow: hidden; flex: 0 0 auto; min-width: 0;
  padding: 22px 30px 20px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface, #fff) 92%, transparent) 0%, transparent 100%),
    var(--bg, transparent);
}
.ld-caption-accent {
  position: absolute; inset: 0 0 auto 0; height: 2px; pointer-events: none;
  background: linear-gradient(90deg, ${ORANGE} 0%, rgba(255,153,0,.45) 26%, transparent 62%);
}
.ld-caption-glow {
  position: absolute; top: -70px; left: -40px; width: 320px; height: 190px;
  pointer-events: none; opacity: .5;
  background: radial-gradient(closest-side, rgba(255,153,0,.22), transparent 78%);
}
.ld-caption-row {
  position: relative; display: flex; align-items: flex-start;
  justify-content: space-between; gap: 28px 40px; flex-wrap: wrap;
}
.ld-caption-main { min-width: 0; flex: 1 1 420px; display: flex; flex-direction: column; align-items: flex-start; }
.ld-caption-badge {
  display: inline-flex; align-items: center; gap: 6px; margin-bottom: 10px;
  padding: 3px 10px 3px 8px; border-radius: 999px;
  border: 1px solid rgba(255,153,0,.38); background: rgba(255,153,0,.1);
  font-size: 10.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
  color: ${ORANGE}; line-height: 1.5; white-space: nowrap;
}
.ld-caption-badge i { width: 5px; height: 5px; border-radius: 50%; background: ${ORANGE}; box-shadow: 0 0 0 3px rgba(255,153,0,.18); }
/* Display headline: fluid so a narrow embed never wraps it into three lines. */
.ld-caption-title {
  margin: 0; font-size: clamp(19px, 1.35vw + 11px, 27px); font-weight: 700;
  letter-spacing: -.025em; line-height: 1.16; color: var(--txt, inherit);
  text-wrap: balance;
}
/* ~68ch: the readable measure. Full-bleed prose on a 34" monitor is what made
   the first cut look unfinished. Sits one notch under the headline in size but
   NOT in contrast — a fully muted paragraph at 13px read as fine print. */
.ld-caption-text {
  margin: 10px 0 0; max-width: 68ch; font-size: 14px; line-height: 1.6;
  color: var(--txt, inherit); opacity: .78; text-wrap: pretty;
}
/* Metadata card: a bordered panel, not four labels adrift in the corner. Grouping
   them gives the band two clear objects (what it is / which version it is)
   instead of eight competing text sizes. */
.ld-caption-meta {
  margin: 0; flex: 0 1 auto; display: flex; flex-wrap: wrap; align-items: stretch;
  gap: 0; padding: 9px 14px; border-radius: 12px;
  border: 1px solid var(--border, rgba(0,0,0,.08));
  background: var(--chip-bg, rgba(100,116,139,.07));
}
.ld-caption-stat { padding-left: 15px; margin-left: 15px; border-left: 1px solid var(--border, rgba(0,0,0,.08)); }
.ld-caption-stat:first-child { padding-left: 0; margin-left: 0; border-left: none; }
.ld-caption-stat dt {
  font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
  color: var(--txt, inherit); opacity: .48; line-height: 1.5;
}
/* The value is the thing worth reading: full-contrast text, tabular numerals so
   dates/versions line up column-wise. */
.ld-caption-stat dd {
  margin: 2px 0 0; font-size: 13px; font-weight: 650; line-height: 1.35;
  color: var(--txt, inherit); font-variant-numeric: tabular-nums; white-space: nowrap;
}
/* No label to split on ("GBR", "rev 4") — centre it in the cell so a mixed rail
   of stats and bare values doesn't look ragged. */
.ld-caption-stat.bare { display: flex; align-items: center; }
.ld-caption-stat.bare dd { margin: 0; }
@media (max-width: 860px) {
  .ld-caption { padding: 16px 18px 14px; }
  .ld-caption-row { gap: 14px; }
  .ld-caption-title { font-size: clamp(18px, 3.4vw, 22px); }
  .ld-caption-text { font-size: 13px; }
  /* Narrow: the card's own border would box in the whole column, so drop to a
     plain wrapping row under the prose. */
  .ld-caption-meta { padding: 0; border: none; background: none; gap: 8px 0; }
}
`;

export default DiagramCaption;
