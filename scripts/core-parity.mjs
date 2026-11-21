#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Local dev utility (not shipped): visual + structural parity of the generated
// pages across a refactor of the core. It renders a fixed set of documents
// through the real MCP server (stdio) — architecture with steps and tabs, a
// UML sequence, one typed tab per kind, the three flow players — then drives
// each page in headless Chromium (Playwright, from the project or the npx
// cache): at load and after each of the first walkthrough beats, in light and
// dark. Per state it stores a screenshot and the DOM; per page the HTML.
//
//   node scripts/core-parity.mjs capture <dir>                    render + capture into <dir>
//   node scripts/core-parity.mjs compare <new> <base> [<base2> …]  diff (exit 1 on any diff)
//
// Every capture writes its inputs to <dir>/inputs.json; INPUTS=<that file> makes
// a later capture render exactly the same documents.
// Typical use: capture the baseline TWICE (…/before, …/before2 with INPUTS) into
// ~/.cache/diagram-core-parity (outside the repo), refactor, rebuild dist/,
// capture …/after with INPUTS=…/before/inputs.json, then compare after before before2.
// HTML and DOM must equal the first baseline. A screenshot passes when it is
// pixel-identical to ANY baseline: Chromium's raster of the animated dashed
// edges flaps between a couple of sub-pixel phases from one load to the next
// (two captures of the same build differ on a few screenshots by tens of px),
// so the baselines sample that noise and a real change still fails.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BEATS = 3;

async function importChromium() {
  const pick = (m) => m.chromium || m.default?.chromium;
  const name = "playwright";
  try { return pick(await import(name)); } catch { /* not a local dep */ }
  const npx = join(homedir(), ".npm/_npx");
  for (const d of existsSync(npx) ? readdirSync(npx) : []) {
    const entry = join(npx, d, "node_modules/playwright/index.js");
    if (existsSync(entry)) return pick(await import(pathToFileURL(entry).href));
  }
  throw new Error("playwright not found (npx playwright install chromium)");
}

// ── inputs ──────────────────────────────────────────────────────────────────
async function buildInputs() {
  const rich = JSON.parse(readFileSync(join(ROOT, "test/golden/specs/rich-document.json"), "utf-8"));
  const typed = await import(pathToFileURL(join(ROOT, "packages/diagram-core/dist/typed.js")).href);
  const arch = (name) => JSON.parse(readFileSync(join(ROOT, "examples", name), "utf-8"));
  const base = arch("serverless-api.json");
  delete base.outputPath;
  const inputs = [];
  // Architecture with a walkthrough and tabs (architecture + sequence + doc).
  inputs.push({ name: "rich-document", tool: "generate_html_diagram", args: rich, beats: true });
  for (const f of ["serverless-api.json", "multi-vpc-hybrid.json"]) {
    const spec = arch(f); delete spec.outputPath;
    inputs.push({ name: `example-${basename(f, ".json")}`, tool: "generate_html_diagram", args: spec });
  }
  // The same architecture with three beats (walkthrough without tabs).
  const ids = base.services.map((s) => s.id);
  inputs.push({ name: "architecture-steps", tool: "generate_html_diagram", beats: true, args: { ...base, stepZoom: true,
    steps: [{ title: "One", nodes: ids.slice(0, 2) }, { title: "Two", nodes: ids.slice(1, 3) }, { title: "Three", nodes: ids.slice(2, 4) }] } });
  // UML sequence (standalone player).
  inputs.push({ name: "sequence", tool: "generate_sequence_diagram", beats: true, args: { title: "Orders", ...rich.tabs.find((t) => t.kind === "sequence").sequence } });
  // One typed tab per kind (deep-linked with #t).
  for (const kind of typed.TYPED_KINDS) {
    inputs.push({ name: `typed-${kind}`, tool: "generate_html_diagram", hash: "t",
      args: { ...base, tabs: [{ id: "a", kind: "architecture" }, { id: "t", kind: "typed", diagram: typed.DIAGRAM_TYPES[kind].empty() }] } });
  }
  // Flow players.
  const wf = typed.DIAGRAM_TYPES.workflow.empty();
  inputs.push({ name: "flow-workflow", tool: "generate_workflow_diagram", beats: true, args: { title: wf.title, nodes: wf.nodes, edges: wf.edges, steps: wf.steps } });
  inputs.push({ name: "flow-dataflow", tool: "generate_dataflow_diagram", beats: true, args: {
    title: "Orders data flow",
    nodes: [{ id: "u", label: "Customer", kind: "external" }, { id: "p", label: "Validate order", kind: "process" }, { id: "s", label: "Orders", kind: "datastore", service: "Amazon DynamoDB" }, { id: "r", label: "Report", kind: "process" }],
    edges: [{ id: "e1", from: "u", to: "p", label: "order.json" }, { id: "e2", from: "p", to: "s", label: "item" }, { id: "e3", from: "s", to: "r", label: "stream" }],
    steps: [{ title: "In", nodes: ["u", "p"], edges: ["e1"] }, { title: "Store", nodes: ["s"], edges: ["e2"] }, { title: "Report", nodes: ["r"], edges: ["e3"] }],
  } });
  inputs.push({ name: "flow-lifecycle", tool: "generate_lifecycle_diagram", beats: true, args: {
    title: "Ticket lifecycle",
    nodes: [{ id: "i", label: "", kind: "initial" }, { id: "o", label: "Open", kind: "state" }, { id: "c", label: "Valid?", kind: "choice" }, { id: "d", label: "Done", kind: "state" }, { id: "f", label: "", kind: "final" }],
    edges: [{ id: "e1", from: "i", to: "o" }, { id: "e2", from: "o", to: "c", label: "submit" }, { id: "e3", from: "c", to: "d", label: "[yes]" }, { id: "e4", from: "c", to: "o", label: "[no]", kind: "back" }, { id: "e5", from: "d", to: "f" }],
    steps: [{ title: "Open", nodes: ["o"], edges: ["e1"] }, { title: "Check", nodes: ["c"], edges: ["e2"] }, { title: "Done", nodes: ["d", "f"], edges: ["e3", "e5"] }],
  } });
  return inputs;
}

