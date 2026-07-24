// ─── rasterize.js ───
// Turn a self-contained interactive diagram HTML (from generate_html_diagram)
// into publishable assets:
//   • PNG @2x     — the static architecture figure
//   • animated GIF — the live data-flow (dots travelling the edges), looping
//   • animated SVG — vector + STILL ANIMATED (the edge <animateMotion> SMIL is
//                    preserved). Sharp at any size, tiny, animates in browsers.
//                    NOTE: many blog CMSs (incl. the AWS Blog / WordPress) block
//                    SVG upload for security — SVG is for your own site/embed;
//                    use GIF for WordPress.
//
// WHY: the HTML renders with React Flow (interactive, JS-driven). Static targets
// (WordPress, PDFs, email) can't run it, so we screenshot it with headless
// Chromium (Playwright) and stitch flow frames into a GIF with ffmpeg — or, for
// SVG, serialize the live viewport (styles inlined, HTML as foreignObject, the
// SMIL flow-dots kept) into one self-contained animated .svg.
//
// No hard dependency on Playwright: it's resolved from the project OR the npx
// cache at call time, so the MCP install stays lean (Playwright is heavy). A
// full ffmpeg on PATH is required for GIF (the Playwright-bundled ffmpeg is a
// stripped video-only build that can't mux GIFs).
import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync, rmSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";

// Resolve Playwright's chromium from the project or the npx cache.
async function importChromium() {
  const pick = (m) => (m.chromium ? m : m.default);
  try { return pick(await import("playwright")); } catch { /* not a local dep */ }
  const npxRoot = join(homedir(), ".npm/_npx");
  if (existsSync(npxRoot)) {
    for (const d of readdirSync(npxRoot)) {
      const entry = join(npxRoot, d, "node_modules/playwright/index.js");
      if (existsSync(entry)) return pick(await import(entry));
    }
  }
  throw new Error("playwright not found — install it once: `npx playwright install chromium` (or add playwright as a dep).");
}

// Find a GIF-capable ffmpeg (reject Playwright's stripped video-only build).
function findFfmpeg() {
  for (const c of ["ffmpeg", "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"]) {
    try {
      const out = execFileSync(c, ["-version"], { stdio: ["ignore", "pipe", "ignore"] }).toString();
      if (!/playwright-build/.test(out)) return c;
    } catch { /* not here */ }
  }
  return null;
}

// Force every flow-dot animation to a uniform period so a captured loop of
// `period` seconds repeats seamlessly. Runs in the page before capture; also
// re-applies to any late-mounted edges. The core already honors data.flowPeriod
// at build, but injecting here also covers HTML built without it.
const UNIFORM_FLOW_SCRIPT = (period) => `
  (function () {
    function apply() {
      document.querySelectorAll('animateMotion').forEach(function (m) {
        m.setAttribute('dur', '${period}s');
        // restart so all dots share phase → clean loop
        if (m.beginElement) { try { m.setAttribute('begin', '0s'); } catch (e) {} }
      });
    }
    apply();
    new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
  })();
`;

// Wait for the React Flow canvas to be present and settled.
async function waitForDiagram(page, settleMs) {
  await page.waitForSelector(".react-flow__renderer", { timeout: 20000 });
  await page.waitForTimeout(settleMs); // fit-view + layout + a couple of paints
}

