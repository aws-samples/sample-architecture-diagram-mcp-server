// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Typed diagram: timeline ───
// Chronological events on an axis. Horizontal (cards alternate above/below the
// axis) or vertical (cards alternate left/right). `date` is a free label
// ('2024', '2024-03', 'T1/2025') — events are drawn in array order.
const tone = { type: 'string', enum: ['accent', 'info', 'success', 'warn', 'danger', 'neutral', 'purple', 'teal', 'pink'], description: 'Cor semântica do evento' }

export default {
  kind: 'timeline',
  label: 'Linha do tempo',
  description: 'Eventos em ordem cronológica sobre um eixo (horizontal ou vertical).',
  category: 'planning',
  schema: {
    type: 'object',
    required: ['events'],
    additionalProperties: false,
    properties: {
      orientation: { type: 'string', enum: ['horizontal', 'vertical'], 'x-label': 'Orientação', description: 'horizontal (padrão): cartões acima/abaixo do eixo; vertical: à esquerda/direita' },
      events: {
        type: 'array', minItems: 1, maxItems: 40, 'x-label': 'Eventos', 'x-item-title': 'label',
        description: 'Eventos na ordem em que aparecem no eixo',
        items: {
          type: 'object', required: ['id', 'date', 'label'], additionalProperties: false,
          properties: {
            id: { type: 'string' },
            date: { type: 'string', description: 'Rótulo de data (ex.: 2024, 2024-03, T1/2025)' },
            label: { type: 'string', description: 'Título do evento' },
            desc: { type: 'string', 'x-multiline': true, description: 'Descrição curta (quebra em várias linhas)' },
            tone,
          },
        },
      },
    },
  },
  unique: ['events[].id'],
  refs: [],
  // One event per step.
  steps: (doc) => (doc.events || []).length,
  empty: (title = 'Jornada de adoção de IA generativa') => ({
    kind: 'timeline', title, orientation: 'horizontal',
    events: [
      { id: 'e1', date: 'Fev 2025', label: 'Descoberta', desc: 'Workshop de casos de uso com as áreas finalísticas', tone: 'neutral' },
      { id: 'e2', date: 'Abr 2025', label: 'PoC no Amazon Bedrock', desc: 'Assistente de atendimento com RAG sobre a base normativa', tone: 'info' },
      { id: 'e3', date: 'Jun 2025', label: 'Governança', desc: 'Guardrails, política de uso e comitê de IA responsável', tone: 'purple' },
      { id: 'e4', date: 'Set 2025', label: 'Piloto com servidores', desc: '300 usuários internos e avaliação de qualidade contínua', tone: 'teal' },
      { id: 'e5', date: 'Dez 2025', label: 'Produção', desc: 'Canal do cidadão com agentes e observabilidade ponta a ponta', tone: 'success' },
      { id: 'e6', date: '2026', label: 'Escala', desc: 'Novos domínios e reaproveitamento da plataforma', tone: 'accent' },
    ],
  }),
  samples: [
    {
      title: 'Marcos da migração para a nuvem (vertical)', orientation: 'vertical',
      events: [
        { id: 'm1', date: '2023-01', label: 'Avaliação de prontidão (MRA)', desc: 'Inventário de 420 aplicações e análise de dependências com o AWS Application Discovery Service', tone: 'neutral' },
        { id: 'm2', date: '2023-04', label: 'Landing zone', desc: 'AWS Control Tower, contas por ambiente e rede híbrida com AWS Direct Connect', tone: 'info' },
        { id: 'm3', date: '2023-08', label: 'Primeira onda', desc: 'Sistemas administrativos migrados com AWS Application Migration Service', tone: 'teal' },
        { id: 'm4', date: '2024-02', label: 'Bancos de dados gerenciados', desc: 'Oracle e SQL Server para Amazon RDS e Amazon Aurora PostgreSQL com AWS DMS', tone: 'purple' },
        { id: 'm5', date: '2024-07', label: 'Incidente de capacidade evitado', desc: 'Auto Scaling absorveu pico de 8× no período de inscrições', tone: 'warn' },
        { id: 'm6', date: '2024-11', label: 'Desligamento do datacenter legado', tone: 'danger' },
        { id: 'm7', date: '2025-03', label: 'Modernização contínua com contêineres e serverless em toda a carteira de sistemas', desc: 'Amazon EKS, AWS Lambda e esteiras de CI/CD padronizadas', tone: 'success' },
        { id: 'm8', date: '2025-09', label: 'FinOps', desc: 'Savings Plans e rightsizing: redução de 31% no custo mensal', tone: 'accent' },
      ],
    },
  ],
  describe: (doc) => `Linha do tempo ${doc.orientation === 'vertical' ? 'vertical' : 'horizontal'} com ${(doc.events || []).length} eventos: ${(doc.events || []).map(e => `${e.date} — ${e.label}${e.desc ? ` (${e.desc})` : ''}`).join('; ')}.`,
}
