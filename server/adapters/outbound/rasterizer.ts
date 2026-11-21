/// <reference lib="dom" />
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Rasterizer over headless Chromium (Playwright) + ffmpeg. Turns a
// self-contained interactive diagram HTML into publishable assets:
//   • PNG @2x      — the static architecture figure
//   • animated GIF — the live data-flow (dots travelling the edges), looping
//   • animated SVG — vector + STILL ANIMATED (the edge <animateMotion> SMIL is
//                    preserved). Many blog CMSs (incl. the AWS Blog / WordPress)
//                    block SVG upload — SVG is for your own site; GIF for WordPress.
//
// The HTML renders with React Flow (JS-driven); static targets can't run it, so
// it is screenshotted with headless Chromium and flow frames are stitched into
// a GIF with ffmpeg — or, for SVG, the live viewport is serialized (styles
// inlined, HTML as foreignObject, SMIL flow-dots kept).
//
// No hard dependency on Playwright: it is resolved from the project OR the npx
// cache at call time, so the install stays lean. A full ffmpeg on PATH is
// required for GIF (the Playwright-bundled ffmpeg is video-only).
import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync, rmSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import { pathToFileURL } from "node:url";
import type { RasterizeRequest, RasterizeResult, Rasterizer } from "#application/ports/index.ts";

// The slice of the Playwright API used here (Playwright is not a dependency).
export interface Page {
  emulateMedia(o: { colorScheme: "dark" | "light" }): Promise<void>;
  goto(url: string, o: { waitUntil: "load" }): Promise<unknown>;
  evaluate<R, A = undefined>(fn: (arg: A) => R, arg?: A): Promise<R>;
  waitForSelector(sel: string, o: { timeout: number }): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  $(sel: string): Promise<{ screenshot(o: { path: string }): Promise<unknown> } | null>;
  addStyleTag(o: { content: string }): Promise<unknown>;
  addScriptTag(o: { content: string }): Promise<unknown>;
}
export interface Browser {
  newContext(o: { deviceScaleFactor: number; viewport: { width: number; height: number } }): Promise<{ newPage(): Promise<Page> }>;
  close(): Promise<void>;
}
export interface Chromium { launch(): Promise<Browser> }

declare global {
  interface Window { __diagramStepCount?: number; __diagramGoToStep?: (i: number) => void }
}

/** Playwright's chromium from the project or the npx cache. */
export async function importChromium(): Promise<{ chromium: Chromium }> {
  const pick = (m: { chromium?: Chromium; default?: { chromium: Chromium } }) => (m.chromium ? { chromium: m.chromium } : (m.default as { chromium: Chromium }));
  const name = "playwright"; // not a dependency: keep the bundler away from it
  try { return pick(await import(name)); } catch { /* not a local dep */ }
  const npxRoot = join(homedir(), ".npm/_npx");
  if (existsSync(npxRoot)) {
    for (const d of readdirSync(npxRoot)) {
      const entry = join(npxRoot, d, "node_modules/playwright/index.js");
      if (existsSync(entry)) return pick(await import(pathToFileURL(entry).href));
    }
  }
  throw new Error("playwright not found — install it once: `npx playwright install chromium` (or add playwright as a dep).");
}

// Find a GIF-capable ffmpeg (reject Playwright's stripped video-only build).
function findFfmpeg(): string | null {
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
const UNIFORM_FLOW_SCRIPT = (period: number): string => `
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
async function waitForDiagram(page: Page, settleMs: number): Promise<void> {
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
async function extractAnimatedSvg(page: Page, { pad = 40 }: { pad?: number } = {}): Promise<string> {
  return page.evaluate((pad: number) => {
    const rf = document.querySelector(".react-flow");
    const vp = document.querySelector<HTMLElement>(".react-flow__viewport");
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
      const pts = [[r.left, r.top], [r.right, r.bottom]].map(([x, y]: number[]) => {
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
    const clone = vp.cloneNode(true) as HTMLElement;
    clone.style.transform = "";
    // Inline the FULL computed style of every element (walking original+clone in
    // lockstep). A "diff against defaults" trim was tried and broke fidelity
    // (CSS inheritance / context-dependent props), so we keep the complete dump
    // — the file is larger but renders identically to the live diagram.
    const origAll = vp.querySelectorAll("*"), cloneAll = clone.querySelectorAll("*");
    for (let i = 0; i < origAll.length; i++) {
      const cs = getComputedStyle(origAll[i]);
      let s = "";
      for (const prop of Array.from(cs)) s += `${prop}:${cs.getPropertyValue(prop)};`;
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
function assembleGif(ffmpeg: string, tmp: string, gifPath: string, fps: number, width: number): void {
  const filter = `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;
  execFileSync(ffmpeg, ["-y", "-framerate", String(fps), "-i", join(tmp, "frame-%03d.png"), "-vf", filter, "-loop", "0", gifPath], { stdio: "ignore" });
}


export class ChromiumRasterizer implements Rasterizer {
  private readonly settleMs: number;
  constructor({ settleMs = 1500 }: { settleMs?: number } = {}) { this.settleMs = settleMs; }

  async render(o: RasterizeRequest): Promise<RasterizeResult> {
    const { htmlPath, pngPath, gifPath, svgPath, mode, theme, width, height, scale, period, frames, beatDuration, beatFrames } = o;
    const warnings: string[] = [];
    if (!existsSync(htmlPath)) throw new Error(`html not found: ${htmlPath}`);
    if (!pngPath && !gifPath && !svgPath) throw new Error("nothing to do: pass pngPath, gifPath and/or svgPath");

    let ffmpeg: string | null = null;
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
      await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
      if (theme === "dark") await page.evaluate(() => document.documentElement.classList.add("dark"));
      await waitForDiagram(page, this.settleMs);

      const canvas = await page.$(".react-flow");
      if (!canvas) throw new Error("react-flow canvas not found");
      const out: { png?: string; gif?: string; svg?: string; mode: "flow" | "walkthrough"; beats?: number; warnings: string[] } = { warnings, mode };

      // PNG — static; freeze motion so the dot positions don't blur the figure.
      if (pngPath) {
        await page.addStyleTag({ content: "* { animation-play-state: paused !important; }" });
        await canvas.screenshot({ path: pngPath });
        await page.evaluate(() => {
          for (const s of Array.from(document.querySelectorAll("style"))) {
            if (s.textContent && s.textContent.includes("animation-play-state: paused")) s.remove();
          }
        });
        out.png = pngPath;
      }

      // Uniform flow period so a captured GIF segment — and the SVG's own SMIL loop — repeat cleanly.
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

      if (!gifPath || !ffmpeg) return out;

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
            await page.evaluate((i: number) => window.__diagramGoToStep && window.__diagramGoToStep(i), b);
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
      return out;
    } finally {
      await browser.close();
      rmSync(tmp, { recursive: true, force: true });
    }
  }
}