// Extract a self-contained ANIMATED SVG from the live diagram page.
// Runs in the browser: measure the real content bounds (so nothing is cropped),
// clone the React Flow viewport, inline every element's computed style (Tailwind
// classes don't exist inside an <svg>), serialize as well-formed XHTML (auto-
// closes <img>/<br> — raw outerHTML is not valid XML), and wrap it in a
// <foreignObject>. The edges' <animateMotion> SMIL rides along, so the flow dots
// keep moving. Returns the SVG string.
async function extractAnimatedSvg(page, { pad = 40 } = {}) {
  return page.evaluate((pad) => {
    const rf = document.querySelector(".react-flow");
    const vp = document.querySelector(".react-flow__viewport");
    if (!rf || !vp) throw new Error("react-flow viewport not found");

    // Real content bounds = union of every node's on-screen rect, in the
    // viewport's UNtransformed coordinate space. We read the current CSS
    // transform (translate+scale React Flow applies) and invert it.
    const m = new DOMMatrixReadOnly(getComputedStyle(vp).transform);
    const nodes = Array.from(document.querySelectorAll(".react-flow__node"));
    const rfBox = rf.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const r = n.getBoundingClientRect();
      // screen → viewport-local: subtract rf origin, then invert transform
      const pts = [[r.left, r.top], [r.right, r.bottom]].map(([x, y]) => {
        const lx = x - rfBox.left, ly = y - rfBox.top;
        return { x: (lx - m.e) / m.a, y: (ly - m.f) / m.d };
      });
      minX = Math.min(minX, pts[0].x); minY = Math.min(minY, pts[0].y);
      maxX = Math.max(maxX, pts[1].x); maxY = Math.max(maxY, pts[1].y);
    }
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = rfBox.width; maxY = rfBox.height; }
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const W = Math.round(maxX - minX), H = Math.round(maxY - minY);

    // Clone viewport, drop its live transform (we frame via viewBox instead).
    const clone = vp.cloneNode(true);
    clone.style.transform = "";
    // Inline the FULL computed style of every element (walking original+clone in
    // lockstep). A "diff against defaults" trim was tried and broke fidelity
    // (CSS inheritance / context-dependent props), so we keep the complete dump
    // — the file is larger but renders identically to the live diagram.
    const origAll = vp.querySelectorAll("*"), cloneAll = clone.querySelectorAll("*");
    for (let i = 0; i < origAll.length; i++) {
      const cs = getComputedStyle(origAll[i]);
      let s = "";
      for (const prop of cs) s += `${prop}:${cs.getPropertyValue(prop)};`;
      cloneAll[i].setAttribute("style", s);
    }
    const xhtml = new XMLSerializer().serializeToString(clone);
    const bg = getComputedStyle(document.body).backgroundColor || "#ffffff";
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${minX} ${minY} ${W} ${H}">`
      + `<rect x="${minX}" y="${minY}" width="${W}" height="${H}" fill="${bg}"/>`
      + `<foreignObject x="${minX}" y="${minY}" width="${W}" height="${H}">${xhtml}</foreignObject>`
      + `</svg>`;
  }, pad);
}

