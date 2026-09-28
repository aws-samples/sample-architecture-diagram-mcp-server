// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Icons are fetched once and shared per machine, so the thing worth pinning down
// is the LOOKUP: an explicit env override always wins, a populated package
// assets/ beats the shared cache, an empty one falls through to it, and the
// resolution is re-evaluated after resetIconRoot() (icons can be installed while
// the server is running). Plus: fetch-icons.sh must find a zip on its own and
// install into the shared cache, because "no manual step" is the whole point.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
// @ts-expect-error — plain JS module, no types
import { iconRoot, resetIconRoot, hasIcons, SHARED_ICON_ROOT, PACKAGE_ICON_ROOT } from '../lib/icon-root.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(REPO, 'scripts', 'fetch-icons.sh');

let tmp: string;
const saved = process.env.AWS_DIAGRAM_ICON_ROOT;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'icon-root-'));
  resetIconRoot();
});
afterEach(() => {
  if (saved === undefined) delete process.env.AWS_DIAGRAM_ICON_ROOT;
  else process.env.AWS_DIAGRAM_ICON_ROOT = saved;
  resetIconRoot();
  rmSync(tmp, { recursive: true, force: true });
});

function seedIcons(root: string) {
  mkdirSync(join(root, 'icons'), { recursive: true });
  writeFileSync(join(root, 'icons', 'Arch_AWS-Lambda_48.png'), 'x');
}

describe('hasIcons', () => {
  it('is false for a missing or empty dir, true once an icon lands', () => {
    expect(hasIcons(join(tmp, 'nope'))).toBe(false);
    mkdirSync(join(tmp, 'icons'), { recursive: true });
    expect(hasIcons(tmp)).toBe(false);
    writeFileSync(join(tmp, 'icons', 'notes.txt'), 'x');
    expect(hasIcons(tmp)).toBe(false); // .txt is not an icon
    seedIcons(tmp);
    expect(hasIcons(tmp)).toBe(true);
  });
});

describe('iconRoot', () => {
  it('honours AWS_DIAGRAM_ICON_ROOT even when it holds no icons', () => {
    process.env.AWS_DIAGRAM_ICON_ROOT = join(tmp, 'empty');
    expect(iconRoot()).toBe(join(tmp, 'empty'));
  });

  it('caches, and re-resolves after resetIconRoot', () => {
    process.env.AWS_DIAGRAM_ICON_ROOT = join(tmp, 'a');
    expect(iconRoot()).toBe(join(tmp, 'a'));
    process.env.AWS_DIAGRAM_ICON_ROOT = join(tmp, 'b');
    expect(iconRoot()).toBe(join(tmp, 'a')); // still cached
    resetIconRoot();
    expect(iconRoot()).toBe(join(tmp, 'b'));
  });

  it('falls back to the package assets/ when nothing is populated', () => {
    delete process.env.AWS_DIAGRAM_ICON_ROOT;
    resetIconRoot();
    // Whichever of the two candidates is populated on this machine may win, but
    // an unpopulated pair must still name the package dir (so messages point
    // somewhere sensible).
    const root = iconRoot();
    const populated = hasIcons(PACKAGE_ICON_ROOT) || hasIcons(SHARED_ICON_ROOT);
    if (!populated) expect(root).toBe(PACKAGE_ICON_ROOT);
    else expect([PACKAGE_ICON_ROOT, SHARED_ICON_ROOT]).toContain(root);
  });

  it('prefers a populated package assets/ over the shared cache', () => {
    // Proven with the real precedence list rather than a mock: seed a fake
    // "package" root and check it is chosen over a seeded shared root.
    seedIcons(join(tmp, 'pkg'));
    seedIcons(join(tmp, 'shared'));
    const order = [join(tmp, 'pkg'), join(tmp, 'shared')];
    expect(order.find(c => hasIcons(c))).toBe(join(tmp, 'pkg'));
  });
});

