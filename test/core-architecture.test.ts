// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The core package's hexagonal dependency rule and import convention
// (packages/diagram-core/README.md, docs/architecture.md):
//   domain       imports only domain; pure — no DOM, no process.*, no packages
//   ports        imports only domain TYPES; declares types only
//   application  imports domain + ports (types); pure — no DOM, no process.*, no packages
//   adapters/layout   + elkjs / dagre (the only modules importing them)
//   adapters/browser  the only modules touching location/history/clipboard/matchMedia/fullscreen/downloads
//   adapters/react    + react, @xyflow/react, framer-motion, d3-shape (the only modules importing them)
//   entries      (index.ts, layout-engine.ts, react.tsx, typed/index.ts, typed/views/index.tsx) compose
// Imports carry real .ts/.tsx extensions; "./x.ts" only within a directory;
// "#core/<layer>/…" across directories; never "../".
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

const SRC = resolve(__dirname, '../packages/diagram-core/src');
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && !f.endsWith('.d.ts') ? [p] : [];
});
const ENTRIES = new Set(['index.ts', 'layout-engine.ts', 'react.tsx', 'typed/index.ts', 'typed/views/index.tsx']);
type Layer = 'domain' | 'ports' | 'application' | 'adapters/layout' | 'adapters/browser' | 'adapters/react' | 'entry';
function layerOf(rel: string): Layer {
  if (ENTRIES.has(rel)) return 'entry';
  const [a, b] = rel.split('/');
  if (a === 'adapters') return `adapters/${b}` as Layer;
  return a as Layer;
}
const ALLOWED: Record<Layer, Layer[]> = {
  domain: ['domain'],
  ports: ['domain'],
  application: ['application', 'domain', 'ports'],
  'adapters/layout': ['adapters/layout', 'application', 'domain', 'ports'],
  'adapters/browser': ['adapters/browser', 'domain', 'ports'],
  'adapters/react': ['adapters/react', 'adapters/browser', 'adapters/layout', 'application', 'domain', 'ports'],
  entry: ['domain', 'ports', 'application', 'adapters/layout', 'adapters/browser', 'adapters/react'],
};
const PACKAGES: Partial<Record<Layer, RegExp>> = {
  'adapters/layout': /^(elkjs|dagre)(\/|$)/,
  'adapters/react': /^(react|@xyflow\/react|framer-motion|d3-shape|html-to-image)(\/|$)/,
};
// import … from 'x' · export … from 'x' · import 'x' · import('x'); `type` captured.
const IMPORT = /(?:^|\n)\s*(import|export)\s+(type\s+)?(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const importsOf = (src: string) => [...src.matchAll(IMPORT)].map((m) => ({ spec: m[3] ?? m[4], typeOnly: !!m[2] }));
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const strip = (src: string) => code(src).replace(/(["'`])(?:\\.|(?!\1)[^\\\n])*\1/g, '""');

const files = walk(SRC).map((p) => ({ p, rel: relative(SRC, p) }));

describe('core hexagonal architecture', () => {
  it('has sources in every layer', () => {
    const layers = new Set(files.map((f) => layerOf(f.rel)));
    for (const l of Object.keys(ALLOWED)) expect(layers.has(l as Layer), l).toBe(true);
  });
  it('nothing is left at the top level besides the entries', () => {
    expect(files.filter((f) => !f.rel.includes('/') && !ENTRIES.has(f.rel)).map((f) => f.rel)).toEqual([]);
  });

  for (const { p, rel } of files) {
    const layer = layerOf(rel);
    it(`${rel} (${layer}) respects the dependency rule and the import convention`, () => {
      const src = readFileSync(p, 'utf-8');
      expect(src.startsWith('// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.\n// SPDX-License-Identifier: MIT-0'), `${rel}: MIT-0 header`).toBe(true);
      for (const { spec, typeOnly } of importsOf(src)) {
        expect(spec.startsWith('../'), `${rel}: no ../ (${spec})`).toBe(false);
        if (spec.startsWith('./')) {
          expect(spec.slice(2).includes('/'), `${rel}: ./ only within the directory (${spec})`).toBe(false);
          expect(/\.tsx?$/.test(spec), `${rel}: real extension (${spec})`).toBe(true);
          continue;
        }
        if (spec.startsWith('#core/')) {
          expect(/\.tsx?$/.test(spec), `${rel}: real extension (${spec})`).toBe(true);
          const target = layerOf(spec.slice('#core/'.length));
          expect(target, `${rel}: entries are not imported from inside (${spec})`).not.toBe('entry');
          expect(ALLOWED[layer], `${rel} (${layer}) must not import ${spec}`).toContain(target);
          if (layer === 'ports') expect(typeOnly, `${rel}: ports import domain types only (${spec})`).toBe(true);
          if (layer === 'application' && target === 'ports') expect(typeOnly, `${rel}: ports are types (${spec})`).toBe(true);
          continue;
        }
        expect(spec.startsWith('#'), `${rel}: unknown alias ${spec}`).toBe(false);
        const ok = PACKAGES[layer];
        expect(!!ok && ok.test(spec), `${rel} (${layer}) must not import the package ${spec}`).toBe(true);
      }
    });
  }

  for (const { p, rel } of files.filter((f) => ['domain', 'ports', 'application'].includes(layerOf(f.rel)))) {
    it(`${rel} is pure: no DOM, no process.*, no any / @ts-ignore`, () => {
      const src = strip(readFileSync(p, 'utf-8'));
      expect(/\b(window|document|navigator|localStorage|sessionStorage|location|history|matchMedia|XMLSerializer|HTMLElement|requestAnimationFrame)\b/.exec(src)?.[0] ?? null, rel).toBeNull();
      expect(/\bprocess\./.test(src), `${rel} reads process.*`).toBe(false);
    });
  }

  for (const { p, rel } of files.filter((f) => layerOf(f.rel) === 'ports')) {
    it(`${rel} declares types only`, () => {
      expect(/\bexport\s+(const|let|var|function|class|enum|default)\b/.test(code(readFileSync(p, 'utf-8'))), rel).toBe(false);
    });
  }

  for (const { p, rel } of files.filter((f) => layerOf(f.rel) === 'adapters/react')) {
    it(`${rel} reaches URL, clipboard, downloads, media queries and fullscreen only through the ports`, () => {
      const src = strip(readFileSync(p, 'utf-8'));
      const hit = /window\.(location|history)|\bhistory\.(replaceState|pushState)|navigator\.clipboard|matchMedia|createObjectURL|\.download\s*=|fullscreenElement|\bexitFullscreen\?\.|\brequestFullscreen\?\.|localStorage|sessionStorage|prompt\(|confirm\(/.exec(src);
      expect(hit?.[0] ?? null, rel).toBeNull();
    });
  }

  for (const { p, rel } of files) {
    it(`${rel}: strict TS — no any, no @ts-ignore / @ts-nocheck`, () => {
      const src = readFileSync(p, 'utf-8');
      expect(/@ts-(ignore|nocheck)/.test(src), rel).toBe(false);
      expect(/(:\s*any\b|\bas\s+any\b|<any>|any\[\])/.exec(strip(src))?.[0] ?? null, rel).toBeNull();
    });
  }

  it('the inlined player modules stay self-contained (no imports)', () => {
    for (const m of ['flowLayout', 'sequenceLayout', 'codeBlocks']) {
      expect(/^\s*import\s/m.test(readFileSync(join(SRC, 'domain', `${m}.ts`), 'utf-8')), m).toBe(false);
    }
  });
});
