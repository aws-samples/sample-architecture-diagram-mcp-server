// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Resolve an icon reference to a renderable src.
// In standalone (email-attachable) HTML, icons are inlined as base64 into
// window.__ICONS__ at generation time, so we never depend on an external
// /icons/ path that breaks under file://. Falls back to the dev /icons/ path
// when no inlined map is present (e.g. the live MCP canvas served with assets).
export function resolveIcon(ref?: string): string | null {
  if (!ref) return null;
  const map = (typeof window !== 'undefined' ? (window as any).__ICONS__ : null) as Record<string, string> | null;
  if (map) {
    // Inlined (standalone) mode: the map holds every icon that could be inlined
    // at generation time. A ref that's absent couldn't be resolved on disk, so
    // render the initials fallback (null) — NOT a served "/icons/…" path, which
    // would 404 as a broken <img> and, under file://, abort PNG export.
    return map[ref] ?? null;
  }
  // Dev/served fallback (no inlined map): "aws-icons/x.svg" keeps its prefix,
  // bare names go under /icons/.
  return ref.includes('/') ? '/' + ref : '/icons/' + ref;
}

// Some icons are MONOCHROME (single dark glyph on transparent) — they vanish on
// the dark canvas, so we recolor them to white via the icon-filter CSS var in
// dark mode. Full-color icons must NOT be filtered. Unlike the deck's <Icon>
// (which treats ALL Res_* as monochrome), the AWS Resource set here is mostly
// FULL-COLOR (Res_Amazon-EC2_Instances = orange, Res_Amazon-VPC_NAT = purple),
// so we only invert the genuinely monochrome refs:
//   • aws-icons/*                line-art SVGs (navy glyph)
//   • *_Light.(png|svg)          the light-background monochrome cut (e.g. Res_Users_48_Light)
export function iconFilter(ref?: string): string {
  if (!ref) return 'none';
  if (ref.startsWith('aws-icons/')) return 'var(--icon-filter, none)';
  if (/_Light\.(png|svg)$/i.test(ref)) return 'var(--icon-filter, none)';
  return 'none';
}
