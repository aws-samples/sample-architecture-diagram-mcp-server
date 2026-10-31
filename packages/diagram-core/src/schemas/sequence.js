// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// UML sequence document — the `generate_sequence_diagram` input (participants,
// events, fragments, groups, autoActivate, autoplay, stepMs, title, subtitle) as
// a JSON Schema plus a dependency-free validator (types + referential
// integrity), so a sequence authored in the MCP round-trips into any renderer
// unchanged. The MCP's zod schemas (lib/sequence-schemas.js) are kept in step
// by a test.
//
// Exports: SEQUENCE_KIND, MAX_PARTICIPANTS, MAX_EVENTS, sequenceDocSchema,
// validateSequence(d) → { valid, errors: string[] }.

export const SEQUENCE_KIND = 'sequence'

export const SEQ_TONES = ['accent', 'info', 'success', 'warn', 'danger', 'neutral']
export const SEQ_BADGES = ['gate', 'keyless', 'async', 'sync', 'phase', 'fail']
export const SEQ_ARROWS = ['sync', 'async', 'reply']
export const SEQ_FRAGMENTS = ['alt', 'opt', 'loop', 'par', 'break', 'critical', 'ref', 'neg', 'assert']

const TONES = SEQ_TONES, BADGES = SEQ_BADGES, ARROWS = SEQ_ARROWS, FRAGMENTS = SEQ_FRAGMENTS
export const MAX_PARTICIPANTS = 40
export const MAX_EVENTS = 400

const s = (description) => ({ type: 'string', ...(description ? { description } : {}) })
const b = (description) => ({ type: 'boolean', ...(description ? { description } : {}) })
const e = (values, description) => ({ type: 'string', enum: values, ...(description ? { description } : {}) })

const proof = {
  description: 'Free text (inline markdown) or a source ref {repo,path,ref,lines,url,text} rendered as a link.',
  anyOf: [{ type: 'string' }, {
    type: 'object', additionalProperties: false,
    properties: { repo: s(), path: s(), ref: s(), lines: { anyOf: [{ type: 'number' }, { type: 'string' }, { type: 'array', items: { type: 'number' } }] }, url: s(), text: s() },
  }],
}
const narration = {
  tone: e(TONES, 'Accent when this is the active step'),
  badge: e(BADGES, 'Semantic badge on the step'),
  title: s('Narration heading (falls back to label)'),
  flow: s('Sub-line under the heading (e.g. "SA → CodeCommit")'),
  desc: s('Narration text — inline markdown (**bold**, `code`, *italic*)'),
  proof,
}

export const sequenceDocSchema = {
  type: 'object',
  required: ['participants', 'events'],
  additionalProperties: true,
  properties: {
    kind: e([SEQUENCE_KIND], 'Diagram kind (when stored next to other kinds)'),
    title: s('Diagram title'),
    subtitle: s('Subtitle (inline markdown)'),
    participants: {
      type: 'array', description: 'Lifeline columns, left to right',
      items: {
        type: 'object', required: ['id', 'label'], additionalProperties: false,
        properties: {
          id: s('Stable id referenced by events'), label: s('Header label'), sub: s('Second header line'),
          service: s('AWS service name → header icon (e.g. "AWS Lambda")'),
          icon: s('Explicit icon: bare Arch_*.png name or a public path like "tech-icons/vault.svg"'),
          actor: b('Stick-figure actor instead of a box'), stereotype: s('UML stereotype («boundary», «control»…)'),
        },
      },
    },
    events: {
      type: 'array', description: 'Ordered steps: messages and notes',
      items: {
        type: 'object', required: ['kind', 'id'], additionalProperties: false,
        properties: {
          kind: e(['message', 'note'], 'message = arrow between lifelines; note = band over lifelines'),
          id: s('Stable id (fragment anchors)'),
          from: s('Source participant id (message)'), to: s('Target participant id (message; == from for a self-call)'),
          over: { type: 'array', items: { type: 'string' }, description: 'Participant ids a note spans (note)' },
          label: s('Arrow / note text'),
          arrow: e(ARROWS, 'sync (filled head), async (open head), reply (dashed)'),
          style: e(['solid', 'dashed'], 'Legacy: dashed = reply'),
          activate: b('Start an activation bar on `to`'), deactivate: b('Close the activation bar on `from`'),
          create: b('«create»: `to` starts at this step'), destroy: b('`to` ends here with an X'),
          found: b('Message from an unknown sender (boundary dot)'), lost: b('Message to an unknown receiver'),
          code: s('Code snippet under the narration'), codeLabel: s('Code header label'),
          ...narration,
        },
      },
    },
    fragments: {
      type: 'array', description: 'Combined fragments around a contiguous range of events',
      items: {
        type: 'object', required: ['kind', 'label', 'startId', 'endId'], additionalProperties: false,
        properties: {
          kind: e(FRAGMENTS), label: s('Guard / tab label'), startId: s('First event id'), endId: s('Last event id'),
          tone: e(TONES),
          dividers: { type: 'array', items: { type: 'object', required: ['beforeId', 'label'], additionalProperties: false, properties: { beforeId: s(), label: s() } } },
        },
      },
    },
    groups: {
      type: 'array', description: 'Boxes aggregating contiguous participant columns',
      items: {
        type: 'object', required: ['label', 'participants'], additionalProperties: false,
        properties: { label: s(), participants: { type: 'array', items: { type: 'string' } }, tone: e(TONES) },
      },
    },
    autoActivate: b('Derive activation bars automatically (default true)'),
    autoplay: b('MCP player only'),
    stepMs: { type: 'number', description: 'MCP player only: ms per step' },
  },
}

