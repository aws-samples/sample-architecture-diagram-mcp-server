// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = readFileSync(join(__dirname, '../dist/index.html'), 'utf-8');

// service name -> icon filename map (175 AWS services, auto-built from the icon set).
// Lets the agent omit `icon`: we resolve it from the service display name.
export const SERVICE_ICONS = JSON.parse(readFileSync(join(__dirname, 'service-icons.json'), 'utf-8'));

// AWS4 `shape` -> icon filename map (mirrors the list_shapes catalog + a few
// generic primitives like users/endpoint/*_gateway). The .drawio path already
// keys off `shape`; this lets the interactive HTML path fall back to it when a
// service display name doesn't resolve (e.g. "On-prem client" with shape:users).
export const SHAPE_ICONS = JSON.parse(readFileSync(join(__dirname, 'shape-icons.json'), 'utf-8'));

// Resolve a service display name to its icon reference (exact, then prefix-insensitive).
export function iconForService(name) {
  if (!name) return null;
  if (SERVICE_ICONS[name]) return SERVICE_ICONS[name];
  const bare = name.replace(/^(Amazon|AWS)\s+/i, '').toLowerCase();
  for (const [svc, file] of Object.entries(SERVICE_ICONS)) {
    if (svc.replace(/^(Amazon|AWS)\s+/i, '').toLowerCase() === bare) return file;
  }
  return null;
}

// Resolve an AWS4 shape name to its icon reference. Used as a fallback so a node
// with a valid `shape` always renders an icon even when its display name is free
// text that isn't in the service catalog.
export function iconForShape(shape) {
  if (!shape) return null;
  return SHAPE_ICONS[String(shape).toLowerCase()] || null;
}

// Icon assets are organized as <ICON_ROOT>/{icons,aws-icons,tech-icons}/.
// A standalone HTML opened via file:// cannot resolve absolute "/icons/..." paths,
// so we inline every icon used by the diagram as a base64 data-URI.
// ICON_ROOT resolution order:
//   1. AWS_DIAGRAM_ICON_ROOT env var (explicit override)
//   2. <package>/assets  (default — populated by scripts/fetch-icons.sh)
const ICON_ROOT = process.env.AWS_DIAGRAM_ICON_ROOT || join(__dirname, '..', 'assets');

// Group/container icons referenced by variants (must mirror ALL_GROUP_ICONS in
// src/lib/groupVariants.ts). All are inlined so any container type renders.
const GROUP_ICONS = [
  'AWS-Cloud_32.png',
  'Region_32.png',
  'Virtual-private-cloud-VPC_32.png',
  'Public-subnet_32.png',
  'Private-subnet_32.png',
  'AWS-Account_32.png',
  'Auto-Scaling-group_32.png',
  'Corporate-data-center_32.png',
];

const MIME = { '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif' };

/**
 * Resolve an icon reference to an absolute file path.
 *  - "aws-icons/user.svg" / "tech-icons/x.svg"  -> ICON_ROOT/<as-is>
 *  - "Arch_X_48.png"                            -> ICON_ROOT/icons/<name>
 */
function iconPath(ref) {
  if (ref.includes('/')) return join(ICON_ROOT, ref);
  return join(ICON_ROOT, 'icons', ref);
}

function toDataUri(ref) {
  try {
    const p = iconPath(ref);
    if (!existsSync(p)) return null;
    const ext = extname(p).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const buf = readFileSync(p);
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Build a { iconRef -> dataUri } map for every icon the diagram needs:
 * service icons, the user node, and all group decorations.
 */
function buildIconMap(services, steps, groups) {
  const refs = new Set(GROUP_ICONS);
  for (const s of services || []) {
    if (s && s.icon) refs.add(s.icon);
  }
  // A group can override its container glyph with a specific service icon
  // (e.g. Cluster EKS showing the EKS icon in its header). Those refs are not
  // in GROUP_ICONS, so inline them too or they break under file://.
  for (const g of groups || []) {
    if (g && g.icon && g.icon !== 'none') refs.add(g.icon);
  }
  // Guided-walkthrough overlay: the StepCard renders an icon for the step and
  // for each chip via resolveIcon(), so those refs must be inlined too or they
  // break under file:// in the standalone HTML.
  for (const step of steps || []) {
    if (step && step.icon) refs.add(step.icon);
    for (const c of (step && step.chips) || []) {
      if (c && c.icon) refs.add(c.icon);
    }
  }
  const map = {};
  const missing = [];
  for (const ref of refs) {
    const uri = toDataUri(ref);
    if (uri) map[ref] = uri;
    else missing.push(ref);
  }
  return { map, missing };
}

export function generateHtml(title, subtitle, services, connections, options = {}) {
  // Auto-resolve icons: if a service has no explicit `icon`, derive it from the
  // service name via the SERVICE_ICONS map. Externals/users keep their own refs.
  const resolved = (services || []).map(s => {
    if (s && !s.icon && !s.external && s.id !== 'users') {
      // Try the display name first (most specific), then fall back to the
      // AWS4 `shape` so free-text names still get a sensible icon.
      const f = iconForService(typeof s.service === 'string' ? s.service : (s.service?.en || s.service?.pt))
        || iconForShape(s.shape);
      if (f) return { ...s, icon: f };
    }
    return s;
  });
  const archData = JSON.stringify({
    title, subtitle, services: resolved, connections,
    direction: options.direction || 'TB',
    groups: options.groups || [],
    // Optional guided walkthrough (nodes/edges/groups tinted per beat + overlay card).
    ...(options.steps ? { steps: options.steps } : {}),
    ...(options.stepFocus ? { stepFocus: true } : {}),
    ...(options.stepZoom ? { stepZoom: true } : {}),
  });
  const { map, missing } = buildIconMap(resolved, options.steps, options.groups);
  if (missing.length) {
    // Surface unresolved icons so the agent can fix the reference instead of
    // silently shipping a diagram with blank nodes.
    console.error(`[aws-live-diagram] icons not found (rendered as fallback initials): ${missing.join(', ')}`);
  }
  return TEMPLATE
    .replace('{{ARCH_DATA}}', archData)
    .replace('{{ICON_DATA}}', JSON.stringify(map));
}
