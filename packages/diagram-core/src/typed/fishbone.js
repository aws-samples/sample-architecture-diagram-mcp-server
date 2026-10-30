// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Typed diagram: fishbone (Ishikawa cause-and-effect) ───
// A problem (the fish head, right) and 4–6 cause categories as bones that
// alternate above/below the spine. Each category lists causes; a cause is a
// plain string or { label, sub[] } with sub-causes. One category per step.
const cause = {
  anyOf: [
    { type: 'string', description: 'Causa' },
    {
      type: 'object', required: ['label'], additionalProperties: false,
      properties: {
        label: { type: 'string', description: 'Causa' },
        sub: { type: 'array', maxItems: 4, items: { type: 'string' }, description: 'Subcausas (opcional)' },
      },
    },
  ],
}

export default {
  kind: 'fishbone',
  label: 'Espinha de peixe (Ishikawa)',
  description: 'Diagrama de causa e efeito: categorias de causas convergindo para um problema.',
  category: 'business',
  schema: {
    type: 'object',
    required: ['problem', 'categories'],
    additionalProperties: false,
    properties: {
      problem: { type: 'string', description: 'Problema / efeito analisado (cabeça do peixe)', 'x-label': 'Problema', 'x-multiline': true },
      categories: {
        type: 'array', minItems: 1, maxItems: 8, 'x-label': 'Categorias', 'x-item-title': 'label',
        description: 'Espinhas (tipicamente 4 a 6: pessoas, processos, tecnologia, dados…). Alternam acima/abaixo da espinha central.',
        items: {
          type: 'object', required: ['id', 'label', 'causes'], additionalProperties: false,
          properties: {
            id: { type: 'string' },
            label: { type: 'string', description: 'Nome da categoria' },
            causes: { type: 'array', maxItems: 8, items: cause, 'x-label': 'Causas', description: 'Texto da causa, ou { label, sub[] } com subcausas' },
          },
        },
      },
    },
  },
  unique: ['categories[].id'],
  refs: [],
  // Reveal one category (bone) per step.
  steps: (doc) => (doc.categories || []).length,
  empty: (title = 'Por que o atendimento do portal está lento?') => ({
    kind: 'fishbone', title,
    problem: 'Atendimento lento no portal do cidadão',
    categories: [
      { id: 'tec', label: 'Tecnologia', causes: ['Banco de dados sem réplica de leitura', { label: 'Sem cache de sessão', sub: ['Consultas repetidas ao legado'] }, 'Servidores sem autoscaling'] },
      { id: 'proc', label: 'Processos', causes: ['Validação manual de documentos', 'Fila única para todos os serviços', 'SLA não monitorado'] },
      { id: 'pes', label: 'Pessoas', causes: ['Equipe reduzida em picos', 'Pouco treinamento no sistema novo'] },
      { id: 'dados', label: 'Dados', causes: [{ label: 'Cadastros duplicados', sub: ['Sem chave única (CPF)'] }, 'Integração batch noturna'] },
      { id: 'canal', label: 'Canais', causes: ['Chatbot sem IA generativa', 'App sem modo offline', 'Formulários longos'] },
      { id: 'amb', label: 'Ambiente', causes: ['Data center on-premises saturado', 'Link único de internet'] },
    ],
  }),
  samples: [
    {
      title: 'Alucinações no assistente de IA generativa',
      problem: 'Respostas incorretas do assistente virtual baseado em LLM',
      categories: [
        { id: 'dados', label: 'Base de conhecimento', causes: [
          { label: 'Documentos desatualizados', sub: ['Sem sincronização automática', 'Normas revogadas ainda indexadas'] },
          { label: 'Chunking inadequado', sub: ['Tabelas quebradas no meio'] },
          'PDFs escaneados sem OCR',
        ] },
        { id: 'modelo', label: 'Modelo', causes: [
          { label: 'Temperatura alta', sub: ['Configuração padrão não revisada'] },
          'Modelo pequeno para a tarefa',
          'Prompt de sistema genérico',
        ] },
        { id: 'busca', label: 'Recuperação (RAG)', causes: [
          { label: 'Top-k baixo', sub: ['Contexto insuficiente', 'Sem reranking'] },
          'Embeddings só em inglês',
        ] },
        { id: 'aval', label: 'Avaliação', causes: [
          'Sem conjunto de testes dourado',
          { label: 'Sem guardrails', sub: ['Amazon Bedrock Guardrails não habilitado'] },
          'Feedback do cidadão ignorado',
        ] },
      ],
    },
  ],
  describe: (doc) => `Diagrama de espinha de peixe para o problema "${doc.problem || ''}". Categorias: ${(doc.categories || []).map(c => `${c.label} (${(c.causes || []).map(x => typeof x === 'string' ? x : `${x.label}${x.sub?.length ? ` [${x.sub.join(', ')}]` : ''}`).join('; ')})`).join('. ')}.`,
}
