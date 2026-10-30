// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Typed diagram: tree ───
// Hierarchy / org chart. Flat node list where each node points at its parent;
// exactly one node has no parent (the root). Top-down (TB) or left-right (LR).
const tone = { type: 'string', enum: ['accent', 'info', 'success', 'warn', 'danger', 'neutral', 'purple', 'teal', 'pink'], description: 'Cor do nó (padrão: cor do ramo)' }

export default {
  kind: 'tree',
  label: 'Árvore / organograma',
  description: 'Hierarquia de nós (organograma, decomposição, taxonomia) com um único nó raiz.',
  category: 'structure',
  schema: {
    type: 'object',
    required: ['nodes'],
    additionalProperties: false,
    properties: {
      direction: { type: 'string', enum: ['TB', 'LR'], 'x-label': 'Direção', description: 'TB: de cima para baixo (padrão); LR: da esquerda para a direita' },
      compactLeaves: { type: 'boolean', 'x-label': 'Folhas empilhadas', description: 'Em TB, empilha verticalmente as folhas de um mesmo pai (4 ou mais) para economizar largura. Padrão: sim' },
      nodes: {
        type: 'array', minItems: 1, maxItems: 120, 'x-label': 'Nós', 'x-item-title': 'label',
        description: 'Exatamente um nó sem pai (a raiz)',
        items: {
          type: 'object', required: ['id', 'label'], additionalProperties: false,
          properties: {
            id: { type: 'string' },
            label: { type: 'string', description: 'Texto principal' },
            sub: { type: 'string', description: 'Linha secundária (cargo, responsável, detalhe)' },
            parent: { type: 'string', 'x-ref': 'nodes[].id', description: 'Nó pai (vazio = raiz)' },
            tone,
          },
        },
      },
    },
  },
  unique: ['nodes[].id'],
  refs: [{ from: 'nodes[].parent', to: 'nodes[].id' }],
  // One step per depth level (root, then its children, ...).
  steps: (doc) => {
    const nodes = doc.nodes || []
    const byId = new Map(nodes.map(n => [n.id, n]))
    let max = -1
    for (const n of nodes) {
      let d = 0, cur = n; const seen = new Set()
      while (cur?.parent && byId.has(cur.parent) && !seen.has(cur.id)) { seen.add(cur.id); cur = byId.get(cur.parent); d++ }
      max = Math.max(max, d)
    }
    return max + 1
  },
  empty: (title = 'Centro de Excelência em Nuvem (CCoE)') => ({
    kind: 'tree', title, direction: 'TB',
    nodes: [
      { id: 'ccoe', label: 'CCoE', sub: 'Diretoria de TI', tone: 'accent' },
      { id: 'plat', label: 'Plataforma', sub: 'Landing zone e contas', parent: 'ccoe' },
      { id: 'sec', label: 'Segurança', sub: 'Identidade e conformidade', parent: 'ccoe' },
      { id: 'finops', label: 'FinOps', sub: 'Custos e orçamento', parent: 'ccoe' },
      { id: 'ia', label: 'IA generativa', sub: 'Amazon Bedrock', parent: 'ccoe' },
      { id: 'net', label: 'Redes', sub: 'Transit Gateway', parent: 'plat' },
      { id: 'iac', label: 'IaC e esteiras', sub: 'CDK e Terraform', parent: 'plat' },
      { id: 'iam', label: 'IAM Identity Center', parent: 'sec' },
      { id: 'det', label: 'Detecção', sub: 'Amazon GuardDuty', parent: 'sec' },
      { id: 'tag', label: 'Etiquetagem', sub: 'Showback por área', parent: 'finops' },
      { id: 'rag', label: 'RAG e agentes', sub: 'Bases de conhecimento', parent: 'ia' },
      { id: 'gov', label: 'IA responsável', sub: 'Guardrails', parent: 'ia' },
    ],
  }),
  samples: [
    {
      title: 'Decomposição do portal de serviços ao cidadão (LR)', direction: 'LR',
      nodes: [
        { id: 'r', label: 'Portal de Serviços ao Cidadão', sub: 'gov.br', tone: 'info' },
        { id: 'a', label: 'Atendimento', parent: 'r' },
        { id: 'b', label: 'Benefícios e auxílios sociais', parent: 'r' },
        { id: 'c', label: 'Documentos', parent: 'r' },
        { id: 'a1', label: 'Assistente virtual com IA generativa', sub: 'Amazon Bedrock Agents', parent: 'a' },
        { id: 'a2', label: 'Agendamento', sub: 'Amazon Connect', parent: 'a' },
        { id: 'b1', label: 'Solicitação', parent: 'b' },
        { id: 'b2', label: 'Acompanhamento', parent: 'b' },
        { id: 'b3', label: 'Recurso administrativo', parent: 'b', tone: 'warn' },
        { id: 'b11', label: 'Validação de identidade', sub: 'Login único', parent: 'b1' },
        { id: 'b12', label: 'Análise automática de elegibilidade', sub: 'AWS Step Functions', parent: 'b1' },
        { id: 'c1', label: 'Emissão digital', parent: 'c' },
        { id: 'c2', label: 'Assinatura', sub: 'ICP-Brasil', parent: 'c' },
      ],
    },
    {
      title: 'Organograma com muitas equipes (folhas empilhadas)',
      nodes: [
        { id: 'sec', label: 'Secretaria de Governo Digital', sub: 'Secretário', tone: 'accent' },
        { id: 'd1', label: 'Infraestrutura', sub: 'Diretoria', parent: 'sec' },
        { id: 'd2', label: 'Dados e IA', sub: 'Diretoria', parent: 'sec' },
        { id: 'd3', label: 'Experiência do cidadão', sub: 'Diretoria', parent: 'sec' },
        { id: 't1', label: 'Nuvem', parent: 'd1' }, { id: 't2', label: 'Redes', parent: 'd1' },
        { id: 't3', label: 'Observabilidade', parent: 'd1' }, { id: 't4', label: 'Continuidade de negócios', parent: 'd1' },
        { id: 't5', label: 'Engenharia de dados', parent: 'd2' }, { id: 't6', label: 'Ciência de dados', parent: 'd2' },
        { id: 't7', label: 'IA generativa', parent: 'd2' }, { id: 't8', label: 'Governança de dados', parent: 'd2' },
        { id: 't9', label: 'Proteção de dados (LGPD)', parent: 'd2' },
        { id: 't10', label: 'Design de serviços', parent: 'd3' }, { id: 't11', label: 'Acessibilidade', parent: 'd3' },
      ],
    },
  ],
  describe: (doc) => {
    const nodes = doc.nodes || []
    const root = nodes.find(n => !n.parent)
    const kids = (id) => nodes.filter(n => n.parent === id)
    const fmt = (n) => `${n.label}${n.sub ? ` (${n.sub})` : ''}`
    const lines = nodes.filter(n => kids(n.id).length).map(n => `${n.label} → ${kids(n.id).map(fmt).join(', ')}`)
    return `Árvore com ${nodes.length} nós${root ? `, raiz ${fmt(root)}` : ''}. ${lines.join('; ')}.`
  },
}
