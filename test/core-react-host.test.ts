// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// <CoreHostProvider ports> and the components' default path, server-rendered:
// what a port answers at first render (the URL hash, the layered layout) shows
// up in the markup; without a provider the browser adapters and the production
// engines are used. Interactions (clicks, keys) run in Chromium:
// core-react-browser.test.ts.
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CoreHostProvider, useCoreHost, DEFAULT_CORE_HOST_PORTS, AppShell, LiveDiagram, CodeBlocks, cardKit,
  browserUrlState, browserClipboard, browserFileSaver, browserEnvironment,
} from '@aws-sample-live-diagram/core/react';
import type { CoreHostPorts } from '@aws-sample-live-diagram/core/react';
import { TypedDiagramView } from '@aws-sample-live-diagram/core/typed-react';
import { DIAGRAM_TYPES } from '@aws-sample-live-diagram/core/typed';
import { elkLayoutEngine, dagreLayeredEngine } from '@aws-sample-live-diagram/core/layout-engine';
import { fakeClipboard, fakeEnvironment, fakeFileSaver, fakeLayeredEngine, fakeUrlState } from './support/core-fakes';

const h = React.createElement;
const render = (el: React.ReactElement) => renderToStaticMarkup(el);

function Probe({ onPorts }: { onPorts: (p: CoreHostPorts) => void }) {
  onPorts(useCoreHost());
  return null;
}

describe('the ports in effect', () => {
  it('without a provider: the browser adapters and the production layout engines', () => {
    let seen: CoreHostPorts | null = null;
    render(h(Probe, { onPorts: (p) => { seen = p; } }));
    expect(seen).toBe(DEFAULT_CORE_HOST_PORTS);
    expect(DEFAULT_CORE_HOST_PORTS).toEqual({ urlState: browserUrlState, clipboard: browserClipboard, fileSaver: browserFileSaver, environment: browserEnvironment, layoutEngine: elkLayoutEngine, layeredLayout: dagreLayeredEngine });
    expect(Object.isFrozen(DEFAULT_CORE_HOST_PORTS)).toBe(true);
  });
  it('a provider replaces only the ports it names; nested providers merge outward-in', () => {
    const url = fakeUrlState(), clip = fakeClipboard(), env = fakeEnvironment();
    let seen: CoreHostPorts | null = null;
    render(h(CoreHostProvider, { ports: { urlState: url.port } }, h(CoreHostProvider, { ports: { clipboard: clip.port, environment: env.port } }, h(Probe, { onPorts: (p) => { seen = p; } }))));
    expect(seen!.urlState).toBe(url.port);
    expect(seen!.clipboard).toBe(clip.port);
    expect(seen!.environment).toBe(env.port);
    expect(seen!.fileSaver).toBe(browserFileSaver);
    expect(seen!.layoutEngine).toBe(elkLayoutEngine);
  });
  it('an inner provider wins over an outer one for the same port', () => {
    const outer = fakeFileSaver(), inner = fakeFileSaver();
    let seen: CoreHostPorts | null = null;
    render(h(CoreHostProvider, { ports: { fileSaver: outer.port } }, h(CoreHostProvider, { ports: { fileSaver: inner.port } }, h(Probe, { onPorts: (p) => { seen = p; } }))));
    expect(seen!.fileSaver).toBe(inner.port);
  });
});

