// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// In-memory fakes of the core's ports, for application and React tests: they
// record every call and answer deterministically.
import type {
  Clipboard, Environment, FileSaver, FullscreenTarget, LayeredGraph, LayeredLayout, LayeredLayoutEngine,
  LayoutEngine, LayoutGraph, LayoutGraphNode, UrlState,
} from '@aws-sample-live-diagram/core';

/** A UrlState over an in-memory URL; `navigate` simulates a typed hash / back-forward. */
export function fakeUrlState(initial = '/page.html') {
  const hashAt = initial.indexOf('#');
  let path = hashAt < 0 ? initial : initial.slice(0, hashAt);
  let hash = hashAt < 0 ? '' : initial.slice(hashAt);
  const listeners = new Set<() => void>();
  const writes: string[] = [];
  const port: UrlState = {
    readHash: () => hash,
    readPathAndQuery: () => path,
    replaceUrl: (url) => {
      writes.push(url);
      const i = url.indexOf('#');
      if (i < 0) { path = url || path; hash = ''; } else { if (i > 0) path = url.slice(0, i); hash = url.slice(i) === '#' ? '' : url.slice(i); }
    },
    subscribeHash: (l) => { listeners.add(l); return () => listeners.delete(l); },
  };
  return {
    port, writes,
    get hash() { return hash; },
    get listeners() { return listeners.size; },
    navigate(next: string) { hash = next; for (const l of [...listeners]) l(); },
  };
}

export function fakeClipboard() {
  const texts: string[] = [];
  const port: Clipboard = { writeText: (t) => { texts.push(t); } };
  return { port, texts };
}

export function fakeFileSaver() {
  const saved: { filename: string; url?: string; blob?: Blob }[] = [];
  const port: FileSaver = {
    saveUrl: (filename, url) => { saved.push({ filename, url }); },
    saveBlob: (filename, blob) => { saved.push({ filename, blob }); },
  };
  return { port, saved };
}

export function fakeEnvironment({ reducedMotion = false } = {}) {
  let fullscreen = false;
  const listeners = new Set<() => void>();
  const calls: string[] = [];
  const fire = () => { for (const l of [...listeners]) l(); };
  const port: Environment = {
    prefersReducedMotion: () => { calls.push('prefersReducedMotion'); return reducedMotion; },
    isFullscreen: () => fullscreen,
    requestFullscreen: (_t: FullscreenTarget) => { calls.push('requestFullscreen'); fullscreen = true; fire(); return Promise.resolve(); },
    exitFullscreen: () => { calls.push('exitFullscreen'); fullscreen = false; fire(); },
    subscribeFullscreen: (l) => { listeners.add(l); return () => listeners.delete(l); },
  };
  return { port, calls, get fullscreen() { return fullscreen; }, get listeners() { return listeners.size; } };
}

/**
 * A compound LayoutEngine that stacks every container's children in a row
 * (LR) or column (TB, the default) with a fixed gap, sizing containers to fit
 * plus a fixed padding. Deterministic and synchronous underneath.
 */
export function fakeLayoutEngine({ gap = 20, pad = 10, reject = false } = {}) {
  const graphs: LayoutGraph[] = [];
  const place = (n: LayoutGraphNode, horizontal: boolean): LayoutGraphNode => {
    if (!n.children?.length) return { ...n, width: n.width ?? 10, height: n.height ?? 10 };
    let cursor = pad, cross = 0;
    const children = n.children.map((c) => {
      const p = place(c, horizontal);
      const out = horizontal ? { ...p, x: cursor, y: pad } : { ...p, x: pad, y: cursor };
      cursor += (horizontal ? p.width! : p.height!) + gap;
      cross = Math.max(cross, horizontal ? p.height! : p.width!);
      return out;
    });
    const main = cursor - gap + pad, side = cross + pad * 2;
    return { ...n, children, width: horizontal ? main : side, height: horizontal ? side : main };
  };
  const engine: LayoutEngine = {
    layout(graph) {
      graphs.push(graph);
      if (reject) return Promise.reject(new Error('fake engine refused'));
      const horizontal = graph.layoutOptions?.['elk.direction'] === 'RIGHT';
      const root = place(graph, horizontal);
      return Promise.resolve({ ...root, x: 0, y: 0, edges: (graph.edges || []).map((e) => ({ ...e })) });
    },
  };
  return { engine, graphs };
}

/** A LayeredLayoutEngine laying the nodes out in input order — a row (LR) or a
 *  column (TB) with a 40px gap; positions are CENTERS, like dagre's. */
export function fakeLayeredEngine() {
  const graphs: LayeredGraph[] = [];
  const engine: LayeredLayoutEngine = {
    layout(g): LayeredLayout {
      graphs.push(g);
      const lr = g.options.rankdir === 'LR';
      const nodes: LayeredLayout['nodes'] = {};
      let cursor = g.options.marginx, w = 0, h = 0;
      for (const n of g.nodes) {
        const box = lr
          ? { x: cursor + n.width / 2, y: g.options.marginy + n.height / 2, width: n.width, height: n.height }
          : { x: g.options.marginx + n.width / 2, y: cursor + n.height / 2, width: n.width, height: n.height };
        nodes[n.id] = box;
        cursor += (lr ? n.width : n.height) + 40;
        w = Math.max(w, box.x + n.width / 2); h = Math.max(h, box.y + n.height / 2);
      }
      const edges = g.edges.map((e) => {
        const a = nodes[e.source], b = nodes[e.target];
        return a && b ? { points: [{ x: a.x, y: a.y }, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, { x: b.x, y: b.y }], ...(e.label?.width ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : {}) } : undefined;
      });
      return { width: w + g.options.marginx, height: h + g.options.marginy, nodes, edges };
    },
  };
  return { engine, graphs };
}