async function renderAll(inputs, outDir) {
  const { Client } = await import(pathToFileURL(join(ROOT, "node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js")).href);
  const { StdioClientTransport } = await import(pathToFileURL(join(ROOT, "node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js")).href);
  const client = new Client({ name: "core-parity", version: "1" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(ROOT, "mcp-server.js")], cwd: ROOT, stderr: "ignore" }));
  try {
    for (const inp of inputs) {
      const outputPath = join(outDir, "html", `${inp.name}.html`);
      const res = await client.callTool({ name: inp.tool, arguments: { ...inp.args, outputPath, writeSpec: inp.tool === "generate_html_diagram" ? false : undefined } });
      if (res.isError || !existsSync(outputPath)) throw new Error(`${inp.name}: ${res.content.map((c) => c.text).join("\n")}`);
    }
  } finally { await client.close(); }
}

// ── capture ─────────────────────────────────────────────────────────────────
// Freeze everything that moves so two captures of the same page are identical:
// CSS animations/transitions (Playwright's animations:"disabled"), SVG SMIL
// (paused at t=0) and the caret.
const FREEZE = () => {
  for (const s of document.querySelectorAll("svg")) { try { s.pauseAnimations(); s.setCurrentTime(0); } catch { /* not an SVGSVGElement */ } }
};
const DOM = () => {
  const c = document.documentElement.cloneNode(true);
  for (const s of c.querySelectorAll("script")) s.textContent = "";
  return c.outerHTML;
};

async function capture(dir) {
  mkdirSync(join(dir, "html"), { recursive: true });
  mkdirSync(join(dir, "png"), { recursive: true });
  mkdirSync(join(dir, "dom"), { recursive: true });
  const inputs = process.env.INPUTS ? JSON.parse(readFileSync(process.env.INPUTS, "utf-8")) : await buildInputs();
  writeFileSync(join(dir, "inputs.json"), JSON.stringify(inputs, null, 2));
  await renderAll(inputs, dir);
  const chromium = await importChromium();
  const browser = await chromium.launch();
  try {
    for (const inp of inputs) {
      for (const theme of ["light", "dark"]) {
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
        const page = await ctx.newPage();
        // A deep-linked tab opens after the theme is set in the first view (the
        // typed panels carry no theme button of their own).
        await page.goto(pathToFileURL(join(dir, "html", `${inp.name}.html`)).href);
        await page.waitForTimeout(1500);
        if (theme === "dark") {
          const btn = page.locator('button[title="Theme"], button[title="Tema"], button[aria-label*="theme" i], button[title*="theme" i], button[title*="tema" i]').first();
          if (await btn.count()) { await btn.click(); await page.mouse.move(0, 0); await page.waitForTimeout(600); }
        }
        if (inp.hash) { await page.evaluate((h) => { window.location.hash = h; }, inp.hash); await page.waitForTimeout(1200); }
        const shot = async (label) => {
          await page.evaluate(FREEZE);
          await page.waitForTimeout(100);
          await page.screenshot({ path: join(dir, "png", `${inp.name}.${theme}.${label}.png`), animations: "disabled", caret: "hide" });
          writeFileSync(join(dir, "dom", `${inp.name}.${theme}.${label}.html`), await page.evaluate(DOM));
        };
        await shot("load");
        if (inp.beats) {
          for (let i = 1; i <= BEATS; i++) {
            await page.keyboard.press("ArrowRight");
            await page.waitForTimeout(1300);
            await shot(`beat${i}`);
          }
        }
        await ctx.close();
      }
      process.stdout.write(".");
    }
  } finally { await browser.close(); }
  console.log(`\ncaptured ${inputs.length} documents into ${dir}`);
}

