// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Collapsible code blocks on walkthrough beats and sequence events:
// codeBlocks, the opt-in codeSplit: "markers", and the unchanged single block.
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { codeBlocksOf, splitCodeByMarkers } from '#core-src/codeBlocks.ts';
import { renderSpec } from './support/deps';
import { generateSequenceHtml } from './support/deps';
import { stepSchema } from '#domain/schemas/architecture.ts';
import { sequenceInputSchema } from '#domain/schemas/sequence.ts';
import { importChromium } from '#adapters/outbound/rasterizer.ts';

const JOINED = [
  '===== eks.tf =====',
  'module "eks" {',
  '  source = "terraform-aws-modules/eks/aws"',
  '}',
  '',
  '===== deployment.yaml =====',
  ...Array.from({ length: 30 }, (_, i) => `line ${i + 1}`),
].join('\n');

describe('codeBlocksOf / splitCodeByMarkers (pure)', () => {
  it('splits at ===== name ===== and infers the language from the extension', () => {
    const b = splitCodeByMarkers(JOINED, 'CODE');
    expect(b.map(x => [x.label, x.lang])).toEqual([['eks.tf', 'hcl'], ['deployment.yaml', 'yaml']]);
    expect(b[0].code.startsWith('module "eks"')).toBe(true);
  });
  it('markers may sit behind a line comment; the language comes from the first file name', () => {
    const b = splitCodeByMarkers('# ===== eks.tf (Terraform) — EKS =====\nmodule "x" {}\n// ===== app.ts =====\nexport {}\n/* ===== a.css ===== */\n.a{}\n-- ===== q.sql =====\nselect 1', 'C');
    expect(b.map(x => [x.label, x.lang])).toEqual([['eks.tf (Terraform) — EKS', 'hcl'], ['app.ts', 'typescript'], ['a.css', 'css'], ['q.sql', 'sql']]);
    expect(splitCodeByMarkers('# ===== Dockerfile (multi-stage) =====\nFROM x', 'C')[0].lang).toBe('dockerfile');
  });
  it('a single code string is NOT split without codeSplit (unchanged behavior)', () => {
    expect(codeBlocksOf({ code: JOINED })).toBeNull();
    expect(codeBlocksOf({ code: 'no markers', codeSplit: 'markers' })).toBeNull();
  });
  it('first block open, the rest collapsed; policies and per-block overrides', () => {
    const rest = codeBlocksOf({ code: JOINED, codeSplit: 'markers' })!;
    expect(rest.map(b => b.collapsed)).toEqual([false, true]);
    expect(codeBlocksOf({ code: JOINED, codeSplit: 'markers' }, v => v, { defaultCollapsed: 'all' })!.map(b => b.collapsed)).toEqual([true, true]);
    expect(codeBlocksOf({ codeBlocks: [{ label: 'a', code: 'x', collapsed: true }, { label: 'b', code: 'y', collapsed: false }] })!.map(b => b.collapsed)).toEqual([true, false]);
    expect(rest[1].maxLines).toBe(20);
    expect(rest[1].lineCount).toBe(30);
  });
  it('schemas accept codeBlocks + codeSplit on steps and sequence events', () => {
    expect(stepSchema.safeParse({ title: 's', codeBlocks: [{ label: 'a.tf', code: 'x', maxLines: 10 }] }).success).toBe(true);
    expect(stepSchema.safeParse({ title: 's', code: JOINED, codeSplit: 'markers' }).success).toBe(true);
    expect(stepSchema.safeParse({ title: 's', codeSplit: 'lines' }).success).toBe(false);
    expect(sequenceInputSchema.safeParse({ title: 'S', participants: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], events: [{ kind: 'message', id: 'm', from: 'a', to: 'b', label: 'x', codeBlocks: [{ label: 'h.py', code: 'pass' }] }] }).success).toBe(true);
  });
});

