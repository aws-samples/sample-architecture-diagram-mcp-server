// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Third-party notices for what the generated HTML actually carries. Tailwind's
// compiled CSS is inlined in every page, so its MIT banner must survive into the
// output and THIRD-PARTY-LICENSES must list it at the version that is bundled.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { generateHtml } from './support/deps';
import { renderSpec } from './support/deps';

const ROOT = join(__dirname, '..');
const TAILWIND = JSON.parse(readFileSync(join(ROOT, 'node_modules', 'tailwindcss', 'package.json'), 'utf-8')).version as string;
const BANNER = `tailwindcss v${TAILWIND} | MIT License`;
const NOTICES = readFileSync(join(ROOT, 'THIRD-PARTY-LICENSES'), 'utf-8');
const services = [{ id: 'fn', service: 'AWS Lambda', category: 'compute' }];

describe('Tailwind CSS (MIT) — inlined in every page', () => {
  it('is listed in THIRD-PARTY-LICENSES at the bundled version, under the MIT section', () => {
    const mit = NOTICES.slice(NOTICES.indexOf('COMPONENTS UNDER THE MIT LICENSE'), NOTICES.indexOf('MIT License\n\nPermission'));
    expect(mit).toContain(`tailwindcss ${TAILWIND}`);
    expect(mit).toContain('Tailwind Labs, Inc.');
  });
  it('keeps the banner in the shipped page template and in generated HTML', () => {
    expect(readFileSync(join(ROOT, 'dist', 'index.html'), 'utf-8')).toContain(BANNER);
    expect(generateHtml('t', '', services, [], {})).toContain(BANNER);
    expect(renderSpec({ title: 't', services, connections: [], layout: 'cost' }).html).toContain(BANNER);
  });
});
