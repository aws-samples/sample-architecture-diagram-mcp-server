// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// CSS for the multi-tab chrome (tab rail + panels), the animated sequence view
// and the doc panel. Kept as a plain string injected in a <style> tag — the same
// approach CHROME_STYLE uses — so it survives the single-file build without
// depending on Tailwind's content scan.
export const TAB_STYLE = `
  .ld-shell { height: 100%; display: flex; flex-direction: column; background: var(--bg); color: var(--txt); }
  .ld-tabs-shell { flex: 1; display: flex; min-height: 0; }

  /* ── tab rail ── */
  .ld-tabs-rail {
    width: 196px; flex: 0 0 196px; display: flex; flex-direction: column; gap: 4px;
    padding: 16px 10px; background: var(--surface); border-right: 1px solid var(--border);
  }
  .ld-tab {
    display: flex; align-items: center; gap: 9px; width: 100%; padding: 9px 11px;
    border: 1px solid transparent; border-radius: 9px; background: transparent;
    color: var(--txt-muted); font: inherit; font-size: 13px; font-weight: 600;
    text-align: left; cursor: pointer; transition: background .15s, color .15s, border-color .15s;
  }
  .ld-tab:hover { background: var(--chip-bg); color: var(--txt); }
  .ld-tab.active { background: var(--chip-bg); color: var(--txt); border-color: var(--border); box-shadow: inset 3px 0 0 #FF9900; }
  .ld-tab-glyph { font-size: 15px; width: 18px; text-align: center; color: #FF9900; }
  .ld-tab-lbl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ld-tabs-panel { flex: 1; min-width: 0; position: relative; overflow: hidden; display: flex; }
  .ld-tabs-panel > * { flex: 1; min-width: 0; }
  @media (max-width: 720px) {
    .ld-tabs-shell { flex-direction: column; }
    .ld-tabs-rail { width: auto; flex: 0 0 auto; flex-direction: row; overflow-x: auto;
      border-right: none; border-bottom: 1px solid var(--border); padding: 8px; }
    .ld-tab { width: auto; }
  }

  /* ── animated sequence view ── */
  .ld-seq { display: flex; flex-direction: column; min-height: 0; height: 100%; padding: 14px 18px 10px; }
  .ld-seq-head h2 { margin: 0 0 2px; font-size: 16px; font-weight: 700; }
  .ld-seq-head p { margin: 0 0 8px; font-size: 12.5px; color: var(--txt-muted); }
  .ld-seq-bar { display: flex; align-items: center; gap: 7px; padding: 6px 0 10px; }
  .ld-seq-btn {
    width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid var(--border); border-radius: 8px; background: var(--surface);
    color: var(--txt); font-size: 12px; cursor: pointer; transition: background .15s, opacity .15s;
  }
  .ld-seq-btn.ld-seq-wide { width: auto; padding: 0 10px; font-weight: 600; font-size: 11.5px; }
  .ld-seq-btn:hover:not(:disabled) { background: var(--chip-bg); }
  .ld-seq-btn:disabled { opacity: .35; cursor: default; }
  .ld-seq-btn.on { border-color: #FF9900; color: #FF9900; }
  .ld-seq-play { background: #FF9900; border-color: #FF9900; color: #111; font-weight: 700; }
  .ld-seq-count { font-size: 11.5px; color: var(--txt-muted); font-variant-numeric: tabular-nums; min-width: 54px; text-align: center; }
  .ld-seq-progress { flex: 1; height: 4px; border-radius: 2px; background: var(--chip-bg); overflow: hidden; }
  .ld-seq-progress > i { display: block; height: 100%; background: #FF9900; transition: width .3s; }

  .ld-seq-scroll { flex: 1; min-height: 0; overflow: auto; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
  .ld-seq-heads {
    position: sticky; top: 0; z-index: 3; display: flex; padding: 10px 0 8px;
    background: var(--surface); border-bottom: 1px solid var(--border);
  }
  .ld-seq-head-cell { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 0 8px; }
  .ld-seq-head-box {
    display: flex; align-items: center; gap: 7px; max-width: 100%;
    padding: 7px 10px; border: 1px solid var(--border); border-radius: 9px;
    background: var(--node-bg); box-shadow: 0 1px 2px rgba(0,0,0,.06);
    transition: border-color .2s, box-shadow .2s;
  }
  .ld-seq-head-cell.on .ld-seq-head-box { box-shadow: 0 0 0 3px rgba(255,153,0,.18); }
  .ld-seq-head-txt { display: flex; flex-direction: column; font-size: 11.5px; font-weight: 600; line-height: 1.25; }
  .ld-seq-glyph { color: #FF9900; font-size: 14px; }
  .ld-seq-pill {
    font-size: 9.5px; text-transform: uppercase; letter-spacing: .05em; font-weight: 700;
    color: var(--txt-muted); background: var(--chip-bg); border-radius: 6px; padding: 1px 6px;
  }
  .ld-seq-svg { display: block; }
  .ld-seq-svg text { font-family: inherit; }
  .ld-seq-msg { font-size: 11.5px; }
  .ld-seq-msg.on { font-weight: 700; }
  .ld-seq-note { font-size: 11.5px; font-weight: 600; }
  .ld-seq-frag { font-size: 10.5px; font-weight: 700; text-transform: lowercase; }
  .ld-seq-badge { font-size: 9px; font-weight: 800; letter-spacing: .06em; }

  .ld-seq-caption {
    display: flex; align-items: baseline; gap: 8px; padding: 9px 2px 4px; font-size: 12.5px; min-height: 34px;
  }
  .ld-seq-cap-dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 8px; transform: translateY(-1px); }
  .ld-seq-cap-main { color: var(--txt); }
  .ld-seq-cap-note { color: var(--txt-muted); font-size: 12px; }
  .ld-seq-legend { display: flex; gap: 16px; flex-wrap: wrap; font-size: 11.5px; color: var(--txt-muted); padding: 0 2px 6px; }
  .ld-seq-legend span { display: inline-flex; align-items: center; gap: 6px; }
  .ld-seq-legend i { width: 9px; height: 9px; border-radius: 50%; }

  /* ── doc panel ── */
  .ld-doc { overflow: auto; padding: 22px 26px 40px; }
  .ld-doc-head h2 { margin: 0 0 3px; font-size: 18px; font-weight: 700; }
  .ld-doc-head p { margin: 0 0 14px; font-size: 13px; color: var(--txt-muted); }
  .ld-doc-sec { max-width: 860px; margin: 0 0 18px; }
  .ld-doc-sec h3 {
    margin: 0 0 6px; font-size: 12px; font-weight: 800; letter-spacing: .06em;
    text-transform: uppercase; color: #FF9900;
  }
  .ld-doc-sec p { margin: 0 0 8px; font-size: 13.5px; line-height: 1.55; }
  .ld-doc-ul { margin: 0 0 8px; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 5px; }
  .ld-doc-ul li { display: flex; gap: 8px; font-size: 13px; line-height: 1.5; }
  .ld-doc-ul li > i { width: 6px; height: 6px; border-radius: 50%; margin-top: 7px; flex: 0 0 6px; background: var(--dot-c, #FF9900); }
  .ld-doc-glyph { font-weight: 700; flex: 0 0 auto; }
  .ld-doc-code { margin: 6px 0 10px; border: 1px solid var(--border); border-radius: 9px; overflow: hidden; }
  .ld-doc-code-lbl {
    display: block; padding: 5px 10px; font-size: 10px; font-weight: 800; letter-spacing: .07em;
    text-transform: uppercase; color: var(--txt-muted); background: var(--chip-bg);
  }
  .ld-doc-code pre {
    margin: 0; padding: 10px 12px; overflow: auto; font-size: 12px; line-height: 1.5;
    font-family: 'SF Mono', Menlo, Consolas, monospace;
  }
`;

export default TAB_STYLE;
