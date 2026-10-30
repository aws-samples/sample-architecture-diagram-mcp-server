// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Typed diagram: er (entity-relationship / database schema) ───
// Tables (entities) with typed columns (PK/FK markers) and relationships drawn
// with crow's-foot notation at each end. Layout via dagre (LR or TB).
const tone = { type: 'string', enum: ['accent', 'info', 'success', 'warn', 'danger', 'neutral', 'purple', 'teal', 'pink'] }
const card = { type: 'string', enum: ['1', '0..1', '1..*', '0..*'] }

export default {
  kind: 'er',
  label: 'Entidade-relacionamento (ER)',
  description: 'Esquema de banco de dados: tabelas, colunas (PK/FK) e cardinalidades em notação pé-de-galinha.',
  category: 'data',
  schema: {
    type: 'object',
    required: ['entities'],
    additionalProperties: false,
    properties: {
      direction: { type: 'string', enum: ['LR', 'TB'], 'x-label': 'Direção', description: 'LR = da esquerda para a direita (padrão); TB = de cima para baixo' },
      entities: {
        type: 'array', minItems: 1, maxItems: 40, 'x-label': 'Entidades', 'x-item-title': 'label',
        items: {
          type: 'object', required: ['id', 'label', 'columns'], additionalProperties: false,
          properties: {
            id: { type: 'string', description: 'Identificador único da entidade' },
            label: { type: 'string', description: 'Nome da tabela' },
            tone: { ...tone, description: 'Cor do cabeçalho' },
            columns: {
              type: 'array', maxItems: 40, 'x-label': 'Colunas', 'x-item-title': 'name',
              items: {
                type: 'object', required: ['name'], additionalProperties: false,
                properties: {
                  name: { type: 'string', description: 'Nome da coluna' },
                  type: { type: 'string', description: 'Tipo (ex.: uuid, varchar(120), date)' },
                  pk: { type: 'boolean', description: 'Chave primária' },
                  fk: { type: 'boolean', description: 'Chave estrangeira' },
                  nullable: { type: 'boolean', description: 'Aceita nulo (exibe "?" após o tipo)' },
                  note: { type: 'string', description: 'Observação curta (aparece abaixo do nome)' },
                },
              },
            },
          },
        },
      },
      relations: {
        type: 'array', maxItems: 80, 'x-label': 'Relacionamentos', 'x-item-title': 'label',
        items: {
          type: 'object', required: ['from', 'to', 'fromCard', 'toCard'], additionalProperties: false,
          properties: {
            from: { type: 'string', 'x-ref': 'entities[].id', description: 'Entidade de origem' },
            to: { type: 'string', 'x-ref': 'entities[].id', description: 'Entidade de destino' },
            fromCard: { ...card, description: 'Cardinalidade no lado da origem' },
            toCard: { ...card, description: 'Cardinalidade no lado do destino' },
            label: { type: 'string', description: 'Verbo do relacionamento (ex.: "solicita")' },
          },
        },
      },
    },
  },
  unique: ['entities[].id'],
  refs: [
    { from: 'relations[].from', to: 'entities[].id' },
    { from: 'relations[].to', to: 'entities[].id' },
  ],
  // Reveal one entity per step; a relation appears once both ends are shown.
  steps: (doc) => (doc.entities || []).length,
  empty: (title = 'Sistema de benefícios previdenciários') => ({
    kind: 'er', title, direction: 'LR',
    entities: [
      {
        id: 'cidadao', label: 'cidadao', tone: 'info',
        columns: [
          { name: 'id', type: 'uuid', pk: true },
          { name: 'cpf', type: 'char(11)', note: 'único, validado na Receita' },
          { name: 'nome', type: 'varchar(120)' },
          { name: 'data_nascimento', type: 'date' },
          { name: 'email', type: 'varchar(160)', nullable: true },
        ],
      },
      {
        id: 'requerimento', label: 'requerimento', tone: 'accent',
        columns: [
          { name: 'id', type: 'uuid', pk: true },
          { name: 'cidadao_id', type: 'uuid', fk: true },
          { name: 'beneficio_id', type: 'uuid', fk: true },
          { name: 'status', type: 'varchar(20)' },
          { name: 'protocolo', type: 'varchar(24)' },
          { name: 'criado_em', type: 'timestamptz' },
        ],
      },
      {
        id: 'beneficio', label: 'tipo_beneficio', tone: 'success',
        columns: [
          { name: 'id', type: 'uuid', pk: true },
          { name: 'codigo', type: 'varchar(8)' },
          { name: 'descricao', type: 'text' },
        ],
      },
      {
        id: 'documento', label: 'documento', tone: 'purple',
        columns: [
          { name: 'id', type: 'uuid', pk: true },
          { name: 'requerimento_id', type: 'uuid', fk: true },
          { name: 's3_key', type: 'varchar(512)', note: 'objeto no Amazon S3' },
          { name: 'hash_sha256', type: 'char(64)' },
        ],
      },
      {
        id: 'analise', label: 'analise_ia', tone: 'teal',
        columns: [
          { name: 'id', type: 'uuid', pk: true },
          { name: 'requerimento_id', type: 'uuid', fk: true },
          { name: 'modelo', type: 'varchar(64)', note: 'Amazon Bedrock' },
          { name: 'parecer', type: 'text' },
          { name: 'confianca', type: 'numeric(4,3)' },
          { name: 'revisado_por', type: 'uuid', nullable: true },
        ],
      },
    ],
    relations: [
      { from: 'cidadao', to: 'requerimento', fromCard: '1', toCard: '0..*', label: 'solicita' },
      { from: 'beneficio', to: 'requerimento', fromCard: '1', toCard: '0..*', label: 'classifica' },
      { from: 'requerimento', to: 'documento', fromCard: '1', toCard: '1..*', label: 'anexa' },
      { from: 'requerimento', to: 'analise', fromCard: '1', toCard: '0..1', label: 'recebe' },
    ],
  }),
  describe: (doc) => {
    const ents = doc.entities || []
    const name = (id) => ents.find(e => e.id === id)?.label || id
    return `Diagrama entidade-relacionamento com ${ents.length} tabela(s): ${ents.map(e => `${e.label} (${(e.columns || []).map(c => c.name + (c.pk ? ' PK' : '') + (c.fk ? ' FK' : '')).join(', ')})`).join('; ')}. Relacionamentos: ${(doc.relations || []).map(r => `${name(r.from)} ${r.fromCard} — ${r.toCard} ${name(r.to)}${r.label ? ` (${r.label})` : ''}`).join('; ') || 'nenhum'}.`
  },
  samples: [
    {
      title: 'Plataforma de atendimento com IA generativa — esquema completo', direction: 'TB',
      entities: [
        { id: 'orgao', label: 'orgao_publico', tone: 'info', columns: [{ name: 'id', type: 'uuid', pk: true }, { name: 'sigla', type: 'varchar(16)' }, { name: 'nome_completo_do_orgao', type: 'varchar(255)' }] },
        { id: 'servidor', label: 'servidor_responsavel_pelo_atendimento', tone: 'neutral', columns: [{ name: 'id', type: 'uuid', pk: true }, { name: 'orgao_id', type: 'uuid', fk: true }, { name: 'gestor_id', type: 'uuid', fk: true, nullable: true, note: 'autorrelacionamento hierárquico' }, { name: 'matricula_siape', type: 'char(7)' }] },
        { id: 'conversa', label: 'conversa', tone: 'accent', columns: [{ name: 'id', type: 'uuid', pk: true }, { name: 'orgao_id', type: 'uuid', fk: true }, { name: 'servidor_id', type: 'uuid', fk: true, nullable: true }, { name: 'canal', type: 'varchar(16)' }, { name: 'iniciada_em', type: 'timestamptz' }] },
        { id: 'mensagem', label: 'mensagem', tone: 'purple', columns: [{ name: 'id', type: 'bigint', pk: true }, { name: 'conversa_id', type: 'uuid', fk: true }, { name: 'papel', type: 'varchar(10)' }, { name: 'conteudo', type: 'text' }, { name: 'tokens_entrada', type: 'int' }, { name: 'tokens_saida', type: 'int' }] },
        { id: 'chamada', label: 'chamada_ferramenta', tone: 'teal', columns: [{ name: 'id', type: 'bigint', pk: true }, { name: 'mensagem_id', type: 'bigint', fk: true }, { name: 'ferramenta', type: 'varchar(64)' }, { name: 'argumentos', type: 'jsonb' }, { name: 'latencia_ms', type: 'int' }] },
        { id: 'avaliacao', label: 'avaliacao', tone: 'success', columns: [{ name: 'conversa_id', type: 'uuid', pk: true, fk: true }, { name: 'nota', type: 'smallint' }, { name: 'comentario', type: 'text', nullable: true }] },
        { id: 'fonte', label: 'fonte_conhecimento', tone: 'warn', columns: [{ name: 'id', type: 'uuid', pk: true }, { name: 'orgao_id', type: 'uuid', fk: true }, { name: 'uri', type: 'varchar(1024)', note: 'Amazon Bedrock Knowledge Bases' }] },
      ],
      relations: [
        { from: 'orgao', to: 'servidor', fromCard: '1', toCard: '1..*', label: 'lota' },
        { from: 'servidor', to: 'servidor', fromCard: '0..1', toCard: '0..*', label: 'chefia' },
        { from: 'orgao', to: 'conversa', fromCard: '1', toCard: '0..*', label: 'atende' },
        { from: 'servidor', to: 'conversa', fromCard: '0..1', toCard: '0..*', label: 'assume' },
        { from: 'conversa', to: 'mensagem', fromCard: '1', toCard: '1..*', label: 'contém' },
        { from: 'mensagem', to: 'chamada', fromCard: '1', toCard: '0..*', label: 'aciona' },
        { from: 'conversa', to: 'avaliacao', fromCard: '1', toCard: '0..1', label: 'recebe' },
        { from: 'orgao', to: 'fonte', fromCard: '1', toCard: '0..*', label: 'publica' },
      ],
    },
  ],
}
