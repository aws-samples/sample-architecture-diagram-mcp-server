// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Typed diagram: layers (layered stack) ───
// Full-width bands, listed top → bottom (e.g. architecture layers, OSI-like,
// capability stack), with optional cross-cutting side rails (security,
// observability) spanning a range of layers.
const tone = { type: 'string', enum: ['accent', 'info', 'success', 'warn', 'danger', 'neutral', 'purple', 'teal', 'pink'], description: 'Cor' }

export default {
  kind: 'layers',
  label: 'Camadas',
  description: 'Pilha de camadas (arquitetura, capacidades, OSI) com trilhos transversais como segurança e observabilidade.',
  category: 'structure',
  schema: {
    type: 'object',
    required: ['layers'],
    additionalProperties: false,
    properties: {
      layers: {
        type: 'array', minItems: 1, maxItems: 12, 'x-label': 'Camadas', 'x-item-title': 'label',
        description: 'Camadas de cima para baixo (a última é a fundação)',
        items: {
          type: 'object', required: ['id', 'label'], additionalProperties: false,
          properties: {
            id: { type: 'string', description: 'Identificador' },
            label: { type: 'string', description: 'Nome da camada' },
            desc: { type: 'string', 'x-multiline': true, description: 'Descrição curta (abaixo do nome)' },
            items: { type: 'array', maxItems: 16, items: { type: 'string' }, 'x-label': 'Itens', description: 'Componentes / serviços da camada' },
            tone,
          },
        },
      },
      sideRails: {
        type: 'array', maxItems: 4, 'x-label': 'Trilhos transversais', 'x-item-title': 'label',
        description: 'Preocupações transversais desenhadas como barras verticais à direita',
        items: {
          type: 'object', required: ['label'], additionalProperties: false,
          properties: {
            label: { type: 'string', description: 'Nome (ex.: Segurança)' },
            tone,
            span: {
              type: 'array', minItems: 2, maxItems: 2, items: { type: 'string', 'x-ref': 'layers[].id' }, 'x-label': 'Abrangência',
              description: 'Primeira e última camada cobertas (vazio = todas)',
            },
          },
        },
      },
    },
  },
  unique: ['layers[].id'],
  refs: [{ from: 'sideRails[].span[]', to: 'layers[].id' }],
  // Reveal layers bottom → top (foundation first); side rails on the last step.
  steps: (doc) => (doc.layers || []).length + ((doc.sideRails || []).length ? 1 : 0),
  empty: (title = 'Plataforma de IA generativa para o governo') => ({
    kind: 'layers', title,
    layers: [
      { id: 'exp', label: 'Experiência', desc: 'Canais do cidadão e do servidor', items: ['Portal gov.br', 'Assistente no WhatsApp', 'Painel do servidor'], tone: 'pink' },
      { id: 'app', label: 'Aplicações e agentes', desc: 'Casos de uso de negócio', items: ['Amazon Bedrock AgentCore', 'Agente de atendimento', 'Amazon Q Business'], tone: 'purple' },
      { id: 'orq', label: 'Orquestração e RAG', items: ['Amazon Bedrock Knowledge Bases', 'Amazon Bedrock Guardrails', 'AWS Step Functions'], tone: 'info' },
      { id: 'mod', label: 'Modelos', desc: 'Escolha por caso de uso', items: ['Anthropic Claude', 'Amazon Nova', 'Meta Llama', 'Amazon SageMaker AI'], tone: 'teal' },
      { id: 'dados', label: 'Dados', items: ['Amazon S3', 'Amazon OpenSearch Serverless', 'Amazon Aurora PostgreSQL', 'AWS Glue'], tone: 'success' },
      { id: 'infra', label: 'Fundação', desc: 'Contas, rede e computação', items: ['AWS Control Tower', 'Amazon VPC', 'AWS Lambda', 'Amazon EKS'], tone: 'neutral' },
    ],
    sideRails: [
      { label: 'Segurança e LGPD', tone: 'danger' },
      { label: 'Observabilidade', tone: 'accent', span: ['app', 'infra'] },
      { label: 'Governança de IA', tone: 'purple', span: ['app', 'mod'] },
    ],
  }),
  samples: [
    {
      title: 'Arquitetura de referência de dados (rótulos longos, muitos itens)',
      layers: [
        { id: 'cons', label: 'Consumo analítico e painéis de transparência pública', desc: 'Painéis para gestores, órgãos de controle e sociedade; APIs de dados abertos com limites de uso', items: ['Amazon QuickSight', 'Portal de dados abertos', 'API Gateway', 'Notebooks', 'Relatórios regulatórios', 'Exportação CSV'] },
        { id: 'proc', label: 'Processamento', items: ['AWS Glue', 'Amazon EMR Serverless', 'Amazon Athena', 'Amazon Redshift Serverless', 'AWS Step Functions', 'Amazon MWAA', 'dbt', 'Validação de qualidade', 'Mascaramento de CPF', 'Deduplicação', 'Enriquecimento geográfico', 'Particionamento por competência'] },
        { id: 'arm', label: 'Armazenamento', desc: 'Zonas bruta, refinada e curada', items: ['Amazon S3', 'Apache Iceberg', 'Amazon S3 Tables'] },
        { id: 'ing', label: 'Ingestão' },
      ],
      sideRails: [
        { label: 'Catálogo, linhagem e controle de acesso com AWS Lake Formation', span: ['cons', 'arm'] },
      ],
    },
  ],
  describe: (doc) => {
    const ls = doc.layers || []
    const rails = doc.sideRails || []
    return `Pilha de ${ls.length} camadas, de cima para baixo: ${ls.map(l => `${l.label}${l.items?.length ? ` (${l.items.join(', ')})` : ''}`).join('; ')}.` +
      (rails.length ? ` Trilhos transversais: ${rails.map(r => r.label + (r.span?.length === 2 ? ` (de ${ls.find(l => l.id === r.span[0])?.label || r.span[0]} a ${ls.find(l => l.id === r.span[1])?.label || r.span[1]})` : ' (todas as camadas)')).join('; ')}.` : '')
  },
}
