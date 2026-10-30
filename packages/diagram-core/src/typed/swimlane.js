// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Typed diagram: swimlane ───
// Process across lanes (BPMN-lite): horizontal lanes (actors/systems) stacked
// vertically, steps placed in a lane at a column (order position, left→right),
// and flows between steps (orthogonal arrows, incl. lane changes and loops).
const tone = { type: 'string', enum: ['accent', 'info', 'success', 'warn', 'danger', 'neutral', 'purple', 'teal', 'pink'], description: 'Cor da raia (padrão: paleta)' }

export default {
  kind: 'swimlane',
  label: 'Raias (swimlane)',
  description: 'Processo atravessando raias (atores ou sistemas), com etapas, decisões e fluxos.',
  category: 'process',
  schema: {
    type: 'object',
    required: ['lanes', 'steps'],
    additionalProperties: false,
    properties: {
      lanes: {
        type: 'array', minItems: 1, maxItems: 12, 'x-label': 'Raias', 'x-item-title': 'label',
        description: 'Raias de cima para baixo (atores, áreas ou sistemas)',
        items: {
          type: 'object', required: ['id', 'label'], additionalProperties: false,
          properties: { id: { type: 'string' }, label: { type: 'string', description: 'Nome da raia' }, tone },
        },
      },
      steps: {
        type: 'array', minItems: 1, maxItems: 80, 'x-label': 'Etapas', 'x-item-title': 'label',
        items: {
          type: 'object', required: ['id', 'lane', 'label', 'col'], additionalProperties: false,
          properties: {
            id: { type: 'string' },
            lane: { type: 'string', 'x-ref': 'lanes[].id', description: 'Raia da etapa' },
            label: { type: 'string', description: 'Texto da etapa' },
            col: { type: 'number', description: 'Posição na ordem (coluna, da esquerda para a direita)' },
            type: { type: 'string', enum: ['task', 'start', 'end', 'decision'], description: 'task (padrão), start (início), end (fim) ou decision (decisão)' },
          },
        },
      },
      flows: {
        type: 'array', maxItems: 160, 'x-label': 'Fluxos', 'x-item-title': 'label',
        items: {
          type: 'object', required: ['from', 'to'], additionalProperties: false,
          properties: {
            from: { type: 'string', 'x-ref': 'steps[].id', description: 'Etapa de origem' },
            to: { type: 'string', 'x-ref': 'steps[].id', description: 'Etapa de destino' },
            label: { type: 'string', description: 'Rótulo do fluxo (ex.: Sim / Não)' },
          },
        },
      },
    },
  },
  unique: ['lanes[].id', 'steps[].id'],
  refs: [
    { from: 'steps[].lane', to: 'lanes[].id' },
    { from: 'flows[].from', to: 'steps[].id' },
    { from: 'flows[].to', to: 'steps[].id' },
  ],
  // One step per process step, revealed in column order.
  steps: (doc) => (doc.steps || []).length,
  empty: (title = 'Solicitação de serviço pelo cidadão') => ({
    kind: 'swimlane', title,
    lanes: [
      { id: 'cid', label: 'Cidadão', tone: 'info' },
      { id: 'portal', label: 'Portal gov.br', tone: 'accent' },
      { id: 'back', label: 'Backend (AWS)', tone: 'teal' },
      { id: 'ana', label: 'Analista', tone: 'purple' },
    ],
    steps: [
      { id: 's0', lane: 'cid', label: 'Necessidade do serviço', col: 0, type: 'start' },
      { id: 's1', lane: 'cid', label: 'Preenche o pedido', col: 1 },
      { id: 's2', lane: 'portal', label: 'Autentica e valida dados', col: 2 },
      { id: 's3', lane: 'back', label: 'Registra no Amazon DynamoDB', col: 3 },
      { id: 's4', lane: 'back', label: 'Elegível automaticamente?', col: 4, type: 'decision' },
      { id: 's5', lane: 'ana', label: 'Analisa documentos', col: 5 },
      { id: 's6', lane: 'back', label: 'Emite comprovante', col: 6 },
      { id: 's7', lane: 'cid', label: 'Recebe notificação', col: 7, type: 'end' },
    ],
    flows: [
      { from: 's0', to: 's1' },
      { from: 's1', to: 's2' },
      { from: 's2', to: 's3' },
      { from: 's3', to: 's4' },
      { from: 's4', to: 's6', label: 'Sim' },
      { from: 's4', to: 's5', label: 'Não' },
      { from: 's5', to: 's6' },
      { from: 's6', to: 's7' },
    ],
  }),
  samples: [
    {
      title: 'Atendimento com IA generativa e retorno para correção (laços)',
      lanes: [
        { id: 'u', label: 'Servidor solicitante' },
        { id: 'ag', label: 'Agente de IA (Amazon Bedrock AgentCore)' },
        { id: 'kb', label: 'Base de conhecimento' },
        { id: 'rev', label: 'Revisor humano' },
      ],
      steps: [
        { id: 'a', lane: 'u', label: 'Envia pergunta', col: 0, type: 'start' },
        { id: 'b', lane: 'ag', label: 'Classifica a intenção e aplica guardrails', col: 1 },
        { id: 'c', lane: 'kb', label: 'Recupera trechos relevantes (RAG)', col: 2 },
        { id: 'c2', lane: 'kb', label: 'Consulta normas vigentes', col: 2 },
        { id: 'd', lane: 'ag', label: 'Gera resposta com citações', col: 3 },
        { id: 'e', lane: 'ag', label: 'Confiança suficiente?', col: 4, type: 'decision' },
        { id: 'f', lane: 'rev', label: 'Revisa e corrige a resposta', col: 5 },
        { id: 'g', lane: 'rev', label: 'Aprovada?', col: 6, type: 'decision' },
        { id: 'h', lane: 'u', label: 'Recebe a resposta final', col: 7, type: 'end' },
      ],
      flows: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'b', to: 'c2' },
        { from: 'c', to: 'd' },
        { from: 'c2', to: 'd' },
        { from: 'd', to: 'e' },
        { from: 'e', to: 'h', label: 'Sim' },
        { from: 'e', to: 'f', label: 'Não' },
        { from: 'f', to: 'g' },
        { from: 'g', to: 'h', label: 'Sim' },
        { from: 'g', to: 'd', label: 'Refazer' },
        { from: 'g', to: 'b', label: 'Fora do escopo' },
      ],
    },
  ],
  describe: (doc) => {
    const lanes = new Map((doc.lanes || []).map(l => [l.id, l.label]))
    const st = new Map((doc.steps || []).map(s => [s.id, s]))
    const steps = [...(doc.steps || [])].sort((a, b) => (a.col ?? 0) - (b.col ?? 0))
    const flows = (doc.flows || []).map(f => `${st.get(f.from)?.label || f.from} → ${st.get(f.to)?.label || f.to}${f.label ? ` (${f.label})` : ''}`)
    return `Diagrama de raias com ${lanes.size} raias (${[...lanes.values()].join(', ')}) e ${steps.length} etapas: ${steps.map(s => `${s.label} [${lanes.get(s.lane) || s.lane}${s.type && s.type !== 'task' ? `, ${s.type === 'decision' ? 'decisão' : s.type === 'start' ? 'início' : 'fim'}` : ''}]`).join('; ')}. Fluxos: ${flows.join('; ')}.`
  },
}
