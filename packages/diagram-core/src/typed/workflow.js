// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Typed diagram: workflow ───
// Workflow / data-flow / lifecycle graph — the SAME document the
// aws-live-diagram MCP's generate_workflow_diagram (and the dataflow /
// lifecycle variants) takes, rendered by the core's <FlowDiagram>: the React
// twin of the MCP's HTML flow player (one shared layout), so a flow pasted from
// an MCP-generated HTML (its `flow-data` JSON) renders here exactly as in the
// attachment. Nodes + directed edges (branches can converge), typed shapes,
// labelled edges and an optional narrated walkthrough (`steps`).
const tone = { type: 'string', enum: ['accent', 'info', 'success', 'warn', 'danger', 'neutral'], description: 'Cor de destaque' }
const ids = (ref, description) => ({ type: 'array', items: { type: 'string', 'x-ref': ref }, description })

export default {
  kind: 'workflow',
  label: 'Fluxo (workflow / DFD / ciclo de vida)',
  description: 'Grafo dirigido com decisões, tarefas e fins, arestas rotuladas e passo a passo narrado — o mesmo fluxo do aws-live-diagram MCP.',
  category: 'process',
  schema: {
    type: 'object',
    required: ['nodes', 'edges'],
    additionalProperties: false,
    properties: {
      type: { type: 'string', enum: ['workflow', 'dataflow', 'lifecycle'], 'x-label': 'Tipo', description: 'workflow (padrão), dataflow (DFD) ou lifecycle (estados): define a forma padrão dos nós e a legenda' },
      direction: { type: 'string', enum: ['TB', 'LR'], 'x-label': 'Direção', description: 'TB: de cima para baixo (padrão); LR: da esquerda para a direita' },
      nodes: {
        type: 'array', minItems: 1, maxItems: 160, 'x-label': 'Nós', 'x-item-title': 'label',
        items: {
          type: 'object', required: ['id', 'label'], additionalProperties: false,
          properties: {
            id: { type: 'string' },
            label: { type: 'string', description: 'Texto do nó (pode ser vazio em initial/final)' },
            sub: { type: 'string', description: 'Segunda linha, menor' },
            kind: { type: 'string', enum: ['box', 'start', 'task', 'decision', 'subprocess', 'wait', 'end', 'external', 'process', 'datastore', 'initial', 'state', 'choice', 'final'], description: 'Forma: start/end (cápsula), task, decision (losango), subprocess, wait, datastore (cilindro), initial/final (círculos)' },
            service: { type: 'string', description: 'Nome do serviço AWS (informativo; o ícone vem de `icon`)' },
            icon: { type: 'string', description: 'Ícone, ex.: Arch_Amazon-Elastic-Kubernetes-Service_48.png' },
            tone,
          },
        },
      },
      edges: {
        type: 'array', maxItems: 320, 'x-label': 'Arestas', 'x-item-title': 'label',
        items: {
          type: 'object', required: ['id', 'from', 'to'], additionalProperties: false,
          properties: {
            id: { type: 'string' },
            from: { type: 'string', 'x-ref': 'nodes[].id', description: 'Nó de origem' },
            to: { type: 'string', 'x-ref': 'nodes[].id', description: 'Nó de destino (igual à origem = laço)' },
            label: { type: 'string', description: 'Condição ou dado, ex.: [sim]' },
            kind: { type: 'string', enum: ['flow', 'branch', 'back', 'async'], description: 'flow/branch: seta sólida; back: retorno tracejado; async: ponta aberta' },
            dashed: { type: 'boolean', description: 'Força linha tracejada' },
            tone,
          },
        },
      },
      steps: {
        type: 'array', maxItems: 60, 'x-label': 'Passo a passo', 'x-item-title': 'title',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            id: { type: 'string' },
            title: { type: 'string', description: 'Título do cartão' },
            flow: { type: 'string', description: 'Linha pequena sob o título' },
            desc: { type: 'string', 'x-multiline': true, description: 'Descrição (**negrito**, `código`, *itálico*)' },
            nodes: ids('nodes[].id', 'Nós destacados'),
            edges: ids('edges[].id', 'Arestas destacadas'),
            proof: {
              anyOf: [
                { type: 'string' },
                { type: 'object', additionalProperties: false, properties: { repo: { type: 'string' }, path: { type: 'string' }, ref: { type: 'string' }, lines: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'array', items: { type: 'number' } }] }, url: { type: 'string' }, text: { type: 'string' } } },
              ],
              description: 'Fonte: texto livre ou {repo, path, ref, lines, url, text}',
            },
            code: { type: 'string', 'x-multiline': true },
            codeLabel: { type: 'string' },
            tone,
            badge: { type: 'string', enum: ['gate', 'async', 'sync', 'phase', 'fail', 'start', 'end'] },
          },
        },
      },
      autoplay: { type: 'boolean', description: 'Usado só no HTML do MCP' },
      stepMs: { type: 'number', description: 'Usado só no HTML do MCP' },
    },
  },
  unique: ['nodes[].id', 'edges[].id'],
  refs: [
    { from: 'edges[].from', to: 'nodes[].id' },
    { from: 'edges[].to', to: 'nodes[].id' },
    { from: 'steps[].nodes[]', to: 'nodes[].id' },
    { from: 'steps[].edges[]', to: 'edges[].id' },
  ],
  // One reveal step per walkthrough beat; after the last, the overview.
  steps: (doc) => (doc.steps || []).length,
  empty: (title = 'Solicitação de benefício com análise automática') => ({
    kind: 'workflow', type: 'workflow', title, direction: 'LR',
    nodes: [
      { id: 's', label: 'Pedido recebido', kind: 'start', sub: 'portal gov.br' },
      { id: 'v', label: 'Validar identidade', sub: 'login único' },
      { id: 'q', label: 'Elegível?', kind: 'decision', sub: 'regras de negócio' },
      { id: 'a', label: 'Análise automática', kind: 'subprocess', sub: 'AWS Step Functions', icon: 'Arch_AWS-Step-Functions_48.png' },
      { id: 'h', label: 'Análise humana', kind: 'wait', sub: 'fila de servidores' },
      { id: 'ok', label: 'Benefício concedido', kind: 'end', tone: 'success' },
      { id: 'no', label: 'Pedido indeferido', kind: 'end', tone: 'danger' },
    ],
    edges: [
      { id: 'e1', from: 's', to: 'v' },
      { id: 'e2', from: 'v', to: 'q' },
      { id: 'e3', from: 'q', to: 'a', label: '[sim]', kind: 'branch' },
      { id: 'e4', from: 'q', to: 'h', label: '[dúvida]', kind: 'branch' },
      { id: 'e5', from: 'q', to: 'no', label: '[não]', kind: 'branch' },
      { id: 'e6', from: 'a', to: 'ok' },
      { id: 'e7', from: 'h', to: 'ok', label: '[aprovado]' },
      { id: 'e8', from: 'h', to: 'no', label: '[negado]' },
    ],
    steps: [
      { title: 'Entrada', desc: 'O cidadão envia o pedido pelo portal e valida a identidade.', nodes: ['s', 'v'], edges: ['e1'] },
      { title: 'Decisão', desc: 'As regras de negócio classificam o pedido: **sim**, **dúvida** ou **não**.', nodes: ['q'], edges: ['e2', 'e3', 'e4', 'e5'], badge: 'gate' },
      { title: 'Conclusão', desc: 'A análise automática ou a humana conclui o pedido.', nodes: ['ok', 'no'], edges: ['e6', 'e7', 'e8'], tone: 'success' },
    ],
  }),
  describe: (doc) => {
    const nodes = doc.nodes || [], edges = doc.edges || [], steps = doc.steps || []
    const dec = nodes.filter(n => n.kind === 'decision' || n.kind === 'choice').map(n => n.label)
    return `${doc.title || 'Fluxo'}: ${nodes.length} nós e ${edges.length} arestas` +
      (dec.length ? `; decisões: ${dec.slice(0, 8).join('; ')}` : '') +
      (steps.length ? `; passo a passo em ${steps.length} etapas: ${steps.map(s => s.title).filter(Boolean).join('; ')}` : '') + '.'
  },
}
