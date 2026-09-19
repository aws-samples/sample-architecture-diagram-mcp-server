// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain JS module, no types
import { generateSequenceHtml } from '../lib/sequence-generator.js';

const seq = (over: any = {}) => generateSequenceHtml({
  title: 'Login flow',
  participants: [{ id: 'u', label: 'User' }, { id: 's', label: 'Service' }],
  messages: [{ from: 'u', to: 's', label: 'auth', title: 'Authenticate' }],
  ...over,
});

describe('generateSequenceHtml — WebM walkthrough export', () => {
  it('ships a REC button wired to MediaRecorder + canvas.captureStream', () => {
    const html = seq();
    expect(html).toContain('id="dlwebm"');
    expect(html).toContain('MediaRecorder');
    expect(html).toContain('captureStream');
    expect(html).toContain('sequence-walkthrough');
    expect(html).toMatch(/\.webm/);
  });

  it('feature-detects support and degrades to a disabled button', () => {
    const html = seq();
    expect(html).toContain('isTypeSupported');
    expect(html).toContain('WebM recording not supported in this browser');
    expect(html).toContain('btn.disabled = true');
  });

  it('adds no external dependency for the recorder (still self-contained)', () => {
    const html = seq();
    expect(html).not.toMatch(/<script\s+[^>]*src=/i);
    expect(html).not.toMatch(/https?:\/\/[^"']*\.(js|css)/i);
  });
});
