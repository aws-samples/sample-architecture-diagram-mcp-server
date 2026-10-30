// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// CSS for the multi-tab chrome (tab rail + panels)
// and the doc panel. Kept as a plain string injected in a <style> tag — the same
// approach CHROME_STYLE uses — so it survives the single-file build without
// depending on Tailwind's content scan.
export const TAB_STYLE = `
  .ld-shell { height: 100%; display: flex; flex-direction: column; background: var(--bg); color: var(--txt); }
  /* Row: a left sidebar of views + the panel. The panels are full-bleed canvases
     with their own floating chrome, so the rail is a sibling with its own column
     (it never overlays them) and the chevron collapses it out of the way. */
  .ld-tabs-shell { flex: 1; display: flex; flex-direction: row; min-height: 0; position: relative; --ld-sbw: 236px; }

  /* ── sidebar (left, one view per line) ── */
  .ld-side {
    flex: 0 0 var(--ld-sbw); width: var(--ld-sbw);
    display: flex; flex-direction: column; min-height: 0;
    padding: 10px 11px 12px; background: var(--surface);
    border-right: 1px solid var(--border);
    transition: margin-left .22s ease;
  }
  .ld-tabs-shell.sb-collapsed .ld-side { margin-left: calc(-1 * var(--ld-sbw)); }
  .ld-side-brand {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 5px 7px 12px; margin-bottom: 4px; border-bottom: 1px solid var(--border);
  }
  .ld-side-logo {
    flex: 0 0 auto; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
    border-radius: 9px; background: rgba(255,153,0,.13); border: 1px solid var(--border);
    color: #FF9900; font-size: 16px; line-height: 1;
  }
  .ld-side-tt { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  /* overflow-wrap, not an ellipsis: a view or document name is prose and must be
     readable in full — breaking to the next line beats hiding half of it. */
  .ld-side-title { font-size: 13.5px; font-weight: 800; letter-spacing: -.2px; line-height: 1.3; overflow-wrap: anywhere; }
  .ld-side-sub { font-size: 10.5px; font-weight: 500; color: var(--txt-muted); line-height: 1.35; overflow-wrap: anywhere; }
  .ld-side-sec {
    padding: 12px 8px 5px; font-size: 10px; font-weight: 800; letter-spacing: .08em;
    text-transform: uppercase; color: var(--txt-muted);
  }
  .ld-side-list { display: flex; flex-direction: column; gap: 2px; overflow-y: auto; min-height: 0; }
  .ld-tab {
    position: relative; display: flex; align-items: flex-start; gap: 10px; width: 100%;
    padding: 9px 11px; border: 1px solid transparent; border-radius: 9px; background: transparent;
    color: var(--txt-muted); font: inherit; font-size: 13px; font-weight: 600; text-align: left;
    cursor: pointer; transition: background .15s, color .15s;
  }
  .ld-tab:hover { background: var(--chip-bg); color: var(--txt); }
  .ld-tab.active { background: var(--chip-bg); color: var(--txt); }
  .ld-tab.active::before {
    content: ""; position: absolute; left: -11px; top: 7px; bottom: 7px;
    width: 2.5px; border-radius: 2px; background: #FF9900;
  }
  .ld-tab-glyph { flex: 0 0 17px; font-size: 14px; line-height: 1.45; text-align: center; color: #FF9900; }
  .ld-tab img { flex: 0 0 auto; margin-top: 1px; }
  .ld-tab-lbl { flex: 1; min-width: 0; line-height: 1.35; overflow-wrap: anywhere; }

  /* collapse chevron, parked on the sidebar's edge */
  .ld-side-toggle {
    position: absolute; top: 12px; left: calc(var(--ld-sbw) - 14px); z-index: 20;
    width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
    padding: 0; border: 1px solid var(--border); border-radius: 8px;
    background: var(--card-solid, var(--surface)); color: var(--txt-muted);
    cursor: pointer; box-shadow: 0 1px 5px rgba(0,0,0,.18);
    transition: left .22s ease, background .15s, color .15s;
  }
  .ld-side-toggle:hover { background: var(--chip-bg); color: var(--txt); }
  .ld-side-toggle svg { width: 15px; height: 15px; transition: transform .22s ease; }
  .ld-tabs-shell.sb-collapsed .ld-side-toggle { left: 11px; }
  .ld-tabs-shell.sb-collapsed .ld-side-toggle svg { transform: rotate(180deg); }

  .ld-tabs-panel { flex: 1; min-height: 0; min-width: 0; position: relative; overflow: hidden; display: flex; }
  .ld-tabs-panel > * { flex: 1; min-width: 0; }

  /* Narrow viewport: the sidebar folds back into a horizontal strip of pills. */
  @media (max-width: 900px) {
    .ld-tabs-shell { flex-direction: column; }
    .ld-tabs-shell.sb-collapsed .ld-side { margin-left: 0; }
    .ld-side {
      flex: 0 0 auto; width: auto; padding: 6px 10px;
      border-right: none; border-bottom: 1px solid var(--border);
    }
    .ld-side-brand, .ld-side-sec, .ld-side-toggle { display: none; }
    .ld-side-list { flex-direction: row; gap: 3px; overflow-x: auto; scrollbar-width: none; }
    .ld-side-list::-webkit-scrollbar { display: none; }
    .ld-tab { width: auto; flex: 0 0 auto; align-items: center; padding: 7px 12px; font-size: 12.5px; }
    .ld-tab.active { border-color: var(--border); box-shadow: inset 0 -2.5px 0 #FF9900; }
    .ld-tab.active::before { display: none; }
    .ld-tab-lbl { white-space: nowrap; }
  }

  /* animated UML sequence panel: styled by the core's <SequencePlayer> */

  /* ── doc panel ──
     A doc tab is usually an architecture-decision register, and the old layout
     rendered it as bare full-bleed text: no measure, no separation between
     decisions, and a tiny orange all-caps kicker where the decision's NAME
     should be. It now reads as a document: a centred column, a masthead, and one
     numbered card per section (a responsive grid, so a register of ten decisions
     scans instead of scrolling as a wall of paragraphs). */
  .ld-doc { overflow: auto; padding: 34px 30px 56px; }
  .ld-typed-flow { position: relative; min-height: 0; }
  .ld-doc-inner { max-width: 1080px; margin: 0 auto; }

  .ld-doc-head { padding-bottom: 20px; margin-bottom: 24px; border-bottom: 1px solid var(--border); }
  .ld-doc-head::before {
    content: ""; display: block; width: 44px; height: 4px; border-radius: 2px;
    background: #FF9900; margin-bottom: 15px;
  }
  .ld-doc-head h2 {
    margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -.4px; line-height: 1.22;
    overflow-wrap: anywhere;
  }
  .ld-doc-head p {
    margin: 9px 0 0; max-width: 70ch; font-size: 14px; line-height: 1.6; color: var(--txt-muted);
  }

  /* auto-FIT (not auto-fill): a single section stretches to the full measure
     instead of sitting in a third of the page next to two empty tracks. */
  .ld-doc-grid {
    display: grid; gap: 16px; align-items: start;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  }
  .ld-doc-sec {
    margin: 0; padding: 18px 20px 17px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,.05);
    transition: border-color .15s, box-shadow .15s, transform .15s;
  }
  .ld-doc-sec:hover { border-color: rgba(255,153,0,.45); box-shadow: 0 6px 20px rgba(0,0,0,.09); }
  /* A section carrying a code block needs the full width to stay readable. */
  @media (min-width: 1000px) { .ld-doc-sec.has-code { grid-column: 1 / -1; } }

  .ld-doc-sec-hd { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 9px; }
  .ld-doc-num {
    flex: 0 0 auto; min-width: 23px; height: 23px; padding: 0 6px; margin-top: 1px;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 7px; background: rgba(255,153,0,.14); border: 1px solid rgba(255,153,0,.28);
    color: #FF9900; font-size: 11.5px; font-weight: 800; font-variant-numeric: tabular-nums;
  }
  .ld-doc-sec h3 {
    flex: 1; min-width: 0; margin: 0; font-size: 15.5px; font-weight: 700;
    letter-spacing: -.1px; line-height: 1.32; color: var(--txt); overflow-wrap: anywhere;
  }
  .ld-doc-badge {
    flex: 0 0 auto; padding: 2px 8px; border-radius: 999px; background: var(--chip-bg);
    color: var(--txt-muted); font-size: 10px; font-weight: 800; letter-spacing: .05em;
    text-transform: uppercase; white-space: nowrap;
  }
  .ld-doc-sec p { margin: 0 0 9px; max-width: 74ch; font-size: 13.5px; line-height: 1.6; }
  .ld-doc-sec > :last-child { margin-bottom: 0; }
  .ld-doc-ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 7px; }
  .ld-doc-ul li { display: flex; gap: 9px; font-size: 13px; line-height: 1.55; }
  .ld-doc-ul li > i { width: 5px; height: 5px; border-radius: 50%; margin-top: 8px; flex: 0 0 5px; background: var(--dot-c, #FF9900); }
  .ld-doc-glyph { font-weight: 700; flex: 0 0 auto; }
  .ld-doc-sec code {
    padding: 1px 5px; border-radius: 5px; background: var(--chip-bg);
    font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 12px;
  }
  .ld-doc-code { margin: 12px 0 0; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
  .ld-doc-code-lbl {
    display: block; padding: 6px 11px; font-size: 10px; font-weight: 800; letter-spacing: .07em;
    text-transform: uppercase; color: var(--txt-muted); background: var(--chip-bg);
    border-bottom: 1px solid var(--border);
  }
  .ld-doc-code pre {
    margin: 0; padding: 11px 13px; max-height: 320px; overflow: auto; font-size: 12px; line-height: 1.55;
    font-family: 'SF Mono', Menlo, Consolas, monospace;
  }
  @media (max-width: 700px) { .ld-doc { padding: 24px 18px 44px; } .ld-doc-head h2 { font-size: 22px; } }
`;

export default TAB_STYLE;