describe('AppShell reads its page from the UrlState port', () => {
  const app = { pages: [{ id: 'overview', label: 'Overview' }, { id: 'costs', label: 'Costs' }] };
  const current = (html: string) => html.match(/aria-current="page"[^>]*>[\s\S]*?ld-app-nav-label">([^<]+)</)?.[1];
  it('a deep link to a known page opens it', () => {
    const url = fakeUrlState('/a.html#costs');
    expect(current(render(h(CoreHostProvider, { ports: { urlState: url.port } }, h(AppShell, { app }))))).toBe('Costs');
  });
  it('an unknown hash (or none) opens startPage, else the first page', () => {
    expect(current(render(h(CoreHostProvider, { ports: { urlState: fakeUrlState('/a.html#nope').port } }, h(AppShell, { app }))))).toBe('Overview');
    expect(current(render(h(CoreHostProvider, { ports: { urlState: fakeUrlState('/a.html').port } }, h(AppShell, { app: { ...app, startPage: 'costs' } }))))).toBe('Costs');
  });
  it('the default path (no provider, no window) renders the first page', () => {
    expect(current(render(h(AppShell, { app })))).toBe('Overview');
  });
});

describe('LiveDiagram reads the cost environment from the UrlState port', () => {
  const U = (e: string) => `https://calculator.aws/#/estimate?id=${e}`;
  const data = { title: 'T', services: [{ id: 'a', service: 'AWS Lambda' }], connections: [], costs: [{ id: 'poc', env: 'poc', url: U('poc') }, { id: 'prod', env: 'prod', url: U('prod'), default: true }] };
  const dock = (html: string) => html.match(/data-ld-cost="dock"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*data-ld-cost="dock"/)?.slice(1).find(Boolean);
  const diagram = () => h(LiveDiagram, { data, chrome: true, control: 'auto', theme: 'self' });
  it('#env=poc opens on poc', () => {
    const html = render(h(CoreHostProvider, { ports: { urlState: fakeUrlState('/d.html#env=poc').port } }, diagram()));
    expect(dock(html)?.replace(/&amp;/g, '&')).toBe(U('poc'));
  });
  it('without a deep link (and without a provider) the default estimate is used', () => {
    expect(dock(render(diagram()))?.replace(/&amp;/g, '&')).toBe(U('prod'));
    expect(dock(render(h(CoreHostProvider, { ports: { urlState: fakeUrlState('/d.html#env=staging').port } }, diagram())))?.replace(/&amp;/g, '&')).toBe(U('prod'));
  });
  it('reading the URL does not write it', () => {
    const url = fakeUrlState('/d.html#env=poc');
    render(h(CoreHostProvider, { ports: { urlState: url.port } }, diagram()));
    expect(url.writes).toEqual([]);
  });
});

describe('typed views take their layered layout from the port', () => {
  for (const kind of ['er', 'class'] as const) {
    it(`${kind}: the injected engine gets the graph and places the boxes`, () => {
      const fake = fakeLayeredEngine();
      const doc = DIAGRAM_TYPES[kind].empty();
      const withFake = render(h(CoreHostProvider, { ports: { layeredLayout: fake.engine } }, h(TypedDiagramView, { doc })));
      expect(fake.graphs).toHaveLength(1);
      expect(fake.graphs[0].multigraph).toBe(true);
      expect(fake.graphs[0].nodes.length).toBeGreaterThan(1);
      expect(fake.graphs[0].edges.every((e) => /^e\d+$/.test(e.name ?? ''))).toBe(true);
      const byDefault = render(h(TypedDiagramView, { doc }));
      expect(withFake).not.toBe(byDefault);
    });
    it(`${kind}: no provider = dagre (same markup as injecting the dagre adapter)`, () => {
      const doc = DIAGRAM_TYPES[kind].empty();
      expect(render(h(TypedDiagramView, { doc }))).toBe(render(h(CoreHostProvider, { ports: { layeredLayout: dagreLayeredEngine } }, h(TypedDiagramView, { doc }))));
    });
  }
  it('every typed kind renders with and without a provider (and the same without one)', () => {
    for (const [kind, spec] of Object.entries(DIAGRAM_TYPES)) {
      const doc = spec.empty();
      const a = render(h(TypedDiagramView, { doc })), b = render(h(CoreHostProvider, { ports: {} }, h(TypedDiagramView, { doc })));
      expect(a.length, kind).toBeGreaterThan(100);
      expect(a, kind).toBe(b);
    }
  });
});

describe('components that use the clipboard render on the default path', () => {
  it('CodeBlocks and cardKit.CodeBlock', () => {
    expect(render(h(CodeBlocks, { blocks: [{ id: 'b1', label: 'a.py', lang: 'python', code: 'print(1)' }] }))).toContain('print(1)');
    expect(render(h(cardKit.CodeBlock, { code: 'echo 1', label: 'sh' }))).toContain('echo 1');
  });
});
