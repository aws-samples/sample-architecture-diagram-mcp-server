// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// `caption` is the OPTIONAL header band above the canvas (what this diagram is,
// in words) — so the two things worth pinning down are that it reaches the player
// payload verbatim in both author shapes, and that omitting it leaves the payload
// exactly as it was (the classic bare-canvas diagram must not regress).
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain JS module, no types
import { generateHtml } from '../lib/html-generator.js';
// @ts-expect-error — plain JS module, no types
import { captionSchema } from '../lib/schemas.js';
// @ts-expect-error — plain JSX module, no types
import { resolveCaption } from '../packages/diagram-core/src/components/DiagramCaption.jsx';

const SERVICES = [{ id: 'api', service: 'Amazon API Gateway' }];
const CONNECTIONS: any[] = [];

function archData(html: string): any {
  const m = html.match(/id="arch-data"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no arch-data block');
  return JSON.parse(m[1]);
}

describe('caption payload', () => {
  it('is absent from the payload when the author omits it', () => {
    const d = archData(generateHtml('T', 'S', SERVICES, CONNECTIONS, {}));
    expect('caption' in d).toBe(false);
  });

  it('carries the object form verbatim', () => {
    const caption = {
      eyebrow: 'Reference architecture',
      title: 'Citizen portal',
      text: 'What this shows and for whom.',
      meta: ['Version: v2', 'Env: prod'],
    };
    const d = archData(generateHtml('T', 'S', SERVICES, CONNECTIONS, { caption }));
    expect(d.caption).toEqual(caption);
  });

  it('carries the string shorthand and a per-language map', () => {
    const one = archData(generateHtml('T', 'S', SERVICES, CONNECTIONS, { caption: 'Just a sentence.' }));
    expect(one.caption).toBe('Just a sentence.');
    const bi = { en: 'The public layer.', pt: 'A camada pública.' };
    const two = archData(generateHtml('T', 'S', SERVICES, CONNECTIONS, { caption: bi }));
    expect(two.caption).toEqual(bi);
  });

  it('accepts both shapes in the schema', () => {
    expect(captionSchema.safeParse('a sentence').success).toBe(true);
    expect(captionSchema.safeParse({ title: 'T', meta: ['a'] }).success).toBe(true);
    expect(captionSchema.safeParse({ en: 'x', pt: 'y' }).success).toBe(true);
    expect(captionSchema.safeParse(42).success).toBe(false);
  });
});

describe('resolveCaption', () => {
  it('returns null for nothing to render', () => {
    expect(resolveCaption(undefined)).toBeNull();
    expect(resolveCaption('')).toBeNull();
    // An object whose fields are all empty must not render an empty band.
    expect(resolveCaption({ title: '', text: '', meta: [] })).toBeNull();
  });

  it('treats a string (and a language map) as the description', () => {
    expect(resolveCaption('hello')).toEqual({ eyebrow: '', title: '', text: 'hello', meta: [] });
    expect(resolveCaption({ en: 'hello', pt: 'olá' }, 'pt').text).toBe('olá');
  });

  it('resolves every field in the requested language', () => {
    const c = resolveCaption({
      eyebrow: { en: 'Target', pt: 'Alvo' },
      title: { en: 'Portal', pt: 'Portal' },
      text: { en: 'EN body', pt: 'Corpo PT' },
      meta: [{ en: 'Env: prod', pt: 'Ambiente: produção' }, 'v2'],
    }, 'pt');
    expect(c).toEqual({
      eyebrow: 'Alvo', title: 'Portal', text: 'Corpo PT',
      meta: ['Ambiente: produção', 'v2'],
    });
  });

  it('drops empty meta entries instead of rendering blank cells', () => {
    expect(resolveCaption({ title: 'T', meta: ['a', '', null as any, 'b'] })!.meta).toEqual(['a', 'b']);
  });
});
