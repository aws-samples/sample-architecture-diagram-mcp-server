// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// service-configs.json drives the list_service_configs tool. Adapted from the
// original ArcFlow app's service-configs coverage test (which depended on app
// internals the MCP doesn't have).
const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIGS = JSON.parse(readFileSync(join(__dirname, '..', 'lib', 'service-configs.json'), 'utf-8'));

describe('service-configs.json integrity', () => {
  it('is a non-empty array of {service, fields}', () => {
    expect(Array.isArray(CONFIGS)).toBe(true);
    expect(CONFIGS.length).toBeGreaterThan(0);
    for (const c of CONFIGS) {
      expect(typeof c.service).toBe('string');
      expect(Array.isArray(c.fields)).toBe(true);
    }
  });

  it('every field has a valid type', () => {
    const valid = new Set(['text', 'select', 'number', 'boolean']);
    for (const c of CONFIGS) {
      for (const f of c.fields) {
        expect(f.key, `${c.service} field missing key`).toBeTruthy();
        expect(valid.has(f.type), `${c.service}.${f.key} has invalid type "${f.type}"`).toBe(true);
        if (f.type === 'select') {
          expect(Array.isArray(f.options), `${c.service}.${f.key} select needs options`).toBe(true);
        }
      }
    }
  });

  it('has no duplicate service entries', () => {
    const names = CONFIGS.map((c: any) => c.service);
    expect(new Set(names).size).toBe(names.length);
  });

  it('covers core services', () => {
    const names = new Set(CONFIGS.map((c: any) => c.service));
    for (const svc of ['Amazon RDS', 'AWS Lambda', 'Amazon DynamoDB', 'Amazon S3']) {
      expect(names.has(svc), `missing config: ${svc}`).toBe(true);
    }
  });
});
