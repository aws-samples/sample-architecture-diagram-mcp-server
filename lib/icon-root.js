// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Where the AWS Architecture Icons live.
//
// They are NOT redistributed with this package (AWS Terms of Use), so they have
// to be fetched once. The thing that used to hurt was that "once" meant "once
// per copy of this server": a plugin install, an `npx` run and a git clone each
// looked only at their own `assets/`, so reinstalling or upgrading the plugin
// silently went back to rendering category-colored initials.
//
// Fix: a per-MACHINE cache that every copy shares. Resolution order:
//   1. AWS_DIAGRAM_ICON_ROOT      — explicit override, always wins
//   2. <package>/assets           — a checkout that fetched icons into itself
//   3. ~/.aws-architecture-icons  — the shared cache (fetch-icons.sh default)
// Falls back to <package>/assets so messages point somewhere sensible when no
// icons exist anywhere yet.
import { readdirSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PACKAGE_ICON_ROOT = join(__dirname, '..', 'assets');
export const SHARED_ICON_ROOT = join(homedir(), '.aws-architecture-icons');

/** True when <root>/icons holds at least one usable icon file. */
export function hasIcons(root) {
  try {
    return readdirSync(join(root, 'icons')).some(f => /\.(png|svg)$/i.test(f));
  } catch {
    return false; // missing/unreadable dir — just "no icons here"
  }
}

let cached = null;

/** The directory holding icons/, aws-icons/, tech-icons/ for this process. */
export function iconRoot() {
  if (cached) return cached;
  const env = process.env.AWS_DIAGRAM_ICON_ROOT;
  if (env) return (cached = env);
  for (const candidate of [PACKAGE_ICON_ROOT, SHARED_ICON_ROOT]) {
    if (hasIcons(candidate)) return (cached = candidate);
  }
  return (cached = PACKAGE_ICON_ROOT);
}

/**
 * Forget the resolved root. Icons can land *while* the server is running (the
 * setup_icons tool), and the very next diagram must see them.
 */
export function resetIconRoot() {
  cached = null;
}
