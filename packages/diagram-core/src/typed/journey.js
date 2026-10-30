// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Typed diagram: journey (user journey / story map) ───
// Stages (columns, left→right) with step cards, an emotion curve across the
// steps (-2 very negative … +2 very positive) and pain / opportunity chips.
const str = (description) => ({ type: 'string', description })

export default {
  kind: 'journey',
  label: 'Jornada / story map',
  description: 'Jornada do usuário em etapas, com passos, curva de emoção, dores e oportunidades.',
  category: 'business',
  schema: {
    type: 'object',
    required: ['stages', 'steps'],
    additionalProperties: false,
    properties: {
      personas: {
        type: 'array', maxItems: 6, 'x-label': 'Personas', 'x-item-title': 'label',
        description: 'Personas (opcional). Um passo pode citar a persona no campo "ator" pelo id.',
        items: {
          type: 'object', required: ['id', 'label'], additionalProperties: false,
          properties: { id: str('Identificador'), label: str('Nome da persona') },
        },
      },
      stages: {
        type: 'array', minItems: 1, maxItems: 10, 'x-label': 'Etapas', 'x-item-title': 'label',
        description: 'Fases da jornada, da esquerda para a direita',
        items: {
          type: 'object', required: ['id', 'label'], additionalProperties: false,
          properties: { id: str('Identificador'), label: str('Nome da etapa') },
        },
      },
      steps: {
        type: 'array', minItems: 1, maxItems: 30, 'x-label': 'Passos', 'x-item-title': 'label',
        items: {
          type: 'object', required: ['id', 'stage', 'label'], additionalProperties: false,
          properties: {
            id: str('Identificador'),
            stage: { type: 'string', 'x-ref': 'stages[].id', description: 'Etapa a que o passo pertence' },
            label: { type: 'string', 'x-multiline': true, description: 'O que o usuário faz' },
            actor: str('Quem executa (texto livre ou id de uma persona)'),
            emotion: { type: 'integer', enum: [-2, -1, 0, 1, 2], description: 'Emoção: -2 (muito negativa) a 2 (muito positiva)' },
            pains: { type: 'array', maxItems: 6, items: { type: 'string' }, 'x-label': 'Dores', description: 'Dores / atritos neste passo' },
            opportunities: { type: 'array', maxItems: 6, items: { type: 'string' }, 'x-label': 'Oportunidades', description: 'Oportunidades de melhoria' },
          },
        },
      },
    },
  },
  unique: ['stages[].id', 'steps[].id', 'personas[].id'],
  refs: [{ from: 'steps[].stage', to: 'stages[].id' }],
  // Reveal one stage (header + its steps) per step, left → right.
  steps: (doc) => (doc.stages || []).length,
  empty: (title = 'Jornada do cidadão: solicitar benefício online') => ({
    kind: 'journey', title,
    personas: [{ id: 'cid', label: 'Cidadã (Maria, 62 anos)' }, { id: 'srv', label: 'Servidor do órgão' }],
    stages: [
      { id: 'desc', label: 'Descobrir' },
      { id: 'acesso', label: 'Acessar' },
      { id: 'pedido', label: 'Solicitar' },
      { id: 'analise', label: 'Análise' },
      { id: 'result', label: 'Resultado' },
    ],
    steps: [
      { id: 's1', stage: 'desc', label: 'Pergunta ao assistente virtual se tem direito', actor: 'cid', emotion: 0, opportunities: ['Assistente com IA generativa (Amazon Bedrock)'] },
      { id: 's2', stage: 'acesso', label: 'Faz login com a conta gov.br', actor: 'cid', emotion: -1, pains: ['Esqueceu a senha'], opportunities: ['Recuperação guiada'] },
      { id: 's3', stage: 'pedido', label: 'Preenche o requerimento', actor: 'cid', emotion: -1, pains: ['Formulário longo'], opportunities: ['Pré-preenchimento com dados do CNIS'] },
      { id: 's4', stage: 'pedido', label: 'Envia documentos pelo celular', actor: 'cid', emotion: -2, pains: ['Foto recusada', 'Não sabe qual documento'], opportunities: ['Validação com Amazon Textract'] },
      { id: 's5', stage: 'analise', label: 'Acompanha o andamento', actor: 'cid', emotion: -1, pains: ['Sem previsão de prazo'], opportunities: ['Notificação proativa por SMS'] },
      { id: 's6', stage: 'analise', label: 'Analisa e decide o pedido', actor: 'srv', emotion: 1, opportunities: ['Resumo do processo por IA'] },
      { id: 's7', stage: 'result', label: 'Recebe a concessão e o 1º pagamento', actor: 'cid', emotion: 2 },
    ],
  }),
  samples: [
    {
      title: 'Story map: onboarding em plataforma de dados (casos extremos)',
      stages: [
        { id: 'a', label: 'Solicitação de acesso ao lago de dados corporativo' },
        { id: 'b', label: 'Aprovação' },
        { id: 'c', label: 'Primeira consulta' },
      ],
      steps: [
        { id: 'p1', stage: 'a', label: 'Abre chamado no portal de serviços pedindo acesso ao domínio de dados de benefícios previdenciários', actor: 'Analista de dados', emotion: -2, pains: ['Não sabe qual domínio pedir', 'Formulário sem ajuda contextual', 'Precisa de aprovação do gestor e do dono do dado'], opportunities: ['Catálogo com busca semântica', 'Amazon DataZone'] },
        { id: 'p2', stage: 'b', label: 'Aguarda aprovação', actor: 'Analista de dados', emotion: -2, pains: ['Espera de 10 dias úteis'] },
        { id: 'p3', stage: 'b', label: 'Aprova com ressalvas', actor: 'Dono do dado', emotion: -1, opportunities: ['Políticas com AWS Lake Formation'] },
        { id: 'p4', stage: 'c', label: 'Roda a primeira query', emotion: 1 },
        { id: 'p5', stage: 'c', label: 'Compartilha o painel', actor: 'Analista de dados' },
      ],
    },
  ],
  describe: (doc) => {
    const stages = doc.stages || [], steps = doc.steps || []
    return `Jornada com ${stages.length} etapas e ${steps.length} passos. ` + stages.map(s => {
      const ss = steps.filter(p => p.stage === s.id)
      return `${s.label}: ${ss.map(p => `${p.label}${p.emotion != null ? ` (emoção ${p.emotion})` : ''}${p.pains?.length ? `; dores: ${p.pains.join(', ')}` : ''}${p.opportunities?.length ? `; oportunidades: ${p.opportunities.join(', ')}` : ''}`).join(' | ') || 'sem passos'}`
    }).join('. ') + '.'
  },
}
