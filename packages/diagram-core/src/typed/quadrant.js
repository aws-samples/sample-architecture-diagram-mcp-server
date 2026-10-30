// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Typed diagram: quadrant (2×2 matrix) ───
// Reference implementation of the typed-diagram contract (README.md).
// Items positioned on two 0–100 axes (e.g. impact × effort, Gartner-style).
const tone = { type: 'string', enum: ['accent', 'info', 'success', 'warn', 'danger', 'neutral'] }

export default {
  kind: 'quadrant',
  label: 'Quadrante (matriz 2×2)',
  description: 'Itens posicionados em dois eixos (ex.: impacto × esforço).',
  category: 'business',
  schema: {
    type: 'object',
    required: ['xAxis', 'yAxis', 'items'],
    additionalProperties: false,
    properties: {
      xAxis: {
        type: 'object', required: ['low', 'high'], additionalProperties: false, 'x-label': 'Eixo X',
        properties: { label: { type: 'string', description: 'Nome do eixo' }, low: { type: 'string', description: 'Rótulo à esquerda' }, high: { type: 'string', description: 'Rótulo à direita' } },
      },
      yAxis: {
        type: 'object', required: ['low', 'high'], additionalProperties: false, 'x-label': 'Eixo Y',
        properties: { label: { type: 'string', description: 'Nome do eixo' }, low: { type: 'string', description: 'Rótulo embaixo' }, high: { type: 'string', description: 'Rótulo em cima' } },
      },
      quadrants: {
        type: 'array', maxItems: 4, items: { type: 'string' }, 'x-label': 'Quadrantes',
        description: 'Nomes dos quadrantes: superior-esquerdo, superior-direito, inferior-esquerdo, inferior-direito',
      },
      items: {
        type: 'array', maxItems: 60, 'x-label': 'Itens', 'x-item-title': 'label',
        items: {
          type: 'object', required: ['id', 'label', 'x', 'y'], additionalProperties: false,
          properties: {
            id: { type: 'string' }, label: { type: 'string', description: 'Texto do item' },
            x: { type: 'number', description: '0 (esquerda) a 100 (direita)' }, y: { type: 'number', description: '0 (embaixo) a 100 (em cima)' },
            tone, note: { type: 'string', description: 'Nota curta (aparece na legenda)' },
          },
        },
      },
    },
  },
  unique: ['items[].id'],
  refs: [],
  // Reveal one item per step in decks/articles.
  steps: (doc) => (doc.items || []).length,
  empty: (title = 'Matriz impacto × esforço') => ({
    kind: 'quadrant', title,
    xAxis: { label: 'Esforço', low: 'Baixo', high: 'Alto' },
    yAxis: { label: 'Impacto', low: 'Baixo', high: 'Alto' },
    quadrants: ['Ganhos rápidos', 'Projetos estratégicos', 'Preencher agenda', 'Evitar'],
    items: [
      { id: 'i1', label: 'Prompt caching', x: 20, y: 80, tone: 'success' },
      { id: 'i2', label: 'Agente multi-etapas', x: 75, y: 85, tone: 'accent' },
      { id: 'i3', label: 'Ajuste de prompt', x: 25, y: 35 },
      { id: 'i4', label: 'Fine-tuning próprio', x: 85, y: 30, tone: 'danger' },
    ],
  }),
  describe: (doc) => `Matriz 2×2: eixo X ${doc.xAxis?.label || ''} (${doc.xAxis?.low} → ${doc.xAxis?.high}), eixo Y ${doc.yAxis?.label || ''} (${doc.yAxis?.low} → ${doc.yAxis?.high}). Itens: ${(doc.items || []).map(i => `${i.label} (x ${i.x}, y ${i.y})`).join('; ')}.`,
}
