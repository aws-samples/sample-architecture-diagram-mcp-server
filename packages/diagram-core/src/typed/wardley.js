// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Typed diagram: wardley (Wardley map) ───
// Components on two axes: visibility to the user (Y, top = visible) and
// evolution (X: genesis → custom → product → commodity). Links are the value
// chain (dependency, drawn top → down); evolveTo draws a dashed red arrow to
// the component's expected future position. One component per step.
const unit = (d) => ({ type: 'number', description: d })

export default {
  kind: 'wardley',
  label: 'Mapa de Wardley',
  description: 'Cadeia de valor posicionada por visibilidade ao usuário e estágio de evolução.',
  category: 'business',
  schema: {
    type: 'object',
    required: ['components', 'links'],
    additionalProperties: false,
    properties: {
      components: {
        type: 'array', minItems: 1, maxItems: 40, 'x-label': 'Componentes', 'x-item-title': 'label',
        items: {
          type: 'object', required: ['id', 'label', 'visibility', 'evolution'], additionalProperties: false,
          properties: {
            id: { type: 'string' },
            label: { type: 'string', description: 'Nome do componente' },
            visibility: unit('Visibilidade: 0 (invisível, base da cadeia) a 1 (visível ao usuário, topo)'),
            evolution: unit('Evolução: 0 (gênese) → 0,17 sob medida → 0,4 produto → 0,7 commodity → 1'),
            type: { type: 'string', enum: ['component', 'anchor', 'market'], description: 'component (padrão), anchor (usuário/necessidade, em negrito) ou market (mercado)' },
            evolveTo: unit('Posição futura de evolução (0 a 1) — seta tracejada vermelha'),
            note: { type: 'string', description: 'Nota curta exibida abaixo do rótulo' },
          },
        },
      },
      links: {
        type: 'array', maxItems: 80, 'x-label': 'Dependências', 'x-item-title': 'from',
        description: 'Cadeia de valor: "from" depende de "to" (de cima para baixo)',
        items: {
          type: 'object', required: ['from', 'to'], additionalProperties: false,
          properties: {
            from: { type: 'string', 'x-ref': 'components[].id', description: 'Componente que depende' },
            to: { type: 'string', 'x-ref': 'components[].id', description: 'Componente do qual depende' },
          },
        },
      },
      annotations: {
        type: 'array', maxItems: 12, 'x-label': 'Anotações', 'x-item-title': 'label',
        items: {
          type: 'object', required: ['x', 'y', 'label'], additionalProperties: false,
          properties: {
            x: unit('Posição na evolução (0 a 1)'), y: unit('Posição na visibilidade (0 a 1)'),
            label: { type: 'string', description: 'Texto da anotação' },
          },
        },
      },
    },
  },
  unique: ['components[].id'],
  refs: [
    { from: 'links[].from', to: 'components[].id' },
    { from: 'links[].to', to: 'components[].id' },
  ],
  // Reveal one component per step (links appear once both ends are shown).
  steps: (doc) => (doc.components || []).length,
  empty: (title = 'Mapa de Wardley — assistente de IA generativa ao cidadão') => ({
    kind: 'wardley', title,
    components: [
      { id: 'cidadao', label: 'Cidadão', type: 'anchor', visibility: 0.97, evolution: 0.58 },
      { id: 'portal', label: 'Portal gov.br', visibility: 0.84, evolution: 0.66 },
      { id: 'assist', label: 'Assistente virtual', visibility: 0.8, evolution: 0.3, evolveTo: 0.48 },
      { id: 'agentes', label: 'Orquestração de agentes', visibility: 0.64, evolution: 0.2 },
      { id: 'rag', label: 'Base de conhecimento (RAG)', visibility: 0.54, evolution: 0.36 },
      { id: 'guard', label: 'Guardrails', visibility: 0.6, evolution: 0.55 },
      { id: 'llm', label: 'LLM fundacional', visibility: 0.42, evolution: 0.52, evolveTo: 0.78 },
      { id: 'dados', label: 'Dados de serviços públicos', visibility: 0.38, evolution: 0.12 },
      { id: 'vetor', label: 'Banco vetorial', visibility: 0.33, evolution: 0.6 },
      { id: 'gpu', label: 'GPU / aceleradores', visibility: 0.2, evolution: 0.66 },
      { id: 'nuvem', label: 'Computação em nuvem', visibility: 0.14, evolution: 0.86 },
      { id: 'energia', label: 'Energia', visibility: 0.04, evolution: 0.95 },
    ],
    links: [
      { from: 'cidadao', to: 'portal' }, { from: 'portal', to: 'assist' }, { from: 'cidadao', to: 'assist' },
      { from: 'assist', to: 'agentes' }, { from: 'assist', to: 'guard' },
      { from: 'agentes', to: 'rag' }, { from: 'agentes', to: 'llm' },
      { from: 'rag', to: 'dados' }, { from: 'rag', to: 'vetor' },
      { from: 'llm', to: 'gpu' }, { from: 'vetor', to: 'nuvem' }, { from: 'gpu', to: 'nuvem' }, { from: 'nuvem', to: 'energia' },
    ],
    annotations: [
      { x: 0.08, y: 0.25, label: 'Diferencial: dados próprios do órgão' },
    ],
  }),
  samples: [
    {
      title: 'Plataforma de dados do governo — evolução planejada',
      components: [
        { id: 'gestor', label: 'Gestor público', type: 'anchor', visibility: 0.97, evolution: 0.42 },
        { id: 'pesq', label: 'Pesquisador', type: 'anchor', visibility: 0.97, evolution: 0.74 },
        { id: 'painel', label: 'Painéis de indicadores', visibility: 0.84, evolution: 0.5, evolveTo: 0.72, note: 'migrar para Amazon Quick' },
        { id: 'api', label: 'API de dados abertos', visibility: 0.78, evolution: 0.3, evolveTo: 0.55 },
        { id: 'ml', label: 'Modelos preditivos', visibility: 0.66, evolution: 0.14, evolveTo: 0.34, note: 'MLOps ainda manual' },
        { id: 'cat', label: 'Catálogo de dados', visibility: 0.58, evolution: 0.4 },
        { id: 'mkt', label: 'Marketplace de dados', type: 'market', visibility: 0.62, evolution: 0.62 },
        { id: 'etl', label: 'Pipelines ETL', visibility: 0.46, evolution: 0.32, evolveTo: 0.6 },
        { id: 'lake', label: 'Data lake', visibility: 0.34, evolution: 0.55, evolveTo: 0.78 },
        { id: 'legado', label: 'Bases legadas (mainframe)', visibility: 0.3, evolution: 0.08 },
        { id: 's3', label: 'Armazenamento de objetos', visibility: 0.14, evolution: 0.9 },
        { id: 'comp', label: 'Computação', visibility: 0.08, evolution: 0.8 },
      ],
      links: [
        { from: 'gestor', to: 'painel' }, { from: 'gestor', to: 'ml' }, { from: 'pesq', to: 'api' }, { from: 'pesq', to: 'mkt' },
        { from: 'painel', to: 'cat' }, { from: 'api', to: 'cat' }, { from: 'ml', to: 'etl' }, { from: 'mkt', to: 'cat' },
        { from: 'cat', to: 'lake' }, { from: 'etl', to: 'lake' }, { from: 'etl', to: 'legado' },
        { from: 'lake', to: 's3' }, { from: 'lake', to: 'comp' }, { from: 'etl', to: 'comp' },
      ],
      annotations: [
        { x: 0.04, y: 0.5, label: 'Inércia: contratos do legado' },
        { x: 0.8, y: 0.5, label: 'Serviços gerenciados AWS' },
      ],
    },
  ],
  describe: (doc) => {
    const byId = Object.fromEntries((doc.components || []).map(c => [c.id, c.label]))
    const comps = (doc.components || []).map(c => `${c.label}${c.type === 'anchor' ? ' (âncora)' : c.type === 'market' ? ' (mercado)' : ''} — visibilidade ${c.visibility}, evolução ${c.evolution}${c.evolveTo != null ? ` → ${c.evolveTo}` : ''}`).join('; ')
    const links = (doc.links || []).map(l => `${byId[l.from] || l.from} → ${byId[l.to] || l.to}`).join('; ')
    return `Mapa de Wardley (Y visibilidade, X evolução: gênese, sob medida, produto, commodity). Componentes: ${comps}. Dependências: ${links}.`
  },
}