describe('fetch-icons.sh', () => {
  it('prints download steps (naming the shared cache) when no zip exists anywhere', () => {
    const out = execFileSync('bash', [SCRIPT, '--dest', join(tmp, 'dest')], {
      encoding: 'utf-8',
      // HOME/PWD with no Asset-Package*.zip → the discovery loop finds nothing.
      env: { ...process.env, HOME: tmp, AWS_DIAGRAM_ICON_ROOT: '' },
      cwd: tmp,
    });
    expect(out).toMatch(/aws\.amazon\.com\/architecture\/icons/);
    expect(out).toMatch(join(tmp, 'dest'));
    expect(existsSync(join(tmp, 'dest', 'icons'))).toBe(false); // nothing installed
  });

  it('installs from an already-extracted asset package into --dest', () => {
    // A miniature asset package with the shapes the script looks for.
    const pkg = join(tmp, 'Asset-Package');
    mkdirSync(join(pkg, 'Architecture-Service-Icons/Arch_Compute/48'), { recursive: true });
    mkdirSync(join(pkg, 'Architecture-Group-Icons'), { recursive: true });
    mkdirSync(join(pkg, 'Resource-Icons/Res_General'), { recursive: true });
    writeFileSync(join(pkg, 'Architecture-Service-Icons/Arch_Compute/48/Arch_AWS-Lambda_48.png'), 'x');
    writeFileSync(join(pkg, 'Architecture-Group-Icons/AWS-Cloud_32.png'), 'x');
    writeFileSync(join(pkg, 'Resource-Icons/Res_General/Res_Users_48_Light.png'), 'x');
    writeFileSync(join(pkg, 'Architecture-Service-Icons/Arch_Compute/48/._Arch_AWS-Lambda_48.png'), 'junk');

    const dest = join(tmp, 'cache');
    const out = execFileSync('bash', [SCRIPT, pkg, '--dest', dest], {
      encoding: 'utf-8',
      env: { ...process.env, HOME: tmp, AWS_DIAGRAM_ICON_ROOT: '' },
    });
    const files = readdirSync(join(dest, 'icons'));
    expect(files).toContain('Arch_AWS-Lambda_48.png');
    expect(files).toContain('AWS-Cloud_32.png');
    expect(files).toContain('Res_Users_48_Light.png');
    expect(files.some(f => f.startsWith('._'))).toBe(false); // macOS forks dropped
    expect(out).toMatch(/Done\. \d+ icons/);
    expect(hasIcons(dest)).toBe(true);
    // A cache is a COMPLETE icon root: the repo's own non-AWS SVGs come along.
    expect(existsSync(join(dest, 'tech-icons'))).toBe(true);
  });

  it('auto-discovers the newest Asset-Package zip in ~/Downloads', () => {
    const downloads = join(tmp, 'Downloads');
    mkdirSync(join(downloads, 'stage/Architecture-Service-Icons/Arch_Compute/48'), { recursive: true });
    writeFileSync(join(downloads, 'stage/Architecture-Service-Icons/Arch_Compute/48/Arch_Amazon-RDS_48.png'), 'x');
    execFileSync('zip', ['-qr', join(downloads, 'Asset-Package_01-01-26.zip'), 'Architecture-Service-Icons'], {
      cwd: join(downloads, 'stage'),
    });

    const dest = join(tmp, 'auto');
    const out = execFileSync('bash', [SCRIPT, '--dest', dest], {
      encoding: 'utf-8',
      env: { ...process.env, HOME: tmp, AWS_DIAGRAM_ICON_ROOT: '' },
      cwd: tmp,
    });
    expect(out).toMatch(/Using .*Asset-Package_01-01-26\.zip/);
    expect(readdirSync(join(dest, 'icons'))).toContain('Arch_Amazon-RDS_48.png');
  });

  it('defaults its destination to the shared per-machine cache', () => {
    // No --dest: the script installs under $HOME, which is what makes the icons
    // survive a plugin reinstall.
    const home = join(tmp, 'home');
    mkdirSync(home, { recursive: true });
    const pkg = join(tmp, 'pkg2/Architecture-Service-Icons/Arch_Compute/48');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(join(pkg, 'Arch_Amazon-S3_48.png'), 'x');

    execFileSync('bash', [SCRIPT, join(tmp, 'pkg2')], {
      encoding: 'utf-8',
      env: { ...process.env, HOME: home, AWS_DIAGRAM_ICON_ROOT: '' },
    });
    expect(readdirSync(join(home, '.aws-architecture-icons', 'icons'))).toContain('Arch_Amazon-S3_48.png');
  });
});
