// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The browser adapters of the presentation ports, in Node: with no window /
// document / navigator (SSR) they are inert, and over stand-in globals they make
// exactly the browser calls the components used to make themselves. The same
// adapters run in a real Chromium in core-react-browser.test.ts.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { browserUrlState, browserClipboard, browserFileSaver, browserEnvironment } from '@aws-sample-live-diagram/core/react';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function fakeWindow(href = { pathname: '/d.html', search: '?x=1', hash: '#env=poc' }) {
  const listeners = new Map<string, Set<() => void>>();
  const replaced: string[] = [];
  const win = {
    location: { ...href },
    history: { replaceState: (_s: unknown, _t: string, url: string) => { replaced.push(url); const i = url.indexOf('#'); win.location.hash = i < 0 ? '' : url.slice(i); } },
    addEventListener: (t: string, l: () => void) => { if (!listeners.has(t)) listeners.set(t, new Set()); listeners.get(t)!.add(l); },
    removeEventListener: (t: string, l: () => void) => { listeners.get(t)?.delete(l); },
    matchMedia: (q: string) => ({ matches: q === '(prefers-reduced-motion: reduce)' }),
    fire: (t: string) => { for (const l of listeners.get(t) || []) l(); },
    count: (t: string) => listeners.get(t)?.size ?? 0,
  };
  return { win, replaced };
}

describe('without a browser (SSR / Node)', () => {
  it('UrlState reads an empty URL, writes nothing, subscribes to nothing', () => {
    expect(typeof window).toBe('undefined');
    expect(browserUrlState.readHash()).toBe('');
    expect(browserUrlState.readPathAndQuery()).toBe('');
    expect(() => browserUrlState.replaceUrl('#x')).not.toThrow();
    const off = browserUrlState.subscribeHash(() => {});
    expect(() => off()).not.toThrow();
  });
  it('Clipboard and Environment are inert', () => {
    expect(() => browserClipboard.writeText('x')).not.toThrow();
    expect(browserEnvironment.prefersReducedMotion()).toBe(false);
    expect(browserEnvironment.isFullscreen()).toBe(false);
    expect(() => browserEnvironment.exitFullscreen()).not.toThrow();
    expect(() => browserEnvironment.subscribeFullscreen(() => {})()).not.toThrow();
  });
  it('requestFullscreen resolves when the target has no Fullscreen API', async () => {
    await expect(browserEnvironment.requestFullscreen({})).resolves.toBeUndefined();
  });
});

describe('UrlState over window.location / history', () => {
  it('reads the hash and the path + query', () => {
    const { win } = fakeWindow();
    vi.stubGlobal('window', win);
    expect(browserUrlState.readHash()).toBe('#env=poc');
    expect(browserUrlState.readPathAndQuery()).toBe('/d.html?x=1');
  });
  it('replaces the history entry (no navigation)', () => {
    const { win, replaced } = fakeWindow();
    vi.stubGlobal('window', win);
    browserUrlState.replaceUrl('#env=prod');
    expect(replaced).toEqual(['#env=prod']);
    expect(browserUrlState.readHash()).toBe('#env=prod');
  });
  it('is a no-op when history.replaceState is missing', () => {
    const { win } = fakeWindow();
    vi.stubGlobal('window', { ...win, history: undefined });
    expect(() => browserUrlState.replaceUrl('#a')).not.toThrow();
  });
  it('subscribes to hashchange and unsubscribes', () => {
    const { win } = fakeWindow();
    vi.stubGlobal('window', win);
    let n = 0;
    const off = browserUrlState.subscribeHash(() => { n++; });
    win.fire('hashchange');
    expect(n).toBe(1);
    off();
    expect(win.count('hashchange')).toBe(0);
    win.fire('hashchange');
    expect(n).toBe(1);
  });
});

describe('Clipboard over navigator.clipboard', () => {
  it('writes the text', () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    browserClipboard.writeText('copied');
    expect(writeText).toHaveBeenCalledWith('copied');
  });
  it('swallows a rejection and a throw (file://)', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('blocked')) } });
    expect(() => browserClipboard.writeText('x')).not.toThrow();
    vi.stubGlobal('navigator', { clipboard: { writeText: () => { throw new Error('denied'); } } });
    expect(() => browserClipboard.writeText('x')).not.toThrow();
    vi.stubGlobal('navigator', {});
    expect(() => browserClipboard.writeText('x')).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});

describe('FileSaver over a temporary <a download>', () => {
  function fakeDocument() {
    const log: string[] = [];
    const doc = {
      createElement: (tag: string) => {
        const a = { tag, href: '', download: '', click: () => log.push(`click ${a.download} ${a.href}`) };
        return a;
      },
      body: { appendChild: () => log.push('append'), removeChild: () => log.push('remove') },
    };
    return { doc, log };
  }
  it('saveUrl attaches, clicks and detaches an anchor', () => {
    const { doc, log } = fakeDocument();
    vi.stubGlobal('document', doc);
    browserFileSaver.saveUrl('architecture.png', 'data:image/png;base64,AAA');
    expect(log).toEqual(['append', 'click architecture.png data:image/png;base64,AAA', 'remove']);
  });
  it('saveBlob clicks an object URL and revokes it a second later', () => {
    vi.useFakeTimers();
    const { doc, log } = fakeDocument();
    vi.stubGlobal('document', doc);
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:fake/1');
    browserFileSaver.saveBlob('sequence-diagram.svg', new Blob(['<svg/>']));
    expect(log).toEqual(['click sequence-diagram.svg blob:fake/1']);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledWith('blob:fake/1');
    vi.restoreAllMocks();
  });
});

describe('Environment over matchMedia and the Fullscreen API', () => {
  it('reads prefers-reduced-motion', () => {
    const { win } = fakeWindow();
    vi.stubGlobal('window', win);
    expect(browserEnvironment.prefersReducedMotion()).toBe(true);
    vi.stubGlobal('window', { ...win, matchMedia: () => ({ matches: false }) });
    expect(browserEnvironment.prefersReducedMotion()).toBe(false);
    vi.stubGlobal('window', { ...win, matchMedia: undefined });
    expect(browserEnvironment.prefersReducedMotion()).toBe(false);
  });
  it('fullscreen state, request, exit and the change event', async () => {
    const listeners = new Set<() => void>();
    const doc = {
      fullscreenElement: null as unknown,
      exitFullscreen: vi.fn(() => { doc.fullscreenElement = null; return Promise.resolve(); }),
      addEventListener: (_t: string, l: () => void) => listeners.add(l),
      removeEventListener: (_t: string, l: () => void) => listeners.delete(l),
    };
    vi.stubGlobal('document', doc);
    const target = { requestFullscreen: vi.fn(() => { doc.fullscreenElement = target; return Promise.resolve(); }) };
    let changes = 0;
    const off = browserEnvironment.subscribeFullscreen(() => { changes++; });
    expect(browserEnvironment.isFullscreen()).toBe(false);
    await browserEnvironment.requestFullscreen(target);
    expect(target.requestFullscreen).toHaveBeenCalled();
    expect(browserEnvironment.isFullscreen()).toBe(true);
    for (const l of listeners) l();
    expect(changes).toBe(1);
    browserEnvironment.exitFullscreen();
    expect(doc.exitFullscreen).toHaveBeenCalled();
    expect(browserEnvironment.isFullscreen()).toBe(false);
    off();
    expect(listeners.size).toBe(0);
  });
});
