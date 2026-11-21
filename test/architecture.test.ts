// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The hexagonal dependency rule and the import convention (docs/architecture.md):
//   * dependencies point inwards only; domain and application do no I/O;
//   * cross-directory imports use the package.json "imports" aliases
//     (#domain/*, #application/*, #adapters/*, #main/*, #assets/*) with real
//     .ts extensions; same-directory imports are ./x.ts; never ../;
//   * the core is reached only through its public package entries.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve, dirname } from 'path';

const ROOT = resolve(__dirname, '..');
const SERVER = join(ROOT, 'server');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && !f.endsWith('.d.ts') ? [p] : [];
  });
}
const layerOf = (file: string) => relative(SERVER, file).split('/')[0];
// import … from 'x' · export … from 'x' · import 'x' (side effect) · import('x')
const IMPORT = /(?:^|\n)\s*(?:import|export)\s(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const imports = (src: string) => [...src.matchAll(IMPORT)].map((m) => m[1] ?? m[2]);

const LAYERS = ['domain', 'application', 'adapters', 'main', 'assets'];
const PURE_PACKAGES = new Set(['zod', '@aws-sample-live-diagram/core']);
const ALLOWED: Record<string, string[]> = {
  domain: ['domain', 'assets'],
  application: ['application', 'domain', 'assets'],
  adapters: ['adapters', 'application', 'domain', 'assets'],
  main: ['main', 'adapters', 'application', 'domain', 'assets'],
  assets: ['assets'],
};
// The runtime platform named in the inner layers would leak it into the core
// (AWS service names are domain vocabulary here: the diagrams draw them).
const INFRA_WORDS = /\b(AgentCore|Chromium|Playwright|ffmpeg|vite|stdio|esbuild|drawio CLI)\b/;

describe('hexagonal architecture', () => {
  const files = walk(SERVER);

  it('has server sources in every layer', () => {
    for (const l of ['domain', 'application', 'adapters', 'main']) expect(files.some((f) => layerOf(f) === l), l).toBe(true);
  });

  for (const file of files) {
    const layer = layerOf(file);
    const rel = relative(ROOT, file);
    it(`${rel} respects the dependency rule and the import convention`, () => {
      const src = readFileSync(file, 'utf-8');
      for (const spec of imports(src)) {
        expect(spec.startsWith('../'), `${rel}: no ../ imports (${spec})`).toBe(false);
        expect(spec.startsWith('@core/') || spec.startsWith('#core-src/'), `${rel}: core only via its public entries (${spec})`).toBe(false);
        if (spec.startsWith('./')) {
          expect(/\.(tsx?|json)(\?raw)?$|\.html\?raw$/.test(spec), `${rel}: real extension on ${spec}`).toBe(true);
          expect(spec.slice(2).includes('/'), `${rel}: ./ only within the same directory (${spec})`).toBe(false);
          continue;
        }
        if (spec.startsWith('#')) {
          const target = spec.slice(1).split('/')[0];
          expect(LAYERS, `${rel}: unknown alias ${spec}`).toContain(target);
          expect(ALLOWED[layer], `${rel} (${layer}) must not import ${spec}`).toContain(target);
          expect(/\.(tsx?|json)$|\?raw$/.test(spec), `${rel}: real extension on ${spec}`).toBe(true);
          continue;
        }
        if (layer === 'domain' || layer === 'application') {
          const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
          expect(PURE_PACKAGES.has(pkg), `${rel} (${layer}) must not import ${spec}`).toBe(true);
        }
      }
      if (layer === 'domain' || layer === 'application') {
        expect(/\bprocess\.(env|argv|cwd|platform|exit|stdout|stderr)\b/.test(src), `${rel} reads process.*`).toBe(false);
        const code = src.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
        expect(INFRA_WORDS.exec(code)?.[0] ?? null, `${rel} names infrastructure in code`).toBeNull();
      }
    });
  }
});
