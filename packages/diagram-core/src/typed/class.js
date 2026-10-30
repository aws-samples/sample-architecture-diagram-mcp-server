// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Typed diagram: class (UML class diagram) ───
// Three-compartment class boxes (name/stereotype, attributes, methods) and UML
// relationships with the standard arrowheads. Layout via dagre (TB).
// Direction conventions:
//   inheritance / realization: from = subclass/implementation → to = parent/interface (hollow triangle at `to`)
//   aggregation / composition: from = whole → to = part (diamond at `from`)
//   association / dependency:  from → to (open arrow at `to`; dependency dashed)
const relType = { type: 'string', enum: ['inheritance', 'realization', 'association', 'aggregation', 'composition', 'dependency'] }

export default {
  kind: 'class',
  label: 'Classes UML',
  description: 'Diagrama de classes UML: atributos, métodos, estereótipos e relações (herança, realização, composição…).',
  category: 'software',
  schema: {
    type: 'object',
    required: ['classes'],
    additionalProperties: false,
    properties: {
      classes: {
        type: 'array', minItems: 1, maxItems: 40, 'x-label': 'Classes', 'x-item-title': 'name',
        items: {
          type: 'object', required: ['id', 'name'], additionalProperties: false,
          properties: {
            id: { type: 'string', description: 'Identificador único da classe' },
            name: { type: 'string', description: 'Nome da classe' },
            stereotype: { type: 'string', description: 'Estereótipo (ex.: interface, abstract, enum, service)' },
            attributes: { type: 'array', maxItems: 30, items: { type: 'string' }, 'x-label': 'Atributos', description: 'Um por linha, ex.: "+ id: string"' },
            methods: { type: 'array', maxItems: 30, items: { type: 'string' }, 'x-label': 'Métodos', description: 'Um por linha, ex.: "+ executar(entrada): Resultado"' },
          },
        },
      },
      relations: {
        type: 'array', maxItems: 80, 'x-label': 'Relações', 'x-item-title': 'label',
        items: {
          type: 'object', required: ['from', 'to', 'type'], additionalProperties: false,
          properties: {
            from: { type: 'string', 'x-ref': 'classes[].id', description: 'Herança/realização: a subclasse. Agregação/composição: o todo. Demais: a origem.' },
            to: { type: 'string', 'x-ref': 'classes[].id', description: 'Herança/realização: a superclasse/interface. Agregação/composição: a parte. Demais: o destino.' },
            type: { ...relType, description: 'Tipo da relação UML' },
            label: { type: 'string', description: 'Rótulo da relação' },
            fromMult: { type: 'string', description: 'Multiplicidade na origem (ex.: 1, 0..*)' },
            toMult: { type: 'string', description: 'Multiplicidade no destino (ex.: 1..*)' },
          },
        },
      },
    },
  },
  unique: ['classes[].id'],
  refs: [
    { from: 'relations[].from', to: 'classes[].id' },
    { from: 'relations[].to', to: 'classes[].id' },
  ],
  // Reveal one class per step; a relation appears once both ends are shown.
  steps: (doc) => (doc.classes || []).length,
  empty: (title = 'Agente com uso de ferramentas (tool use)') => ({
    kind: 'class', title,
    classes: [
      { id: 'agente', name: 'Agente', attributes: ['- modelo: string', '- maxIteracoes: int'], methods: ['+ executar(pedido: string): Resposta', '- planejar(contexto): Passo[]'] },
      { id: 'ferramenta', name: 'Ferramenta', stereotype: 'interface', methods: ['+ nome(): string', '+ esquema(): JSONSchema', '+ invocar(args): Resultado'] },
      { id: 'memoria', name: 'Memoria', attributes: ['- janelaTokens: int'], methods: ['+ lembrar(msg: Mensagem)', '+ recuperar(k: int): Mensagem[]'] },
      { id: 'mensagem', name: 'Mensagem', attributes: ['+ papel: Papel', '+ conteudo: string'] },
      { id: 'consultaBase', name: 'ConsultaBaseConhecimento', attributes: ['- kbId: string'], methods: ['+ invocar(args): Resultado'] },
      { id: 'abrirChamado', name: 'AbrirChamado', attributes: ['- fila: string'], methods: ['+ invocar(args): Resultado'] },
      { id: 'bedrock', name: 'ClienteBedrock', stereotype: 'service', methods: ['+ converse(msgs, tools): Resposta'] },
    ],
    relations: [
      { from: 'agente', to: 'ferramenta', type: 'aggregation', fromMult: '1', toMult: '0..*', label: 'usa' },
      { from: 'agente', to: 'memoria', type: 'composition', fromMult: '1', toMult: '1' },
      { from: 'memoria', to: 'mensagem', type: 'composition', toMult: '0..*' },
      { from: 'consultaBase', to: 'ferramenta', type: 'realization' },
      { from: 'abrirChamado', to: 'ferramenta', type: 'realization' },
      { from: 'agente', to: 'bedrock', type: 'dependency', label: 'chama' },
    ],
  }),
  describe: (doc) => {
    const cls = doc.classes || []
    const name = (id) => cls.find(c => c.id === id)?.name || id
    const pt = { inheritance: 'herda de', realization: 'implementa', association: 'associa-se a', aggregation: 'agrega', composition: 'é composto de', dependency: 'depende de' }
    return `Diagrama de classes UML com ${cls.length} classe(s): ${cls.map(c => `${c.stereotype ? `«${c.stereotype}» ` : ''}${c.name}${(c.attributes || []).length ? ` (atributos: ${c.attributes.join(', ')})` : ''}${(c.methods || []).length ? ` (métodos: ${c.methods.join(', ')})` : ''}`).join('; ')}. Relações: ${(doc.relations || []).map(r => `${name(r.from)} ${pt[r.type] || r.type} ${name(r.to)}${r.label ? ` (${r.label})` : ''}`).join('; ') || 'nenhuma'}.`
  },
  samples: [
    {
      title: 'Domínio de concessão de benefícios — todas as relações',
      classes: [
        { id: 'entidade', name: 'EntidadeAuditavel', stereotype: 'abstract', attributes: ['# criadoEm: Instant', '# atualizadoPor: string'], methods: ['+ registrarAuditoria(evento: EventoDominio): void'] },
        { id: 'requerimento', name: 'RequerimentoDeBeneficioPrevidenciario', attributes: ['- protocolo: string', '- situacao: SituacaoRequerimento', '- solicitante: Cidadao'], methods: ['+ submeter(): void', '+ deferir(parecer: Parecer): void', '+ indeferir(motivo: string): void'] },
        { id: 'situacao', name: 'SituacaoRequerimento', stereotype: 'enum', attributes: ['RASCUNHO', 'EM_ANALISE', 'DEFERIDO', 'INDEFERIDO'] },
        { id: 'cidadao', name: 'Cidadao', attributes: ['- cpf: Cpf', '- nome: string'] },
        { id: 'parecer', name: 'Parecer', attributes: ['- texto: string', '- confianca: float'] },
        { id: 'analisador', name: 'AnalisadorAutomatico', stereotype: 'interface', methods: ['+ analisar(r: Requerimento): Parecer'] },
        { id: 'analisadorIa', name: 'AnalisadorBedrock', methods: ['+ analisar(r: Requerimento): Parecer'] },
        { id: 'tarefa', name: 'Tarefa', attributes: ['- subtarefas: Tarefa[]'], methods: ['+ concluir(): void'] },
      ],
      relations: [
        { from: 'requerimento', to: 'entidade', type: 'inheritance' },
        { from: 'requerimento', to: 'situacao', type: 'association', toMult: '1' },
        { from: 'requerimento', to: 'cidadao', type: 'association', label: 'solicitante', fromMult: '0..*', toMult: '1' },
        { from: 'requerimento', to: 'parecer', type: 'composition', fromMult: '1', toMult: '0..1' },
        { from: 'analisadorIa', to: 'analisador', type: 'realization' },
        { from: 'analisador', to: 'requerimento', type: 'dependency', label: 'analisa' },
        { from: 'tarefa', to: 'tarefa', type: 'aggregation', label: 'subtarefas', fromMult: '1', toMult: '0..*' },
        { from: 'requerimento', to: 'tarefa', type: 'aggregation', toMult: '0..*' },
      ],
    },
  ],
}
