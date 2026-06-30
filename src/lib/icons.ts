// Resolve an icon reference to a renderable src.
// In standalone (email-attachable) HTML, icons are inlined as base64 into
// window.__ICONS__ at generation time, so we never depend on an external
// /icons/ path that breaks under file://. Falls back to the dev /icons/ path
// when no inlined map is present (e.g. the live MCP canvas served with assets).
export function resolveIcon(ref?: string): string | null {
  if (!ref) return null;
  const map = (typeof window !== 'undefined' ? (window as any).__ICONS__ : null) as Record<string, string> | null;
  if (map && map[ref]) return map[ref];
  // Dev/served fallback: "aws-icons/x.svg" keeps its prefix, bare names go under /icons/.
  return ref.includes('/') ? '/' + ref : '/icons/' + ref;
}

// SVGs under aws-icons/ are monochrome and recolored via the icon-filter CSS var
// in dark mode; base64 data-URIs and Arch_*.png are full-color and must not be filtered.
export function iconFilter(ref?: string): string {
  if (ref && ref.startsWith('aws-icons/')) return 'var(--icon-filter, none)';
  return 'none';
}
