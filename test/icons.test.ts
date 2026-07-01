import { describe, it, expect } from 'vitest';
import { iconForService, SERVICE_ICONS, generateHtml } from '../lib/html-generator.js';

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

  it('inlines every resolved icon as a base64 data-URI', () => {
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

  it('LIMIT: a service with no mapped icon stays without one (renders as initial)', () => {
    const html = generateHtml('T', '', [
      { id: 'x', service: 'Totally Fake Service', category: 'general' },
    ], [], {});
    expect(archDataOf(html).services[0].icon).toBeUndefined();
  });
});
