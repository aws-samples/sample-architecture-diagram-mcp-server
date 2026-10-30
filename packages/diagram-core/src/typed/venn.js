// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Typed diagram: venn (2 or 3 sets) ───
// Overlapping circles; `regions` place a label / items in an exclusive area
// (sets: ['a']) or an intersection (sets: ['a', 'b'] / ['a', 'b', 'c']).
const tone = { type: 'string', enum: ['accent', 'info', 'success', 'warn', 'danger', 'neutral', 'purple', 'teal', 'pink'], description: 'Cor do conjunto' }

export default {
  kind: 'venn',
  label: 'Diagrama de Venn',
  description: 'Dois ou três conjuntos sobrepostos, com itens nas áreas exclusivas e nas interseções.',
  category: 'business',
  schema: {
    type: 'object',
    required: ['sets'],
    additionalProperties: false,
    properties: {
      sets: {
        type: 'array', minItems: 2, maxItems: 3, 'x-label': 'Conjuntos', 'x-item-title': 'label',
        description: '2 ou 3 conjuntos (círculos)',
        items: {
          type: 'object', required: ['id', 'label'], additionalProperties: false,
          properties: { id: { type: 'string', description: 'Identificador' }, label: { type: 'string', description: 'Nome do conjunto' }, tone },
        },
      },
      regions: {
        type: 'array', maxItems: 7, 'x-label': 'Regiões', 'x-item-title': 'label',
        description: 'Conteúdo de cada área: um conjunto = área exclusiva; dois ou três = interseção',
        items: {
          type: 'object', required: ['sets'], additionalProperties: false,
          properties: {
            sets: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string', 'x-ref': 'sets[].id' }, 'x-label': 'Conjuntos', description: 'Conjuntos que formam a área' },
            label: { type: 'string', description: 'Título da área (opcional)' },
            items: { type: 'array', maxItems: 8, items: { type: 'string' }, 'x-label': 'Itens', description: 'Itens listados na área' },
          },
        },
      },
    },
  },
  unique: ['sets[].id'],
  refs: [{ from: 'regions[].sets[]', to: 'sets[].id' }],
  // Reveal: one set per step (circle + its exclusive area), then each intersection.
  steps: (doc) => (doc.sets || []).length + new Set((doc.regions || []).filter(r => (r.sets || []).length > 1).map(r => [...new Set(r.sets)].sort().join('|'))).size,
  empty: (title = 'Onde nasce a IA confiável no setor público') => ({
    kind: 'venn', title,
    sets: [
      { id: 'ia', label: 'IA generativa', tone: 'purple' },
      { id: 'dados', label: 'Dados', tone: 'info' },
      { id: 'gov', label: 'Governança', tone: 'accent' },
    ],
    regions: [
      { sets: ['ia'], items: ['Modelos de fundação', 'Agentes', 'Engenharia de prompt'] },
      { sets: ['dados'], items: ['Lakehouse', 'Qualidade de dados', 'Dados abertos'] },
      { sets: ['gov'], items: ['LGPD', 'Gestão de riscos', 'Auditoria'] },
      { sets: ['ia', 'dados'], label: 'RAG', items: ['Bases de conhecimento'] },
      { sets: ['ia', 'gov'], label: 'IA responsável', items: ['Guardrails'] },
      { sets: ['dados', 'gov'], label: 'Catálogo', items: ['Linhagem'] },
      { sets: ['ia', 'dados', 'gov'], label: 'IA confiável' },
    ],
  }),
  samples: [
    {
      title: 'Modernização de legado × IA generativa (2 conjuntos, muitos itens)',
      sets: [
        { id: 'leg', label: 'Modernização de sistemas legados (COBOL, JSF/EJB)', tone: 'teal' },
        { id: 'gen', label: 'IA generativa aplicada ao desenvolvimento', tone: 'pink' },
      ],
      regions: [
        { sets: ['leg'], label: 'Só modernização', items: ['Mainframe para contêineres', 'Banco relacional gerenciado', 'Testes de regressão', 'Esteira CI/CD'] },
        { sets: ['gen'], label: 'Só IA generativa', items: ['Assistente para cidadão', 'Resumo de processos', 'Busca semântica', 'Classificação de documentos'] },
        { sets: ['leg', 'gen'], label: 'AWS Transform + Kiro', items: ['Documentação de código', 'Conversão Java 8 → 21', 'Geração de testes', 'Especificação a partir do legado'] },
      ],
    },
  ],
  describe: (doc) => {
    const sets = doc.sets || []
    const name = (id) => sets.find(s => s.id === id)?.label || id
    return `Diagrama de Venn com ${sets.length} conjuntos: ${sets.map(s => s.label).join(', ')}. ` + (doc.regions || []).map(r =>
      `${(r.sets || []).length > 1 ? 'Interseção' : 'Somente'} ${(r.sets || []).map(name).join(' ∩ ')}${r.label ? ` (${r.label})` : ''}${r.items?.length ? `: ${r.items.join(', ')}` : ''}`).join('. ') + '.'
  },
}