// ── compare ─────────────────────────────────────────────────────────────────
// The page HTML minus the text of its bundled scripts (the core's code moves
// between modules; the generated document must not otherwise change). JSON data
// islands (<script type="application/json"> or with an id) are compared in full.
const stripScripts = (html) => html.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/g, (m, a, body, b) => (/type="application\/json"|id="/.test(a) ? m : a + b));

async function pixelDiff(page, fa, fb) {
  const da = "data:image/png;base64," + readFileSync(fa).toString("base64");
  const db = "data:image/png;base64," + readFileSync(fb).toString("base64");
  return page.evaluate(async ([u, v]) => {
    const load = (s) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = s; });
    const [i, j] = await Promise.all([load(u), load(v)]);
    if (i.width !== j.width || i.height !== j.height) return -1;
    const px = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const p = px(i), q = px(j);
    let d = 0;
    for (let k = 0; k < p.length; k += 4) if (p[k] !== q[k] || p[k + 1] !== q[k + 1] || p[k + 2] !== q[k + 2] || p[k + 3] !== q[k + 3]) d++;
    return d;
  }, [da, db]);
}

async function compare(now, bases) {
  const [a] = bases;
  const files = (d) => readdirSync(join(a, d)).sort();
  const report = { html: [], htmlScriptOnly: 0, dom: [], png: [], missing: [] };
  for (const f of files("html")) {
    const pb = join(now, "html", f);
    if (!existsSync(pb)) { report.missing.push(`html/${f}`); continue; }
    const x = readFileSync(join(a, "html", f), "utf-8"), y = readFileSync(pb, "utf-8");
    if (x === y) continue;
    if (stripScripts(x) === stripScripts(y)) report.htmlScriptOnly++;
    else report.html.push(f);
  }
  for (const f of files("dom")) {
    const pb = join(now, "dom", f);
    if (!existsSync(pb)) { report.missing.push(`dom/${f}`); continue; }
    if (readFileSync(join(a, "dom", f), "utf-8") !== readFileSync(pb, "utf-8")) report.dom.push(f);
  }
  const chromium = await importChromium();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let viaSecond = 0;
  for (const f of files("png")) {
    const pn = join(now, "png", f);
    if (!existsSync(pn)) { report.missing.push(`png/${f}`); continue; }
    const buf = readFileSync(pn);
    let best = null;
    for (const [k, base] of bases.entries()) {
      const pb = join(base, "png", f);
      if (!existsSync(pb)) continue;
      const n = buf.equals(readFileSync(pb)) ? 0 : await pixelDiff(page, pb, pn);
      if (n === 0) { best = 0; if (k > 0) viaSecond++; break; }
      if (best === null || (n >= 0 && (best < 0 || n < best))) best = n;
    }
    if (best !== 0) report.png.push(`${f} (${best === null ? "no baseline" : best < 0 ? "size differs" : `${best} px`})`);
  }
  await browser.close();
  const total = { html: files("html").length, dom: files("dom").length, png: files("png").length };
  console.log(`HTML: ${total.html} files, ${report.html.length} differ outside script text (${report.htmlScriptOnly} differ only in script text)`);
  console.log(`DOM:  ${total.dom} states, ${report.dom.length} diffs`);
  console.log(`PNG:  ${total.png} screenshots, ${report.png.length} pixel diffs (${viaSecond} matched a later baseline)`);
  for (const k of ["missing", "html", "dom", "png"]) for (const x of report[k]) console.log(`  ${k}: ${x}`);
  return report.missing.length + report.html.length + report.dom.length + report.png.length === 0;
}

const [cmd, x, ...rest] = process.argv.slice(2);
if (cmd === "capture" && x) await capture(x);
else if (cmd === "compare" && x && rest.length) process.exit((await compare(x, rest)) ? 0 : 1);
else { console.error("usage: core-parity.mjs capture <dir> | compare <new> <base> [<base2> …]"); process.exit(2); }
