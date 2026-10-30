// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Typed diagram: flywheel (virtuous cycle) ───
// 3–8 stages around a wheel, connected clockwise by curved arrows, with a
// center label (the outcome the wheel compounds). Optional inputs are
// accelerators feeding a given stage from outside. One stage per step.
const tone = { type: 'string', enum: ['accent', 'info', 'success', 'warn', 'danger', 'neutral', 'purple', 'teal', 'pink'], description: 'Cor do estágio (opcional)' }

export default {
  kind: 'flywheel',
  label: 'Flywheel (ciclo virtuoso)',
  description: 'Estágios que se reforçam em ciclo, com aceleradores alimentando a roda.',
  category: 'business',
  schema: {
    type: 'object',
    required: ['center', 'stages'],
    additionalProperties: false,
    properties: {
      center: { type: 'string', description: 'Resultado no centro da roda (ex.: Crescimento)', 'x-label': 'Centro' },
      stages: {
        type: 'array', minItems: 3, maxItems: 8, 'x-label': 'Estágios', 'x-item-title': 'label',
        description: 'Estágios em sentido horário, começando no topo',
        items: {
          type: 'object', required: ['id', 'label'], additionalProperties: false,
          properties: {
            id: { type: 'string' },
            label: { type: 'string', description: 'Nome curto do estágio (dentro do círculo)' },
            desc: { type: 'string', description: 'Descrição curta (fora da roda)', 'x-multiline': true },
            tone,
          },
        },
      },
      inputs: {
        type: 'array', maxItems: 8, 'x-label': 'Aceleradores', 'x-item-title': 'label',
        description: 'Entradas externas que aceleram um estágio',
        items: {
          type: 'object', required: ['label', 'toStage'], additionalProperties: false,
          properties: {
            label: { type: 'string', description: 'Texto do acelerador' },
            toStage: { type: 'string', 'x-ref': 'stages[].id', description: 'Estágio alimentado' },
          },
        },
      },
    },
  },
  unique: ['stages[].id'],
  refs: [{ from: 'inputs[].toStage', to: 'stages[].id' }],
  // Reveal stages clockwise (arrows and inputs follow their stage).
  steps: (doc) => (doc.stages || []).length,
  empty: (title = 'Flywheel do serviço público digital') => ({
    kind: 'flywheel', title,
    center: 'Confiança do cidadão',
    stages: [
      { id: 'exp', label: 'Melhor experiência', desc: 'Jornadas simples no gov.br, com assistente de IA generativa', tone: 'accent' },
      { id: 'uso', label: 'Mais uso digital', desc: 'Cidadãos migram do balcão para o canal digital', tone: 'info' },
      { id: 'dados', label: 'Mais dados', desc: 'Feedback e telemetria mostram onde a jornada trava', tone: 'teal' },
      { id: 'custo', label: 'Menor custo por atendimento', desc: 'Automação libera servidores para casos complexos', tone: 'success' },
      { id: 'invest', label: 'Reinvestimento', desc: 'Economia financia novos serviços digitais', tone: 'purple' },
    ],
    inputs: [
      { label: 'Nuvem AWS elástica', toStage: 'custo' },
      { label: 'Amazon Bedrock', toStage: 'exp' },
    ],
  }),
  samples: [
    {
      title: 'Flywheel da plataforma de dados abertos',
      center: 'Valor público dos dados',
      stages: [
        { id: 's1', label: 'Publicação', desc: 'Órgãos publicam conjuntos no catálogo' },
        { id: 's2', label: 'Descoberta', desc: 'Busca semântica encontra o dado certo' },
        { id: 's3', label: 'Uso', desc: 'Pesquisadores e startups consomem via API' },
        { id: 's4', label: 'Aplicações', desc: 'Novos apps e painéis para a sociedade' },
        { id: 's5', label: 'Feedback', desc: 'Usuários apontam erros e lacunas' },
        { id: 's6', label: 'Qualidade', desc: 'Curadoria contínua melhora os dados' },
        { id: 's7', label: 'Confiança', desc: 'Mais órgãos confiam e aderem' },
        { id: 's8', label: 'Escala', desc: 'Mais conjuntos, menor custo marginal' },
      ],
      inputs: [
        { label: 'Lei de Acesso à Informação', toStage: 's1' },
        { label: 'Amazon S3 + AWS Glue', toStage: 's8' },
        { label: 'Hackathons', toStage: 's4' },
      ],
    },
  ],
  describe: (doc) => {
    const byId = Object.fromEntries((doc.stages || []).map(s => [s.id, s.label]))
    const st = (doc.stages || []).map(s => `${s.label}${s.desc ? ` (${s.desc})` : ''}`).join(' → ')
    const ins = (doc.inputs || []).map(i => `${i.label} → ${byId[i.toStage] || i.toStage}`).join('; ')
    return `Flywheel em torno de "${doc.center || ''}". Ciclo em sentido horário: ${st} → volta ao início.${ins ? ` Aceleradores: ${ins}.` : ''}`
  },
}
