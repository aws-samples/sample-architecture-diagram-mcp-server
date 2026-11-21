// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Browser page for core-react-browser.test.ts: mounts one core component per
// scenario (?s=…) under <CoreHostProvider> with RECORDING fake ports (or, for
// s=default-*, with no provider at all), and exposes what the ports saw on
// window.__calls. Bundled by the test with esbuild ("source" condition).
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CoreHostProvider, AppShell, LiveDiagram, CodeBlocks, SequencePlayer } from '@aws-sample-live-diagram/core/react';
import type { Clipboard, Environment, FileSaver, UrlState } from '@aws-sample-live-diagram/core';

interface Calls { clipboard: string[]; urls: string[]; saved: { filename: string; kind: 'url' | 'blob'; type: string; head: string }[]; env: string[] }
interface PageWindow { __calls: Calls; __navigate: (hash: string) => void; __fullscreen: () => boolean }
const w = window as unknown as Window & PageWindow;
const calls: Calls = { clipboard: [], urls: [], saved: [], env: [] };
w.__calls = calls;

const params = new URLSearchParams(location.search);
const scenario = params.get('s') || '';
let hash = params.get('hash') ? `#${params.get('hash')}` : '';
const hashListeners = new Set<() => void>();
const urlState: UrlState = {
  readHash: () => hash,
  readPathAndQuery: () => '/page.html',
  replaceUrl: (url) => { calls.urls.push(url); const i = url.indexOf('#'); hash = i < 0 ? '' : url.slice(i); },
  subscribeHash: (l) => { hashListeners.add(l); return () => { hashListeners.delete(l); }; },
};
w.__navigate = (next) => { hash = next; for (const l of [...hashListeners]) l(); };
const clipboard: Clipboard = { writeText: (t) => { calls.clipboard.push(t); } };
const fileSaver: FileSaver = {
  saveUrl: (filename, url) => { calls.saved.push({ filename, kind: 'url', type: url.slice(0, url.indexOf(',')), head: url.slice(0, 30) }); },
  saveBlob: (filename, blob) => { calls.saved.push({ filename, kind: 'blob', type: blob.type, head: '' }); void blob.text().then((t) => { calls.saved[calls.saved.length - 1].head = t.slice(0, 60); }); },
};
let fullscreen = false;
const fsListeners = new Set<() => void>();
const environment: Environment = {
  prefersReducedMotion: () => { calls.env.push('prefersReducedMotion'); return params.get('reduced') === '1'; },
  isFullscreen: () => fullscreen,
  requestFullscreen: () => { calls.env.push('requestFullscreen'); fullscreen = true; for (const l of fsListeners) l(); return Promise.resolve(); },
  exitFullscreen: () => { calls.env.push('exitFullscreen'); fullscreen = false; for (const l of fsListeners) l(); },
  subscribeFullscreen: (l) => { fsListeners.add(l); return () => { fsListeners.delete(l); }; },
};
w.__fullscreen = () => fullscreen;
const ports = { urlState, clipboard, fileSaver, environment };

const U = (e: string) => `https://calculator.aws/#/estimate?id=${e}`;
const diagram = {
  title: 'Orders', subtitle: 'Serverless',
  services: [{ id: 'api', service: 'Amazon API Gateway' }, { id: 'fn', service: 'AWS Lambda' }, { id: 'db', service: 'Amazon DynamoDB' }],
  connections: [{ id: 'c1', source: 'api', target: 'fn' }, { id: 'c2', source: 'fn', target: 'db' }],
  costs: [{ id: 'poc', env: 'poc', label: 'PoC', url: U('poc') }, { id: 'prod', env: 'prod', label: 'Production', url: U('prod'), default: true }],
};
const steps = [{ title: 'Beat one', nodes: ['api'] }, { title: 'Beat two', nodes: ['fn'] }, { title: 'Beat three', nodes: ['db'] }];
const seq = {
  title: 'Flow',
  participants: [{ id: 'u', label: 'User', actor: true }, { id: 'a', label: 'API' }],
  events: [{ kind: 'message', id: 'm1', from: 'u', to: 'a', label: 'hello' }, { kind: 'message', id: 'm2', from: 'a', to: 'u', label: 'ok', arrow: 'reply' }],
};
const app = { pages: [{ id: 'overview', label: 'Overview' }, { id: 'costs', label: 'Costs' }] };

const el = (() => {
  switch (scenario) {
    case 'codeblocks': return <CodeBlocks blocks={[{ id: 'b1', label: 'a.py', lang: 'python', code: 'print(1)' }]} />;
    case 'appshell': return <AppShell app={app} />;
    case 'live': return <div style={{ width: 1200, height: 800 }}><LiveDiagram data={diagram} steps={steps} chrome control="auto" theme="self" /></div>;
    case 'sequence': return <div style={{ width: 1000, height: 700 }}><SequencePlayer seq={seq as never} /></div>;
    case 'default-live': return <div style={{ width: 1200, height: 800 }}><LiveDiagram data={diagram} steps={steps} chrome control="auto" theme="self" /></div>;
    case 'default-codeblocks': return <CodeBlocks blocks={[{ id: 'b1', label: 'a.py', lang: 'python', code: 'print(1)' }]} />;
    default: return <div>unknown scenario</div>;
  }
})();

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(scenario.startsWith('default-') ? el : <CoreHostProvider ports={ports}>{el}</CoreHostProvider>);
