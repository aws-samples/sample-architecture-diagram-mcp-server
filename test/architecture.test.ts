// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The hexagonal dependency rule (docs/architecture.md): dependencies point
// inwards only, and the domain and application layers do no I/O.
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
const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const imports = (src: string) => [...src.matchAll(IMPORT)].map((m) => m[1] ?? m[2]);

const PURE_PACKAGES = new Set(['zod']);
const ALLOWED: Record<string, string[]> = {
  domain: ['domain', 'assets'],
  application: ['application', 'domain', 'assets'],
  adapters: ['adapters', 'application', 'domain', 'assets'],
  main: ['main', 'adapters', 'application', 'domain', 'assets'],
  assets: ['assets'],
};

describe('hexagonal architecture', () => {
  const files = walk(SERVER);

  it('has server sources', () => { expect(files.length).toBeGreaterThan(0); });

  for (const file of files) {
    const layer = layerOf(file);
    const rel = relative(ROOT, file);
    it(`${rel} respects the dependency rule`, () => {
      const src = readFileSync(file, 'utf-8');
      for (const spec of imports(src)) {
        if (spec.startsWith('.')) {
          const target = resolve(dirname(file), spec);
          expect(target.startsWith(SERVER), `${rel} imports ${spec} outside server/`).toBe(true);
          const tl = layerOf(target);
          expect(ALLOWED[layer], `${rel} (${layer}) must not import ${spec} (${tl})`).toContain(tl);
        } else if (layer === 'domain' || layer === 'application') {
          const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
          expect(spec.startsWith('@core/') || PURE_PACKAGES.has(pkg), `${rel} (${layer}) must not import ${spec}`).toBe(true);
        }
      }
      if (layer === 'domain' || layer === 'application') {
        expect(/\bprocess\.(env|argv|cwd|platform|exit)\b/.test(src), `${rel} reads process.*`).toBe(false);
      }
    });
  }
});
