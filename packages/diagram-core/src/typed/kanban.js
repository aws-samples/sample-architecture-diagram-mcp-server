// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Typed diagram: kanban (board) ───
// Columns side by side (with WIP limits) and stacked cards with tags, owner
// avatar and a blocked indicator.
const tone = { type: 'string', enum: ['accent', 'info', 'success', 'warn', 'danger', 'neutral', 'purple', 'teal', 'pink'] }

export default {
  kind: 'kanban',
  label: 'Kanban',
  description: 'Quadro Kanban: colunas com limite de WIP e cartões com etiquetas, responsável e bloqueios.',
  category: 'planning',
  schema: {
    type: 'object',
    required: ['columns', 'cards'],
    additionalProperties: false,
    properties: {
      columns: {
        type: 'array', minItems: 1, maxItems: 12, 'x-label': 'Colunas', 'x-item-title': 'label',
        items: {
          type: 'object', required: ['id', 'label'], additionalProperties: false,
          properties: {
            id: { type: 'string', description: 'Identificador único da coluna' },
            label: { type: 'string', description: 'Nome da coluna' },
            limit: { type: 'number', description: 'Limite de WIP (cartões simultâneos); destaca quando excedido' },
            tone: { ...tone, description: 'Cor da coluna' },
          },
        },
      },
      cards: {
        type: 'array', maxItems: 120, 'x-label': 'Cartões', 'x-item-title': 'title',
        items: {
          type: 'object', required: ['id', 'column', 'title'], additionalProperties: false,
          properties: {
            id: { type: 'string', description: 'Identificador único do cartão' },
            column: { type: 'string', 'x-ref': 'columns[].id', description: 'Coluna onde o cartão está' },
            title: { type: 'string', description: 'Título do cartão' },
            tags: { type: 'array', maxItems: 6, items: { type: 'string' }, 'x-label': 'Etiquetas', description: 'Etiquetas curtas' },
            owner: { type: 'string', description: 'Responsável (nome; as iniciais aparecem no avatar)' },
            tone: { ...tone, description: 'Cor da faixa lateral do cartão' },
            blocked: { type: 'boolean', description: 'Cartão bloqueado' },
          },
        },
      },
    },
  },
  unique: ['columns[].id', 'cards[].id'],
  refs: [{ from: 'cards[].column', to: 'columns[].id' }],
  // Reveal one column (with its cards) per step, left → right.
  steps: (doc) => (doc.columns || []).length,
  empty: (title = 'Sprint 14 — migração para a nuvem') => ({
    kind: 'kanban', title,
    columns: [
      { id: 'backlog', label: 'Backlog', tone: 'neutral' },
      { id: 'fazendo', label: 'Em andamento', limit: 3, tone: 'info' },
      { id: 'revisao', label: 'Revisão', limit: 2, tone: 'purple' },
      { id: 'feito', label: 'Concluído', tone: 'success' },
    ],
    cards: [
      { id: 'c1', column: 'backlog', title: 'Inventariar aplicações com AWS Transform', tags: ['descoberta'], owner: 'Ana Souza' },
      { id: 'c2', column: 'backlog', title: 'Definir estratégia 7R por sistema', tags: ['arquitetura'], owner: 'Bruno Lima' },
      { id: 'c3', column: 'backlog', title: 'Plano de rollback do banco legado', tags: ['dados', 'risco'], tone: 'warn' },
      { id: 'c4', column: 'fazendo', title: 'Landing zone com AWS Control Tower', tags: ['governança'], owner: 'Carla Dias', tone: 'accent' },
      { id: 'c5', column: 'fazendo', title: 'Replicar Oracle para Amazon Aurora com AWS DMS', tags: ['dados'], owner: 'Diego Reis', blocked: true },
      { id: 'c6', column: 'fazendo', title: 'Pipeline CI/CD para contêineres', tags: ['devops'], owner: 'Elisa Prado' },
      { id: 'c7', column: 'fazendo', title: 'Assistente GenAI no Amazon Bedrock para o service desk', tags: ['genai', 'piloto'], owner: 'Fábio Nunes', tone: 'purple' },
      { id: 'c8', column: 'revisao', title: 'Políticas de SCP por unidade organizacional', tags: ['segurança'], owner: 'Gabriela Melo' },
      { id: 'c9', column: 'feito', title: 'Conexão AWS Direct Connect com o datacenter', tags: ['rede'], owner: 'Heitor Alves', tone: 'success' },
      { id: 'c10', column: 'feito', title: 'Contas e acesso via IAM Identity Center', tags: ['identidade'], owner: 'Ana Souza' },
    ],
  }),
  describe: (doc) => {
    const cards = doc.cards || []
    return `Quadro Kanban com ${(doc.columns || []).length} coluna(s): ${(doc.columns || []).map(c => {
      const cs = cards.filter(k => k.column === c.id)
      return `${c.label} (${cs.length}${c.limit != null ? ` de limite ${c.limit}` : ''} cartão(ões)${cs.length ? `: ${cs.map(k => k.title + (k.blocked ? ' [bloqueado]' : '') + (k.owner ? ` — ${k.owner}` : '')).join(', ')}` : ''})`
    }).join('; ')}.`
  },
  samples: [
    {
      title: 'Programa de modernização — quadro do portfólio com muitos itens',
      columns: [
        { id: 'ideias', label: 'Ideias', tone: 'neutral' },
        { id: 'priorizado', label: 'Priorizado para o próximo trimestre', limit: 4, tone: 'teal' },
        { id: 'desenv', label: 'Desenvolvimento', limit: 3, tone: 'info' },
        { id: 'homolog', label: 'Homologação', limit: 2, tone: 'warn' },
        { id: 'producao', label: 'Produção', tone: 'success' },
        { id: 'vazio', label: 'Descontinuado', tone: 'danger' },
      ],
      cards: [
        { id: 'k1', column: 'ideias', title: 'Chatbot de primeiro atendimento ao cidadão com base de conhecimento oficial', tags: ['genai', 'atendimento', 'cidadão'], owner: 'Marina' },
        { id: 'k2', column: 'ideias', title: 'Data lake de indicadores', tags: ['dados'] },
        { id: 'k3', column: 'ideias', title: 'OCR de documentos digitalizados', tags: ['textract'], owner: 'Paulo Henrique Cardoso' },
        { id: 'k4', column: 'priorizado', title: 'Portal de serviços em React + gov.br', tags: ['frontend', 'acessibilidade'], owner: 'Luiza Campos' },
        { id: 'k5', column: 'priorizado', title: 'Observabilidade unificada', tags: ['cloudwatch'], owner: 'Rafael' },
        { id: 'k6', column: 'desenv', title: 'API de consulta de benefícios', tags: ['api', 'lambda'], owner: 'Tiago Moura', tone: 'info' },
        { id: 'k7', column: 'desenv', title: 'Migração de filas para Amazon SQS', tags: ['mensageria'], owner: 'Vera Lúcia', blocked: true },
        { id: 'k8', column: 'desenv', title: 'Agente de triagem de processos', tags: ['genai', 'agentes'], owner: 'Wagner', tone: 'purple' },
        { id: 'k9', column: 'desenv', title: 'Cache com Amazon ElastiCache', tags: ['performance'], owner: 'Yara' },
        { id: 'k10', column: 'homolog', title: 'Revisão de acessibilidade WCAG 2.2', tags: ['a11y'], owner: 'Zeca', blocked: true },
        { id: 'k11', column: 'homolog', title: 'Teste de carga com Distributed Load Testing', tags: ['carga'], owner: 'Ana' },
        { id: 'k12', column: 'homolog', title: 'Pentest da API pública', tags: ['segurança'], owner: 'Bruno', tone: 'danger' },
        { id: 'k13', column: 'producao', title: 'Autenticação via gov.br', tags: ['identidade'], owner: 'Carla' },
        { id: 'k14', column: 'producao', title: 'Backup com AWS Backup', owner: 'Diego' },
        { id: 'k15', column: 'producao', title: 'WAF na borda', tags: ['segurança', 'borda'] },
      ],
    },
  ],
}