const isStr = (v) => typeof v === 'string' && v.length > 0

// Types + referential integrity.
export function validateSequence(d) {
  const errors = []
  if (!d || typeof d !== 'object') return { valid: false, errors: ['sequence: must be an object'] }
  const P = d.participants, EV = d.events
  if (!Array.isArray(P)) errors.push('participants: required array')
  else if (P.length > MAX_PARTICIPANTS) errors.push(`participants: at most ${MAX_PARTICIPANTS}`)
  if (!Array.isArray(EV)) errors.push('events: required array')
  else if (EV.length > MAX_EVENTS) errors.push(`events: at most ${MAX_EVENTS}`)
  const pids = new Set(), eids = new Set()
  ;(Array.isArray(P) ? P : []).forEach((p, i) => {
    if (!p || typeof p !== 'object' || !isStr(p.id)) { errors.push(`participants[${i}].id: required string`); return }
    if (pids.has(p.id)) errors.push(`participants[${i}].id: duplicate "${p.id}"`)
    pids.add(p.id)
    if (typeof p.label !== 'string') errors.push(`participants[${i}].label: required string`)
  })
  ;(Array.isArray(EV) ? EV : []).forEach((ev, i) => {
    const at = `events[${i}]`
    if (!ev || typeof ev !== 'object') { errors.push(`${at}: must be an object`); return }
    if (!isStr(ev.id)) errors.push(`${at}.id: required string`)
    else { if (eids.has(ev.id)) errors.push(`${at}.id: duplicate "${ev.id}"`); eids.add(ev.id) }
    if (ev.kind === 'message') {
      if (!ev.found && !pids.has(ev.from)) errors.push(`${at}.from: no participant "${ev.from}"`)
      if (!ev.lost && !pids.has(ev.to)) errors.push(`${at}.to: no participant "${ev.to}"`)
      if (ev.arrow != null && !ARROWS.includes(ev.arrow)) errors.push(`${at}.arrow: must be one of ${ARROWS.join('/')}`)
    } else if (ev.kind === 'note') {
      if (!Array.isArray(ev.over) || !ev.over.length) errors.push(`${at}.over: required non-empty array`)
      else ev.over.forEach((o, j) => { if (!pids.has(o)) errors.push(`${at}.over[${j}]: no participant "${o}"`) })
    } else errors.push(`${at}.kind: must be message or note`)
    if (ev.tone != null && !TONES.includes(ev.tone)) errors.push(`${at}.tone: must be one of ${TONES.join('/')}`)
    if (ev.badge != null && !BADGES.includes(ev.badge)) errors.push(`${at}.badge: must be one of ${BADGES.join('/')}`)
  })
  ;(Array.isArray(d.fragments) ? d.fragments : []).forEach((f, i) => {
    const at = `fragments[${i}]`
    if (!f || typeof f !== 'object') { errors.push(`${at}: must be an object`); return }
    if (!FRAGMENTS.includes(f.kind)) errors.push(`${at}.kind: must be one of ${FRAGMENTS.join('/')}`)
    if (!eids.has(f.startId)) errors.push(`${at}.startId: no event "${f.startId}"`)
    if (!eids.has(f.endId)) errors.push(`${at}.endId: no event "${f.endId}"`)
    ;(f.dividers || []).forEach((dv, j) => { if (!eids.has(dv?.beforeId)) errors.push(`${at}.dividers[${j}].beforeId: no event "${dv?.beforeId}"`) })
  })
  if (d.fragments != null && !Array.isArray(d.fragments)) errors.push('fragments: must be an array')
  ;(Array.isArray(d.groups) ? d.groups : []).forEach((g, i) => {
    if (!g || typeof g !== 'object' || !Array.isArray(g.participants)) { errors.push(`groups[${i}].participants: required array`); return }
    g.participants.forEach((p, j) => { if (!pids.has(p)) errors.push(`groups[${i}].participants[${j}]: no participant "${p}"`) })
  })
  if (d.groups != null && !Array.isArray(d.groups)) errors.push('groups: must be an array')
  return { valid: errors.length === 0, errors }
}