// Build a GIF from a directory of frame-###.png at a given fps.
function assembleGif(ffmpeg, tmp, gifPath, fps, width) {
  const filter = `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;
  execFileSync(ffmpeg, ["-y", "-framerate", String(fps), "-i", join(tmp, "frame-%03d.png"), "-vf", filter, "-loop", "0", gifPath], { stdio: "ignore" });
}

/**
 * Rasterize a diagram HTML file.
 * @param {object} o
 * @param {string} o.htmlPath   absolute path to the interactive .html
 * @param {string} [o.pngPath]  if set, write a PNG here
 * @param {string} [o.gifPath]  if set, write an animated GIF here
 * @param {string} [o.svgPath]  if set, write a self-contained ANIMATED SVG here
 *                              (vector + preserved flow-dot SMIL; not for CMSs
 *                              that block SVG upload — use for your own site)
 * @param {'flow'|'walkthrough'} [o.mode='flow']
 *        flow        — one looping segment of the animated data flow.
 *        walkthrough — one animated segment PER beat (steps), concatenated into
 *                      a mini-tour that loops back to the first beat. Requires
 *                      the HTML to have `steps` (window.__diagramGoToStep).
 * @param {'light'|'dark'} [o.theme='light']
 * @param {number} [o.width=1200] @param {number} [o.height=675]
 * @param {number} [o.scale=2]    device scale (PNG @Nx)
 * @param {number} [o.period=4]   flow mode: loop length / uniform flow period (s)
 * @param {number} [o.frames=24]  flow mode: frames across one period
 * @param {number} [o.beatDuration=2.5]  walkthrough: seconds held on each beat
 * @param {number} [o.beatFrames=15]     walkthrough: frames captured per beat
 * @param {number} [o.settleMs=1500]
 * @returns {Promise<{png?:string, gif?:string, svg?:string, mode:string, beats?:number, warnings:string[]}>}
 */
export async function rasterizeDiagram(o) {
  const {
    htmlPath, pngPath, gifPath, svgPath, mode = "flow", theme = "light",
    width = 1200, height = 675, scale = 2,
    period = 4, frames = 24, beatDuration = 2.5, beatFrames = 15, settleMs = 1500,
  } = o;
  const warnings = [];
  if (!existsSync(htmlPath)) throw new Error(`html not found: ${htmlPath}`);
  if (!pngPath && !gifPath && !svgPath) throw new Error("nothing to do: pass pngPath, gifPath and/or svgPath");

  let ffmpeg = null;
  if (gifPath) {
    ffmpeg = findFfmpeg();
    if (!ffmpeg) throw new Error("a full ffmpeg is required for GIF output (e.g. `brew install ffmpeg`). The Playwright-bundled ffmpeg is video-only.");
  }

  const { chromium } = await importChromium();
  const browser = await chromium.launch();
  const tmp = mkdtempSync(join(tmpdir(), "diagram-shot-"));
  try {
    const ctx = await browser.newContext({ deviceScaleFactor: scale, viewport: { width: width + 40, height: height + 40 } });
    const page = await ctx.newPage();
    await page.emulateMedia({ colorScheme: theme === "dark" ? "dark" : "light" });
    await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
    if (theme === "dark") await page.evaluate(() => document.documentElement.classList.add("dark"));
    await waitForDiagram(page, settleMs);

    const canvas = await page.$(".react-flow");
    const out = { warnings, mode };

    // PNG — static; freeze motion so the dot positions don't blur the figure.
    if (pngPath) {
      await page.addStyleTag({ content: "* { animation-play-state: paused !important; }" });
      await canvas.screenshot({ path: pngPath });
      await page.evaluate(() => {
        for (const s of document.querySelectorAll("style")) {
          if (s.textContent && s.textContent.includes("animation-play-state: paused")) s.remove();
        }
      });
      out.png = pngPath;
    }

    // Uniform flow period so a captured GIF segment — and the SVG's own SMIL
    // loop — repeat cleanly.
    if (gifPath || svgPath) {
      await page.addScriptTag({ content: UNIFORM_FLOW_SCRIPT(period) });
      await page.waitForTimeout(150);
    }

    // Animated SVG — self-contained vector with the flow-dot SMIL preserved.
    if (svgPath) {
      const svg = await extractAnimatedSvg(page);
      writeFileSync(svgPath, svg, "utf-8");
      out.svg = svgPath;
    }

    if (!gifPath) { await browser.close(); return out; }

    if (mode === "walkthrough") {
      // One animated segment per beat: jump to the beat, let the zoom/card
      // settle, capture beatFrames of flow, then next beat. All frames concat
      // into one GIF that ends on the last beat and loops back to the first.
      const beats = await page.evaluate(() => window.__diagramStepCount || 0);
      if (!beats) {
        warnings.push("mode=walkthrough but the diagram has no steps — falling back to a single flow segment. Pass steps to generate_html_diagram for a per-beat tour.");
      }
      const segments = beats || 1;
      const beatGap = (period * 1000) / beatFrames; // reuse flow period for intra-beat spacing
      let f = 0;
      for (let b = 0; b < segments; b++) {
        if (beats) {
          await page.evaluate((i) => window.__diagramGoToStep && window.__diagramGoToStep(i), b);
          await page.waitForTimeout(900); // fitView camera glide (~700ms) + settle
        }
        for (let k = 0; k < beatFrames; k++) {
          await canvas.screenshot({ path: join(tmp, `frame-${String(f++).padStart(3, "0")}.png`) });
          if (k < beatFrames - 1) await page.waitForTimeout(beatGap);
        }
      }
      const fps = +(beatFrames / beatDuration).toFixed(3);
      assembleGif(ffmpeg, tmp, gifPath, fps, width);
      out.gif = gifPath;
      out.beats = beats;
    } else {
      // flow: one looping segment of the animated data flow.
      const gap = (period * 1000) / frames;
      for (let i = 0; i < frames; i++) {
        await canvas.screenshot({ path: join(tmp, `frame-${String(i).padStart(3, "0")}.png`) });
        if (i < frames - 1) await page.waitForTimeout(gap);
      }
      assembleGif(ffmpeg, tmp, gifPath, +(frames / period).toFixed(3), width);
      out.gif = gifPath;
    }

    await browser.close();
    return out;
  } catch (e) {
    await browser.close();
    throw e;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
