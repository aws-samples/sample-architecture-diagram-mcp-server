// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// CSS for the multi-tab chrome (tab rail + panels), the animated sequence view
// and the doc panel. Kept as a plain string injected in a <style> tag — the same
// approach CHROME_STYLE uses — so it survives the single-file build without
// depending on Tailwind's content scan.
export const TAB_STYLE = `
  .ld-shell { height: 100%; display: flex; flex-direction: column; background: var(--bg); color: var(--txt); }
  /* Column, not row: the views below are full-bleed canvases with their own
     floating chrome (narration card at the left, dock at the bottom), so a
     vertical rail would fight them for the same edge. */
  .ld-tabs-shell { flex: 1; display: flex; flex-direction: column; min-height: 0; }

  /* ── tab bar (top, one row of pills) ── */
  .ld-tabs-rail {
    flex: 0 0 auto; display: flex; flex-direction: row; align-items: center; gap: 3px;
    padding: 6px 10px; background: var(--surface); border-bottom: 1px solid var(--border);
    overflow-x: auto; scrollbar-width: none;
  }
  .ld-tabs-rail::-webkit-scrollbar { display: none; }
  .ld-tab {
    display: inline-flex; align-items: center; gap: 7px; flex: 0 0 auto; padding: 7px 12px;
    border: 1px solid transparent; border-radius: 9px; background: transparent;
    color: var(--txt-muted); font: inherit; font-size: 12.5px; font-weight: 600;
    cursor: pointer; transition: background .15s, color .15s, border-color .15s;
  }
  .ld-tab:hover { background: var(--chip-bg); color: var(--txt); }
  .ld-tab.active { background: var(--chip-bg); color: var(--txt); border-color: var(--border); box-shadow: inset 0 -2.5px 0 #FF9900; }
  .ld-tab-glyph { font-size: 14px; width: 16px; text-align: center; color: #FF9900; }
  .ld-tab-lbl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ld-tabs-panel { flex: 1; min-height: 0; min-width: 0; position: relative; overflow: hidden; display: flex; }
  .ld-tabs-panel > * { flex: 1; min-width: 0; }
  @media (max-width: 560px) { .ld-tab-lbl { display: none; } }

  /* ── animated UML sequence panel ──
     Lifted from the published standalone player (lib/sequence-template.html) and
     scoped to .ld-seqp so the class names in SequenceDiagram.tsx stay identical
     to the original renderer's. Only the extra UML tokens are declared here; the
     base theme (--bg/--txt/--border/--card-bg/--dot) comes from .ld-frame. */
  .ld-frame.light .ld-seqp {
    --grid: rgba(0,0,0,.035); --pill-bg: rgba(255,255,255,.95);
    --navy: #232f3e; --orange: #ff9900; --msg: #2f4a63; --ret: #8a94a3;
    --accent: #ff9900; --info: #2f6fed; --success: #1a7f37; --warn: #b7791f;
    --danger: #d13212; --neutral: #5f6b7a;
  }
  .ld-frame.dark .ld-seqp {
    --grid: rgba(255,255,255,.04); --pill-bg: rgba(26,29,39,.95);
    --navy: #2b3a4d; --orange: #ff9900; --msg: #8fb2da; --ret: #6b7684;
    --accent: #ff9900; --info: #5b8def; --success: #3fb950; --warn: #d29922;
    --danger: #f85149; --neutral: #93a1b0;
  }

  .ld-seqp { position: relative; flex: 1; min-width: 0; min-height: 0; overflow: hidden; background: var(--bg); }
  .ld-seqp .sq-stage { position: absolute; inset: 0; overflow: hidden; cursor: grab; touch-action: none; }
  .ld-seqp .sq-stage.grabbing { cursor: grabbing; }
  .ld-seqp .sq-stage > svg { transform-origin: 0 0; display: block; }
  .ld-seqp svg text { font-family: inherit; }

  /* lifelines, headers, actors */
  .ld-seqp .lifeline { stroke: var(--txt-muted); stroke-width: 1.2; stroke-dasharray: 3 4; opacity: .5; transition: opacity .3s; }
  .ld-seqp .phead, .ld-seqp .actor { transition: opacity .3s; }
  .ld-seqp .phead rect { fill: var(--navy); stroke: var(--orange); stroke-width: 1.4; transition: fill .25s, stroke .25s; }
  .ld-seqp .phead text { fill: #fff; font-size: 11px; font-weight: 600; }
  .ld-seqp .phead .sub { fill: #cdd6e0; font-size: 9.5px; }
  .ld-seqp .phead .stereo { fill: #aab6c4; font-size: 9.5px; font-style: italic; }
  .ld-seqp .phead.hot rect { fill: var(--orange); }
  .ld-seqp .phead.iconhead rect { fill: #fff; stroke: var(--navy); }
  .ld-seqp .phead.iconhead text { fill: var(--navy); }
  .ld-seqp .phead.iconhead .sub, .ld-seqp .phead.iconhead .stereo { fill: #5f6b7a; }
  .ld-seqp .phead.iconhead.hot rect { fill: #fff3e0; stroke: var(--orange); }
  .ld-seqp .phead.searchhit rect { stroke: var(--info); stroke-width: 2.5px; }
  .ld-seqp .actor line, .ld-seqp .actor circle { stroke: var(--orange); stroke-width: 1.8; fill: none; }
  .ld-seqp .actor .alabel { fill: var(--txt); font-size: 11px; font-weight: 600; stroke: none; }
  .ld-seqp .actor.searchhit circle { stroke: var(--info); stroke-width: 2.5px; }

  /* activation bars + destruction */
  .ld-seqp .exec { transition: opacity .3s; }
  .ld-seqp .exec rect { fill: color-mix(in srgb, var(--info) 20%, var(--card-bg)); stroke: var(--navy); stroke-width: 1; transition: fill .25s, stroke .25s; }
  .ld-seqp .exec.hot rect { fill: color-mix(in srgb, var(--orange) 22%, var(--card-bg)); stroke: var(--orange); }
  .ld-seqp .destroy { transition: opacity .3s; }
  .ld-seqp .destroy line { stroke: var(--danger); stroke-width: 2.6; }
  .ld-seqp .bdot { fill: var(--msg); }

  /* events */
  .ld-seqp .evt { opacity: 0; transition: opacity .3s; }
  .ld-seqp .evt.shown { opacity: 1; }
  .ld-seqp .evt .line { stroke: var(--msg); stroke-width: 2; fill: none; }
  /* pathLength="1" on the <path> normalizes the dash geometry, so one dash of
     length 1 = the whole line and the offset animates the draw-on. */
  .ld-seqp .evt.msg .line { stroke-dasharray: 1; stroke-dashoffset: 1; }
  .ld-seqp .evt.msg.shown .line { stroke-dashoffset: 0; transition: stroke-dashoffset .55s ease; }
  .ld-seqp .evt.ret .line { stroke: var(--ret); stroke-dasharray: 7 5; }
  .ld-seqp .evt .lbl { font-size: 11px; fill: var(--txt); opacity: 0; }
  .ld-seqp .evt.shown .lbl { opacity: 1; transition: opacity .3s .2s; }
  .ld-seqp .evt.active .line { stroke: var(--active, #ff9900); stroke-width: 3; filter: drop-shadow(0 0 4px rgba(255,153,0,.6)); }
  .ld-seqp .evt.note rect { fill: #fff3e0; stroke: var(--orange); stroke-width: 1.2; }
  .ld-seqp .evt.note text { font-size: 11px; fill: #7a4e00; font-weight: 600; }

  /* combined fragments + participant groups */
  .ld-seqp .frame { transition: opacity .3s; }
  .ld-seqp .frame rect { fill: color-mix(in srgb, var(--msg) 6%, transparent); stroke: var(--txt-muted); stroke-dasharray: 4 3; }
  .ld-seqp .frame .flabel { fill: #fff; font-size: 10.5px; font-weight: 700; }
  .ld-seqp .frame .flabelbg { stroke: none; stroke-dasharray: none; }
  .ld-seqp .frame .elsediv { stroke: var(--txt-muted); stroke-dasharray: 4 3; }
  .ld-seqp .frame .elsetxt { fill: var(--txt-muted); font-size: 10.5px; font-style: italic; }
  .ld-seqp .grp rect { fill: color-mix(in srgb, var(--txt) 3%, transparent); stroke-width: 1.4; }
  .ld-seqp .grp .gtabbg { stroke: none; }
  .ld-seqp .grp .gtab { font-size: 11px; font-weight: 700; fill: #fff; }

  /* narration card */
  .ld-seqp .sq-card {
    position: absolute; top: 14px; left: 14px; width: 340px; max-height: calc(100% - 96px);
    overflow: auto; padding: 12px 14px 11px; border: 1px solid var(--border); border-radius: 13px;
    background: var(--card-bg); backdrop-filter: blur(9px); box-shadow: 0 8px 26px rgba(0,0,0,.14);
    font-size: 12.5px; z-index: 5;
  }
  .ld-seqp .sq-card .rail { display: flex; gap: 3px; margin-bottom: 9px; }
  .ld-seqp .sq-card .rail i { height: 5px; flex: 1; border-radius: 4px; background: var(--dot); transition: background .25s; }
  .ld-seqp .sq-card .rail i.on { background: var(--orange); }
  .ld-seqp .sq-card .cardhead { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 18px; }
  .ld-seqp .sq-card .counter { font-size: 11px; color: var(--txt-muted); font-variant-numeric: tabular-nums; }
  .ld-seqp .sq-card .badge {
    display: inline-block; padding: 1px 7px; border-radius: 6px;
    font-size: 9.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase;
  }
  .ld-seqp .b-gate { color: var(--warn); background: color-mix(in srgb, var(--warn) 15%, transparent); }
  .ld-seqp .b-keyless { color: var(--success); background: color-mix(in srgb, var(--success) 15%, transparent); }
  .ld-seqp .b-async, .ld-seqp .b-sync, .ld-seqp .b-phase { color: var(--info); background: color-mix(in srgb, var(--info) 15%, transparent); }
  .ld-seqp .b-fail { color: var(--danger); background: color-mix(in srgb, var(--danger) 15%, transparent); }
  .ld-seqp .sq-card .title { margin: 5px 0 6px; font-size: 13.5px; font-weight: 700; line-height: 1.35; }
  .ld-seqp .sq-card .parties { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-bottom: 7px; }
  .ld-seqp .pchip {
    display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: 7px;
    border: 1px solid var(--border); background: var(--pill-bg);
    font-size: 10.5px; font-weight: 600; color: var(--txt-muted); transition: border-color .2s, color .2s;
  }
  .ld-seqp .pchip.on { border-color: var(--orange); color: var(--txt); }
  .ld-seqp .pchip.bdotc { color: var(--msg); font-size: 9px; padding: 2px 6px; }
  .ld-seqp .pico { width: 13px; height: 13px; object-fit: contain; }
  .ld-seqp svg.pico { fill: none; stroke: currentColor; stroke-width: 1.4; }
  .ld-seqp .parr { color: var(--txt-muted); font-size: 11px; }
  .ld-seqp .sq-card .flow {
    margin-bottom: 6px; font-size: 10.5px; font-weight: 700; letter-spacing: .04em;
    text-transform: uppercase; color: var(--orange);
  }
  .ld-seqp .sq-card .desc { color: var(--txt); line-height: 1.5; }
  .ld-seqp .sq-card .desc code, .ld-seqp .sq-card .proof code {
    padding: 1px 4px; border-radius: 4px; background: var(--chip-bg);
    font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 11px;
  }
  .ld-seqp .sq-card .proof { margin-top: 7px; font-size: 11px; }
  .ld-seqp .sq-card .proof a { color: var(--info); text-decoration: none; }
  .ld-seqp .sq-card .proof a:hover { text-decoration: underline; }
  .ld-seqp .sq-card .codeblk { margin-top: 8px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .ld-seqp .sq-card .codeblk .hd {
    padding: 4px 8px; font-size: 9.5px; font-weight: 800; letter-spacing: .07em;
    text-transform: uppercase; color: var(--txt-muted); background: var(--chip-bg);
  }
  .ld-seqp .sq-card .codeblk pre {
    margin: 0; padding: 8px; max-height: 160px; overflow: auto;
    font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 10.5px; line-height: 1.45;
  }
  .ld-seqp .sq-card .legend {
    display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; padding-top: 9px;
    border-top: 1px solid var(--border); font-size: 10px; color: var(--txt-muted);
  }
  .ld-seqp .sq-card .legend span { display: inline-flex; align-items: center; gap: 4px; }

  /* pill toolbar */
  .ld-seqp .sq-pill {
    position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 5px; max-width: calc(100% - 28px);
    padding: 6px 9px; border: 1px solid var(--border); border-radius: 13px;
    background: var(--pill-bg); backdrop-filter: blur(9px); box-shadow: 0 6px 22px rgba(0,0,0,.16);
    overflow-x: auto; z-index: 6;
  }
  .ld-seqp .sq-pill .pilltitle { min-width: 0; padding: 0 6px 0 3px; }
  .ld-seqp .sq-pill .pilltitle .t { font-size: 12px; font-weight: 700; white-space: nowrap; }
  .ld-seqp .sq-pill .pilltitle .s { font-size: 10px; color: var(--txt-muted); white-space: nowrap; }
  .ld-seqp .sq-pill .sep { width: 1px; height: 18px; flex: 0 0 1px; background: var(--border); }
  .ld-seqp .pbtn {
    width: 28px; height: 28px; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid var(--border); border-radius: 8px; background: transparent; color: var(--txt);
    font: inherit; font-size: 10.5px; font-weight: 700; cursor: pointer;
    transition: background .15s, border-color .15s, color .15s, opacity .15s;
  }
  .ld-seqp .pbtn.wide { width: auto; padding: 0 9px; }
  .ld-seqp .pbtn svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; }
  .ld-seqp .pbtn:hover:not(:disabled) { background: var(--chip-bg); }
  .ld-seqp .pbtn:disabled { opacity: .34; cursor: default; }
  .ld-seqp .pbtn.on { border-color: var(--orange); color: var(--orange); }
  .ld-seqp .pbtn.play { background: var(--orange); border-color: var(--orange); color: #111; }
  .ld-seqp .pbtn.play.attention { animation: ld-seq-pulse 1.9s ease-in-out infinite; }
  @keyframes ld-seq-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,153,0,.5); } 50% { box-shadow: 0 0 0 7px rgba(255,153,0,0); } }
  .ld-seqp .spdwrap { display: inline-flex; align-items: center; gap: 6px; font-size: 10.5px; color: var(--txt-muted); }
  .ld-seqp .spdwrap input { width: 78px; accent-color: var(--orange); }
  .ld-seqp .sq-expand {
    position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%);
    width: 34px; height: 24px; border: 1px solid var(--border); border-radius: 9px;
    background: var(--pill-bg); color: var(--txt-muted); cursor: pointer; z-index: 6;
  }

  /* participant search */
  .ld-seqp .sq-search {
    position: absolute; top: 14px; right: 14px; display: none; align-items: center; gap: 6px;
    padding: 5px 9px; border: 1px solid var(--border); border-radius: 10px;
    background: var(--pill-bg); backdrop-filter: blur(9px); z-index: 6;
  }
  .ld-seqp .sq-search.on { display: flex; }
  .ld-seqp .sq-search input {
    width: 180px; border: none; outline: none; background: transparent;
    color: var(--txt); font: inherit; font-size: 12px;
  }
  .ld-seqp .sq-search .cnt { font-size: 10.5px; color: var(--txt-muted); font-variant-numeric: tabular-nums; min-width: 26px; }

  @media (max-width: 760px) {
    .ld-seqp .sq-card { width: auto; right: 14px; max-height: 40%; }
    .ld-seqp .sq-pill { bottom: 10px; }
  }

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
