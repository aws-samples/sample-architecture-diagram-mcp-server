// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain JS module, no types
import { iconForService, SERVICE_ICONS, generateHtml, iconResolutionReport } from '../lib/html-generator.js';
// @ts-expect-error — plain JS module, no types
import { iconRoot, hasIcons } from '../lib/icon-root.js';

// The AWS Architecture Icons aren't redistributed (their Terms of Use), so a
// fresh clone / CI has none. Base64-inlining assertions only apply when the icons
// are present; gate them on the same resolver the generator uses (repo assets/ or
// the shared per-machine cache) so the suite is green either way.
const ICONS_PRESENT = hasIcons(iconRoot());

// Pull the inlined icon map back out of a generated HTML for assertions.
function iconMapOf(html: string): Record<string, string> {
  const m = html.match(/id="icon-data"[^>]*>([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : {};
}
function archDataOf(html: string): any {
  const m = html.match(/id="arch-data"[^>]*>([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : {};
}

describe('iconForService', () => {
  it('resolves common services to official Arch_ icons', () => {
    expect(iconForService('Amazon RDS')).toBe('Arch_Amazon-RDS_48.png');
    expect(iconForService('AWS Lambda')).toBe('Arch_AWS-Lambda_48.png');
    expect(iconForService('Amazon S3')).toBe('Arch_Amazon-Simple-Storage-Service_48.png');
  });

  it('matches case- and prefix-insensitively', () => {
    // ECS maps via alias to the full Elastic Container Service icon
    expect(iconForService('Amazon ECS')).toBe('Arch_Amazon-Elastic-Container-Service_48.png');
  });

  it('returns null for an unknown service (caller falls back to initial)', () => {
    expect(iconForService('Totally Fake Service')).toBeNull();
    expect(iconForService('')).toBeNull();
    expect(iconForService(undefined as any)).toBeNull();
  });

  // The generic people icons are the only ones shipped with a _Light theme suffix
  // ("Res_Users_48_Light.png"). That suffix used to survive normalization, making
  // the icon's token set {users,48,light} wider than the query {users} — so the
  // most common actor node in any diagram silently rendered as a bare letter.
  it.runIf(ICONS_PRESENT)('resolves the generic Users/User actors past the _Light theme suffix', () => {
    expect(iconForService('Users')).toBe('Res_Users_48_Light.png');
    expect(iconForService('User')).toBe('Res_User_48_Light.png');
    expect(iconForService('users')).toBe('Res_Users_48_Light.png');
  });

  it('maps the full Arch_ icon set (300+) and points only at real files', () => {
    expect(Object.keys(SERVICE_ICONS).length).toBeGreaterThanOrEqual(300);
    // every mapped value is a filename (png) or a prefixed svg path
    for (const v of Object.values(SERVICE_ICONS)) {
      expect(v).toMatch(/\.(png|svg)$/);
    }
  });
});

describe('generateHtml — icon auto-resolution', () => {
  it('fills icon from the service name when omitted', () => {
    const html = generateHtml('T', '', [
      { id: 'db', service: 'Amazon RDS', category: 'database' },
    ], [], {});
    const svc = archDataOf(html).services[0];
    expect(svc.icon).toBe('Arch_Amazon-RDS_48.png');
  });

  it.runIf(ICONS_PRESENT)('inlines every resolved icon as a base64 data-URI', () => {
    const html = generateHtml('T', '', [
      { id: 'fn', service: 'AWS Lambda', category: 'compute' },
    ], [], {});
    const map = iconMapOf(html);
    expect(map['Arch_AWS-Lambda_48.png']).toMatch(/^data:image\/png;base64,/);
  });

  it('keeps explicit external icons (e.g. Users) and does not overwrite them', () => {
    const html = generateHtml('T', '', [
      { id: 'users', service: 'Users', category: 'general', external: true, icon: 'Res_Users_48_Light.png' },
    ], [], {});
    expect(archDataOf(html).services[0].icon).toBe('Res_Users_48_Light.png');
  });

  // Regression: icon resolution used to skip `external: true` nodes on the
  // assumption that an external always brings its own `icon`. It doesn't — the
  // canonical "Users" actor is external and iconless, so it rendered as a letter.
  it.runIf(ICONS_PRESENT)('resolves an icon for an EXTERNAL node that did not bring one', () => {
    const html = generateHtml('T', '', [
      { id: 'u', service: 'Users', category: 'general', external: true },
      { id: 'dc', service: 'Corporate data center', category: 'general', external: true },
    ], [], {});
    const [u, dc] = archDataOf(html).services;
    expect(u.icon).toBe('Res_Users_48_Light.png');
    expect(dc.icon).toBe('Corporate-data-center_32.png');
    expect(iconMapOf(html)['Res_Users_48_Light.png']).toMatch(/^data:image\/png;base64,/);
  });

  it('leaves a third-party external with no AWS icon as an initial, and does not warn', () => {
    const services = [{ id: 'p', service: 'Stripe', category: 'general', external: true }];
    const html = generateHtml('T', '', services, [], {});
    expect(archDataOf(html).services[0].icon).toBeUndefined();
    // externals are excluded from the unresolved-icon warning on purpose
    expect(iconResolutionReport(services)).toEqual([]);
  });

  it('LIMIT: a service with no mapped icon stays without one (renders as initial)', () => {
    const html = generateHtml('T', '', [
      { id: 'x', service: 'Totally Fake Service', category: 'general' },
    ], [], {});
    expect(archDataOf(html).services[0].icon).toBeUndefined();
  });
});
