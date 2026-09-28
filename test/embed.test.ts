// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The generated players carry their diagram as a JSON <script> block, so author
// text has to survive two hazards that silently produced a BROKEN player before:
//   • `</script>` closed the data block early — the rest of the text landed in
//     the DOM as markup and JSON.parse saw truncated JSON (blank page);
//   • `$&` / '$`' / `$'` were read as String.replace replacement patterns, so
//     template text got spliced into the data.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
// @ts-expect-error — plain JS module, no types
import { generateHtml } from '../lib/html-generator.js';
// @ts-expect-error — plain JS module, no types
import { generateFlowHtml } from '../lib/flow-generator.js';
// @ts-expect-error — plain JS module, no types
import { generateSequenceHtml } from '../lib/sequence-generator.js';
// @ts-expect-error — plain JS module, no types
import { embedJson } from '../lib/embed.js';

// The hostile string a real diagram can legitimately contain: a snippet that
// documents a script tag, and shell text with replacement-pattern sigils.
const HOSTILE = 'close </script><img src=x onerror=alert(1)> and $& and $` and $\' done';

function dataOf(html: string, id: string): any {
  const m = html.match(new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)</script>`));
  if (!m) throw new Error(`no ${id} block`);
  return JSON.parse(m[1]);
}

describe('embedJson', () => {
  it('escapes < so no author string can close the data block', () => {
    expect(embedJson({ a: '</script>' })).toBe('{"a":"\\u003c/script>"}');
    expect(JSON.parse(embedJson({ a: '</script>' })).a).toBe('</script>');
  });
});

describe('embedded diagram data survives hostile author text', () => {
  it('architecture player', () => {
    const html = generateHtml('T', HOSTILE, [{ id: 'a', service: 'Amazon S3', label: HOSTILE }], []);
    expect(html).not.toContain('<img src=x');   // the tag never lands as markup
    const data = dataOf(html, 'arch-data');
    expect(data.subtitle).toBe(HOSTILE);
    expect(data.services[0].label).toBe(HOSTILE);
  });

  it('flow player', () => {
    const html = generateFlowHtml({
      type: 'workflow', title: 'T', nodes: [{ id: 'a', label: HOSTILE }], edges: [],
      steps: [{ id: 's', title: 'S', desc: HOSTILE, nodes: ['a'] }],
    });
    expect(html).not.toContain('<img src=x');   // the tag never lands as markup
    const data = dataOf(html, 'flow-data');
    expect(data.nodes[0].label).toBe(HOSTILE);
    expect(data.steps[0].desc).toBe(HOSTILE);
  });

  it('sequence player', () => {
    const html = generateSequenceHtml({
      title: 'T', participants: [{ id: 'p', label: HOSTILE }, { id: 'q', label: 'Q' }],
      events: [{ kind: 'message', from: 'p', to: 'q', label: HOSTILE, title: 'S' }],
    });
    expect(html).not.toContain('<img src=x');   // the tag never lands as markup
    const data = dataOf(html, 'seq-data');
    expect(data.participants[0].label).toBe(HOSTILE);
    expect(data.events[0].label).toBe(HOSTILE);
  });
});

describe('proof links', () => {
  // The players turn a structured proof ref into an anchor. A javascript: URL
  // would run on click in a file the reader just double-clicked, so only
  // http(s)/mailto become links — anything else degrades to plain text.
  it('players only anchor http(s)/mailto URLs', () => {
    for (const tmpl of ['flow-template.html', 'sequence-template.html']) {
      const src = readFileSync(new URL(`../lib/${tmpl}`, import.meta.url), 'utf-8');
      expect(src).toMatch(/const safeUrl = u => \/\^\(https\?:\|mailto:\)/);
      expect(src).toMatch(/url = safeUrl\(url\);/);
      // esc() guards attribute values, not just text
      expect(src).toContain(`replace(/"/g,'&quot;')`);
    }
  });
});
