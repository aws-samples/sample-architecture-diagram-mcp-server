// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Presenter stage: the walkthrough drives a real shell (a loopback control
// server) and embeds its browser terminal in the step card. Only the pure
// helpers are exercised here — useStage needs EventSource/DOM, and the wiring
// that matters for the generated HTML is the `stage` block in #arch-data.
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain JS module, no types
import { generateHtml } from '../lib/html-generator.js';
// @ts-expect-error — plain JS module, no types
import { stageBase, stageEnabled, stageToken } from '../packages/diagram-core/src/stage.js';
// @ts-expect-error — plain JS module, no types
import { stageSchema, htmlDiagramInputSchema } from '../lib/schemas.js';

function archDataOf(html: string): any {
  const m = html.match(/id="arch-data"[^>]*>([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : {};
}

const services = [{ id: 'api', service: 'Amazon API Gateway', shape: 'api_gateway', category: 'networking' }];
const connections: any[] = [];

describe('stage — arch data wiring', () => {
  it('emits the stage block verbatim when authored', () => {
    const stage = { terminal: 'http://localhost:7681/', control: 'http://127.0.0.1:8765', height: 260 };
    const d = archDataOf(generateHtml('T', '', services, connections, { stage }));
    expect(d.stage).toEqual(stage);
  });

  it('omits stage entirely when not authored (presenter mode is opt-in)', () => {
    expect(archDataOf(generateHtml('T', '', services, connections, {})).stage).toBeUndefined();
  });
});

describe('stage — schema', () => {
  it('accepts a terminal-only stage (height falls back to the hook default)', () => {
    const s = stageSchema.parse({ terminal: 'http://localhost:7681/' });
    expect(s.terminal).toBe('http://localhost:7681/');
    expect(s.height).toBeUndefined();
    expect(s.control).toBeUndefined();
  });

  it('rejects an out-of-range height', () => {
    expect(stageSchema.safeParse({ terminal: 'x', height: 40 }).success).toBe(false);
    expect(stageSchema.safeParse({ terminal: 'x', height: 1000 }).success).toBe(false);
  });

  it('is optional on the html diagram input', () => {
    const r = htmlDiagramInputSchema.safeParse({ title: 'T', services, connections });
    expect(r.success).toBe(true);
    expect(r.data.stage).toBeUndefined();
  });
});

describe('stage — helpers', () => {
  it('is enabled by either a terminal or a control base', () => {
    expect(stageEnabled(undefined)).toBe(false);
    expect(stageEnabled({})).toBe(false);
    expect(stageEnabled({ terminal: 'http://localhost:7681/' })).toBe(true);
    // A same-origin control server is authored as "" — enabled, not absent.
    expect(stageEnabled({ control: '' })).toBe(true);
  });

  it('strips trailing slashes from the control base so `${base}/events` is well-formed', () => {
    expect(stageBase({ control: 'http://127.0.0.1:8765/' })).toBe('http://127.0.0.1:8765');
    expect(stageBase({ control: 'http://127.0.0.1:8765///' })).toBe('http://127.0.0.1:8765');
    expect(stageBase({ control: '' })).toBe('');
    expect(stageBase(undefined)).toBe('');
  });

  it('maps a beat index to the server token (1-based beats, -1 is the overview)', () => {
    expect(stageToken(-1)).toBe('overview');
    expect(stageToken(0)).toBe('1');
    expect(stageToken(7)).toBe('8');
  });
});
