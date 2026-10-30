// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Typed diagram: gantt ───
// Project schedule: tasks with ISO dates (start + end, or start + durationDays),
// optional sections, progress, milestones and finish→start dependencies.
const tone = { type: 'string', enum: ['accent', 'info', 'success', 'warn', 'danger', 'neutral', 'purple', 'teal', 'pink'], description: 'Cor da barra (padrão: cor da seção)' }
const isoDate = { type: 'string', description: 'Data ISO AAAA-MM-DD' }

export default {
  kind: 'gantt',
  label: 'Gantt',
  description: 'Cronograma de tarefas com datas, seções, progresso, marcos e dependências.',
  category: 'planning',
  schema: {
    type: 'object',
    required: ['tasks'],
    additionalProperties: false,
    properties: {
      today: { ...isoDate, 'x-label': 'Hoje', description: 'Data de referência (linha "hoje"), AAAA-MM-DD — opcional' },
      sections: {
        type: 'array', maxItems: 20, 'x-label': 'Seções', 'x-item-title': 'label',
        description: 'Agrupamentos de tarefas (fases, frentes)',
        items: {
          type: 'object', required: ['id', 'label'], additionalProperties: false,
          properties: { id: { type: 'string' }, label: { type: 'string', description: 'Nome da seção' } },
        },
      },
      tasks: {
        type: 'array', minItems: 1, maxItems: 80, 'x-label': 'Tarefas', 'x-item-title': 'label',
        items: {
          type: 'object', required: ['id', 'label', 'start'], additionalProperties: false,
          properties: {
            id: { type: 'string' },
            label: { type: 'string', description: 'Nome da tarefa' },
            section: { type: 'string', 'x-ref': 'sections[].id', description: 'Seção da tarefa' },
            start: { ...isoDate, description: 'Início (AAAA-MM-DD)' },
            end: { ...isoDate, description: 'Fim inclusivo (AAAA-MM-DD) — ou use durationDays' },
            durationDays: { type: 'number', description: 'Duração em dias corridos (se não houver "end")' },
            dependsOn: { type: 'array', items: { type: 'string', 'x-ref': 'tasks[].id' }, description: 'Tarefas que precisam terminar antes (fim → início)' },
            progress: { type: 'number', description: 'Percentual concluído, 0 a 100' },
            milestone: { type: 'boolean', description: 'Marco (losango na data de início)' },
            tone,
          },
        },
      },
    },
  },
  unique: ['sections[].id', 'tasks[].id'],
  refs: [
    { from: 'tasks[].section', to: 'sections[].id' },
    { from: 'tasks[].dependsOn[]', to: 'tasks[].id' },
  ],
  // One task per step (array order).
  steps: (doc) => (doc.tasks || []).length,
  empty: (title = 'Migração para a AWS — onda 1') => ({
    kind: 'gantt', title, today: '2026-03-16',
    sections: [
      { id: 'pre', label: 'Preparação' },
      { id: 'mig', label: 'Migração' },
      { id: 'ops', label: 'Operação' },
    ],
    tasks: [
      { id: 'disc', label: 'Descoberta e inventário', section: 'pre', start: '2026-01-05', end: '2026-01-30', progress: 100 },
      { id: 'lz', label: 'Landing zone (Control Tower)', section: 'pre', start: '2026-01-19', durationDays: 28, dependsOn: ['disc'], progress: 100 },
      { id: 'kick', label: 'Aprovação do plano de ondas', section: 'pre', start: '2026-02-16', milestone: true, dependsOn: ['lz'] },
      { id: 'db', label: 'Bancos para Amazon Aurora (DMS)', section: 'mig', start: '2026-02-16', end: '2026-03-27', dependsOn: ['kick'], progress: 70 },
      { id: 'app', label: 'Servidores de aplicação (MGN)', section: 'mig', start: '2026-03-02', end: '2026-04-10', dependsOn: ['kick'], progress: 40 },
      { id: 'test', label: 'Testes de desempenho', section: 'mig', start: '2026-04-06', end: '2026-04-24', dependsOn: ['db', 'app'], progress: 0, tone: 'warn' },
      { id: 'cut', label: 'Virada (cutover)', section: 'ops', start: '2026-04-27', milestone: true, dependsOn: ['test'], tone: 'danger' },
      { id: 'hyper', label: 'Operação assistida', section: 'ops', start: '2026-04-27', durationDays: 21, dependsOn: ['cut'], tone: 'success' },
    ],
  }),
  samples: [
    {
      title: 'Programa de IA generativa — 2026 (muitas tarefas, longo prazo)', today: '2026-05-04',
      sections: [
        { id: 's1', label: 'Fundação e governança' },
        { id: 's2', label: 'Casos de uso prioritários do atendimento ao cidadão' },
        { id: 's3', label: 'Escala' },
      ],
      tasks: [
        { id: 't1', label: 'Política de uso responsável de IA', section: 's1', start: '2026-01-12', end: '2026-02-27', progress: 100, tone: 'purple' },
        { id: 't2', label: 'Plataforma Amazon Bedrock com guardrails e observabilidade centralizada', section: 's1', start: '2026-02-02', end: '2026-04-17', progress: 85 },
        { id: 't3', label: 'Capacitação de 200 servidores', section: 's1', start: '2026-03-02', end: '2026-06-26', progress: 30, tone: 'teal' },
        { id: 't4', label: 'Assistente de atendimento (RAG)', section: 's2', start: '2026-03-16', end: '2026-06-05', dependsOn: ['t2'], progress: 45 },
        { id: 't5', label: 'Triagem de processos', section: 's2', start: '2026-04-20', end: '2026-07-31', dependsOn: ['t2'], progress: 10 },
        { id: 't6', label: 'Resumo de pareceres jurídicos', section: 's2', start: '2026-05-04', durationDays: 70, dependsOn: ['t1'] },
        { id: 't7', label: 'Go-live do assistente', section: 's2', start: '2026-06-08', milestone: true, dependsOn: ['t4'], tone: 'success' },
        { id: 't8', label: 'Avaliação contínua (LLM-as-judge)', section: 's3', start: '2026-06-08', end: '2026-09-30', dependsOn: ['t7'] },
        { id: 't9', label: 'Agentes com AgentCore', section: 's3', start: '2026-07-06', end: '2026-11-27', dependsOn: ['t5'], tone: 'accent' },
        { id: 't10', label: 'FinOps de tokens', section: 's3', start: '2026-08-03', end: '2026-10-30', dependsOn: ['t8'], tone: 'warn' },
        { id: 't11', label: 'Revisão anual do programa', section: 's3', start: '2026-12-07', milestone: true, dependsOn: ['t9', 't10'], tone: 'danger' },
      ],
    },
    {
      title: 'Sprint de PoC com Amazon Bedrock (escala semanal, sem seções)', today: '2026-06-10',
      tasks: [
        { id: 'k', label: 'Kick-off com a área de negócio', start: '2026-06-01', milestone: true, tone: 'accent' },
        { id: 'd', label: 'Curadoria da base documental e preparação para a base de conhecimento', start: '2026-06-01', end: '2026-06-09', dependsOn: ['k'], progress: 100, tone: 'info' },
        { id: 'r', label: 'Pipeline RAG', start: '2026-06-08', durationDays: 10, dependsOn: ['d'], progress: 50, tone: 'teal' },
        { id: 'g', label: 'Guardrails e avaliação', start: '2026-06-15', end: '2026-06-26', dependsOn: ['r'], progress: 0, tone: 'purple' },
        { id: 'u', label: 'Interface piloto', start: '2026-06-10', end: '2026-06-24', progress: 20, tone: 'pink' },
        { id: 'demo', label: 'Demonstração executiva', start: '2026-06-30', milestone: true, dependsOn: ['g', 'u'], tone: 'success' },
      ],
    },
  ],
  describe: (doc) => {
    const secs = new Map((doc.sections || []).map(s => [s.id, s.label]))
    const t = (doc.tasks || []).map(x => `${x.label}${x.section && secs.has(x.section) ? ` [${secs.get(x.section)}]` : ''}: ${x.milestone ? `marco em ${x.start}` : `${x.start} a ${x.end || `${x.durationDays || 1} dias`}`}${x.progress != null && !x.milestone ? `, ${x.progress}%` : ''}${x.dependsOn?.length ? `, depende de ${x.dependsOn.join(', ')}` : ''}`)
    return `Gráfico de Gantt com ${(doc.tasks || []).length} tarefas${secs.size ? ` em ${secs.size} seções` : ''}. ${t.join('; ')}.`
  },
}