describe('StepCard rendering (SSR)', () => {
  const render = async (step: Record<string, unknown>, parts?: unknown[]) => {
    const { StepCard } = await import('../packages/diagram-core/dist/react.js');
    return renderToString(React.createElement(StepCard as any, { steps: [{ title: 'Beat', ...step }], activeStep: 0, lang: 'en', parts }));
  };
  it('codeSplit: "markers" → one collapsible block per file with its own header, copy and chevron', async () => {
    const html = await render({ code: JOINED, codeLabel: 'TERRAFORM', codeSplit: 'markers' });
    expect(html).toContain('data-ld-code-blocks="2"');
    expect(html).toContain('2 files');
    expect(html).toContain('eks.tf');
    expect(html).toContain('deployment.yaml');
    expect((html.match(/class="ld-code-copy"/g) || []).length).toBe(2);
    expect(html).toMatch(/class="ld-code-toggle" aria-expanded="true" aria-controls/);
    expect(html).toMatch(/class="ld-code-toggle" aria-expanded="false" aria-controls/);
    expect(html).toContain('collapsed · 30 lines');
    expect(html).toContain('Show more (10 lines)');
  });
  it('a plain `code` keeps the classic single block, markers and all', async () => {
    const html = await render({ code: JOINED, codeLabel: 'TERRAFORM' });
    expect(html).not.toContain('data-ld-code-block');
    expect(html).toContain('===== eks.tf =====');
  });
  it('layout props on stepCard.code: defaultCollapsed, maxLines, showCopy, showLang', async () => {
    const html = await render({ code: JOINED, codeSplit: 'markers' }, [{ component: 'stepCard.code', props: { defaultCollapsed: 'none', maxLines: 5, showCopy: false, showLang: false } }]);
    expect(html).not.toContain('class="ld-code-copy"');
    expect(html).not.toContain('class="ld-code-lang"');
    expect(html).not.toMatch(/class="ld-code-toggle" aria-expanded="false"/);
    expect(html).toContain('Show more (25 lines)');
  });
});

describe('page wiring', () => {
  const spec = {
    title: 'Code blocks', services: [{ id: 'fn', service: 'AWS Lambda', category: 'compute' }], connections: [],
    steps: [{ title: 'Deploy', nodes: ['fn'], code: JOINED, codeLabel: 'TERRAFORM · YAML', codeSplit: 'markers' }],
    startStep: 0,
  };
  it('the architecture page carries codeSplit to the step', () => {
    const { html } = renderSpec(spec);
    const d = JSON.parse(html.match(/id="arch-data"[^>]*>([\s\S]*?)<\/script>/)![1]);
    expect(d.steps[0].codeSplit).toBe('markers');
  });
  it('the standalone sequence player inlines the same splitter and renders blocks', () => {
    const html = generateSequenceHtml({ title: 'S', participants: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], events: [{ kind: 'message', id: 'm', from: 'a', to: 'b', label: 'x', code: JOINED, codeSplit: 'markers' }] });
    expect(html).toContain('function codeBlocksOf');
    expect(html).toContain('id="pcodes"');
  });

  // Headless: toggle a block, "show more", expand all — in Chromium, from file://.
  it('headless: expand/collapse, show more and expand all work in the browser', async () => {
    let pw: any;
    try { pw = await importChromium(); } catch { return; } // no Playwright on this machine: covered by SSR above
    const dir = mkdtempSync(join(tmpdir(), 'ld-code-'));
    const file = join(dir, 'p.html');
    writeFileSync(file, renderSpec({ ...spec, stepZoom: true }).html);
    const browser = await pw.chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      const errors: string[] = [];
      page.on('pageerror', (e: Error) => errors.push(e.message));
      await page.goto('file://' + file);
      await page.waitForSelector('[data-ld-code-blocks="2"]', { timeout: 15000 });
      const state = () => page.$$eval('.ld-code-toggle', (bs: any[]) => bs.map(b => b.getAttribute('aria-expanded')));
      expect(await state()).toEqual(['true', 'false']);
      await page.click('[data-ld-code-block="b1"] .ld-code-toggle');
      expect(await state()).toEqual(['true', 'true']);
      expect(await page.textContent('[data-ld-code-block="b1"] .ld-code-more')).toContain('Show more (10 lines)');
      await page.click('[data-ld-code-block="b1"] .ld-code-more');
      expect(await page.textContent('[data-ld-code-block="b1"] .ld-code-body pre')).toContain('line 30');
      await page.click('.ld-code-all');
      expect(await state()).toEqual(['false', 'false']);
      // Copy is per block (its own button, its own feedback).
      await page.click('[data-ld-code-block="b0"] .ld-code-copy');
      expect(await page.textContent('[data-ld-code-block="b0"] .ld-code-copy')).toBe('copied');
      expect(await page.textContent('[data-ld-code-block="b1"] .ld-code-copy')).toBe('copy');
      // Keyboard: the toggle is a real button (Enter/Space).
      await page.focus('[data-ld-code-block="b0"] .ld-code-toggle');
      await page.keyboard.press('Enter');
      expect(await state()).toEqual(['true', 'false']);
      await page.focus('[data-ld-code-block="b0"] .ld-code-toggle');
      await page.keyboard.press(' ');
      expect(await state()).toEqual(['false', 'false']);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  }, 60000);
});
