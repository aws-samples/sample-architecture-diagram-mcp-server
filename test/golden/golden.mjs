// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Golden snapshot of what a release produces WITHOUT any of the newer optional
// fields: each example spec rendered through the real MCP server (stdio), and
// the core's React components rendered server-side with fixed props. The
// fixtures in test/golden/fixtures were captured from the commit before the
// layout/cost work; test/golden.test.ts re-runs this against the working tree.
//
//   node test/golden/golden.mjs <repoRoot> <out.json> [extra-spec.json ...]
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join, basename, resolve } from 'path';
import { tmpdir } from 'os';
import { pathToFileURL } from 'url';

const archDataOf = (html) => JSON.parse(html.match(/id="arch-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
const iconKeysOf = (html) => Object.keys(JSON.parse(html.match(/id="icon-data"[^>]*>([\s\S]*?)<\/script>/)[1])).sort();

export async function renderExamples(root, extraSpecs = []) {
  const { Client } = await import(pathToFileURL(join(root, 'node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js')).href);
  const { StdioClientTransport } = await import(pathToFileURL(join(root, 'node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js')).href);
  const transport = new StdioClientTransport({ command: process.execPath, args: [join(root, 'mcp-server.js')], cwd: root, stderr: 'ignore' });
  const client = new Client({ name: 'golden', version: '1' });
  await client.connect(transport);
  const tmp = mkdtempSync(join(tmpdir(), 'golden-'));
  const out = {};
  try {
    const specs = readdirSync(join(root, 'examples')).filter(f => f.endsWith('.json')).sort().map(f => [f, join(root, 'examples', f)]);
    for (const p of extraSpecs) specs.push([basename(p), resolve(p)]);
    for (const [name, file] of specs) {
      const spec = JSON.parse(readFileSync(file, 'utf-8'));
      delete spec.outputPath;
      const outputPath = join(tmp, name.replace(/\.json$/, '.html'));
      const res = await client.callTool({ name: 'generate_html_diagram', arguments: { ...spec, outputPath } });
      const text = res.content.map(c => c.text).join('\n').split(tmp).join('<tmp>');
      let html = null;
      try { html = readFileSync(outputPath, 'utf-8'); } catch { /* the tool rejected the input */ }
      out[name] = html ? { archData: archDataOf(html), iconKeys: iconKeysOf(html), text } : { isError: !!res.isError, text };
    }
    // The incremental builder path, same input as serverless-api.json.
    const sv = JSON.parse(readFileSync(join(root, 'examples', 'serverless-api.json'), 'utf-8'));
    const created = await client.callTool({ name: 'diagram_create', arguments: { title: sv.title, subtitle: sv.subtitle, direction: sv.direction } });
    const draftId = created.content[0].text.match(/Created (d\d+)/)[1];
    await client.callTool({ name: 'diagram_add_services', arguments: { draftId, services: sv.services } });
    await client.callTool({ name: 'diagram_add_connections', arguments: { draftId, connections: sv.connections } });
    if (sv.groups) await client.callTool({ name: 'diagram_add_groups', arguments: { draftId, groups: sv.groups } });
    await client.callTool({ name: 'diagram_add_steps', arguments: { draftId, steps: [{ title: 'One', nodes: [sv.services[0].id] }] } });
    const outputPath = join(tmp, 'draft.html');
    const res = await client.callTool({ name: 'diagram_render', arguments: { draftId, outputPath } });
    const html = readFileSync(outputPath, 'utf-8');
    out['draft:serverless-api'] = { archData: archDataOf(html), iconKeys: iconKeysOf(html), text: res.content.map(c => c.text).join('\n').split(tmp).join('<tmp>') };
    const { tools } = await client.listTools();
    out.__tools = Object.fromEntries(tools.map(t => [t.name, t.inputSchema]));
  } finally {
    await client.close();
    rmSync(tmp, { recursive: true, force: true });
  }
  return out;
}

export async function renderComponents(root) {
  // Runs under vitest (the core bundle imports CSS, which plain Node cannot load).
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const core = await import(/* @vite-ignore */ pathToFileURL(join(root, 'packages/diagram-core/dist/react.js')).href);
  const { ReactFlowProvider } = await import('@xyflow/react');
  const h = React.createElement;
  const flow = (el) => renderToStaticMarkup(h(ReactFlowProvider, null, el));
  const step = {
    eyebrow: '1 · Edge', title: 'Edge', body: 'Requests **arrive** at the `CDN`.', bullets: ['one', { strong: 'Lead', text: 'two' }],
    process: [{ label: 'A', text: 'first' }, { label: 'B', text: 'second', ok: true }], code: 'GET /', codeLabel: 'HTTP',
    sections: [{ title: 'Notes', body: 'Body', bullets: ['x'] }], chips: [{ label: 'ok', ok: true }, { label: 'warn', ok: 'warn' }],
  };
  return {
    zoomBar: flow(h(core.ZoomBar, { title: 'Title', subtitle: 'Sub', visible: true, hasWalk: true, languages: ['en', 'pt'], lang: 'en' })),
    zoomBarHidden: flow(h(core.ZoomBar, { title: 'Title', visible: false })),
    zoomBarNoWalk: flow(h(core.ZoomBar, { title: 'Title', visible: true, hasWalk: false })),
    stepCard: renderToStaticMarkup(h(core.StepCard, { steps: [step, { title: 'Two' }], activeStep: 0 })),
    stepCardFull: renderToStaticMarkup(h(core.StepCard, { steps: [{ ...step, cardSide: 'full' }], activeStep: 0, onToggleExpand: () => {} })),
    nodeModal: renderToStaticMarkup(h(core.NodeModal, { node: { id: 'db', label: 'DB', service: 'Amazon DynamoDB', category: 'database', role: 'Stores data', config: { iac: { billing: 'on-demand' }, pricing: { wcu: 100 } } }, onClose: () => {} })),
    caption: renderToStaticMarkup(h(core.DiagramCaption, { caption: { eyebrow: 'Ref', title: 'Caption', text: 'Text', meta: ['Version: v1', 'prod'] } })),
  };
}

// CLI: capture the example renders (components are captured by
// GOLDEN_CAPTURE=1 GOLDEN_ROOT=<root> npx vitest run test/golden.test.ts).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [root, outFile, ...extra] = process.argv.slice(2);
  const examples = await renderExamples(resolve(root), extra);
  writeFileSync(outFile, JSON.stringify({ examples }, null, 2) + '\n');
  console.log(`wrote ${outFile}: ${Object.keys(examples).length} specs`);
}
