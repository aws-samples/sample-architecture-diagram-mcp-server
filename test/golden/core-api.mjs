// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Public API of @aws-sample-live-diagram/core as published: the exported names
// of every entry, and for each declared function the parameter names (for a
// component, the props it destructures) and whether its props object is
// optional — read from the built .d.ts files.
//   node test/golden/core-api.mjs <repoRoot> <out.json>
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ENTRIES = ['index', 'react', 'typed', 'typed-react', 'layout-engine'];

export function coreApi(root) {
  const api = {};
  for (const e of ENTRIES) {
    const dts = readFileSync(join(root, 'packages/diagram-core/dist', `${e}.d.ts`), 'utf-8');
    const exports = new Set();
    for (const m of dts.matchAll(/export\s*\{([^}]*)\}/g)) {
      for (const part of m[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop();
        if (name && name !== 'type') exports.add(name.replace(/^type\s+/, ''));
      }
    }
    const fns = {};
    for (const m of dts.matchAll(/declare function (\w+)\(\{([^}]*)\}\s*(\?)?:/g)) {
      fns[m[1]] = m[2].split(',').map(s => s.trim().split(/[\s:=]/)[0]).filter(Boolean).sort();
    }
    api[e] = { exports: [...exports].sort(), props: fns };
  }
  return api;
}

if (process.argv[2]) {
  writeFileSync(process.argv[3], JSON.stringify(coreApi(process.argv[2]), null, 2) + '\n');
}
