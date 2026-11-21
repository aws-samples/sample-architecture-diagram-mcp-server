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

import type { JsonSchema, ValidationResult } from './jsonSchema.ts'
import type { PlayerTone } from '#core/tones.ts'
import type { CodeBlockInput } from '#core/codeBlocks.ts'

export const SEQUENCE_KIND = 'sequence'

export type SeqTone = PlayerTone
export type SeqBadge = 'gate' | 'keyless' | 'async' | 'sync' | 'phase' | 'fail'
export type SeqArrow = 'sync' | 'async' | 'reply'
export type SeqFragmentKind = 'alt' | 'opt' | 'loop' | 'par' | 'break' | 'critical' | 'ref' | 'neg' | 'assert'

/** A lifeline column. */
export interface SequenceParticipant {
  id: string
  label: string
  sub?: string
  service?: string
  icon?: string
  actor?: boolean
  stereotype?: string
}

/** A source reference rendered as a link (or free text). */
export interface SequenceProofRef {
  repo?: string
  path?: string
  ref?: string
  lines?: number | string | number[]
  url?: string
  text?: string
}
export type SequenceProof = string | SequenceProofRef

/** Narration fields every event may carry. */
export interface SequenceNarration {
  tone?: SeqTone
  badge?: SeqBadge
  title?: string
  flow?: string
  desc?: string
  proof?: SequenceProof
  code?: string
  codeLabel?: string
  codeBlocks?: CodeBlockInput<string>[]
  codeSplit?: 'markers'
}

/** An arrow between lifelines (`to` == `from` for a self-call). */
export interface SequenceMessage extends SequenceNarration {
  kind: 'message'
  id: string
  from?: string
  to?: string
  label?: string
  arrow?: SeqArrow
  /** Legacy: dashed = reply. */
  style?: 'solid' | 'dashed'
  activate?: boolean
  deactivate?: boolean
  create?: boolean
  destroy?: boolean
  found?: boolean
  lost?: boolean
}

/** A band over one or more lifelines. */
export interface SequenceNote extends SequenceNarration {
  kind: 'note'
  id: string
  over: string[]
  label?: string
}

export type SequenceEvent = SequenceMessage | SequenceNote

export interface SequenceFragmentDivider { beforeId: string; label: string }
/** A combined fragment around a contiguous range of events. */
export interface SequenceFragment {
  kind: SeqFragmentKind
  label: string
  startId: string
  endId: string
  tone?: SeqTone
  dividers?: SequenceFragmentDivider[]
}

/** A box aggregating contiguous participant columns. */
export interface SequenceGroup {
  label: string
  participants: string[]
  tone?: SeqTone
}

/** The UML sequence document (generate_sequence_diagram input). */
export interface SequenceDoc {
  kind?: typeof SEQUENCE_KIND
  title?: string
  subtitle?: string
  participants: SequenceParticipant[]
  events: SequenceEvent[]
  fragments?: SequenceFragment[]
  groups?: SequenceGroup[]
  autoActivate?: boolean
  autoplay?: boolean
  stepMs?: number
  [key: string]: unknown
}

// Author data seen as a loose record once known to be an object.
type Loose = Record<string, unknown>
const isObj = (v: unknown): v is Loose => v != null && typeof v === 'object'

export const SEQ_TONES: SeqTone[] = ['accent', 'info', 'success', 'warn', 'danger', 'neutral']
export const SEQ_BADGES: SeqBadge[] = ['gate', 'keyless', 'async', 'sync', 'phase', 'fail']
export const SEQ_ARROWS: SeqArrow[] = ['sync', 'async', 'reply']
export const SEQ_FRAGMENTS: SeqFragmentKind[] = ['alt', 'opt', 'loop', 'par', 'break', 'critical', 'ref', 'neg', 'assert']

const TONES = SEQ_TONES, BADGES = SEQ_BADGES, ARROWS = SEQ_ARROWS, FRAGMENTS = SEQ_FRAGMENTS
// Membership test for any author value.
const oneOf = (list: readonly unknown[], v: unknown): boolean => list.includes(v)
export const MAX_PARTICIPANTS = 40
export const MAX_EVENTS = 400

const s = (description?: string): JsonSchema => ({ type: 'string', ...(description ? { description } : {}) })
const b = (description?: string): JsonSchema => ({ type: 'boolean', ...(description ? { description } : {}) })
const e = (values: readonly (string | number | boolean | null)[], description?: string): JsonSchema => ({ type: 'string', enum: values, ...(description ? { description } : {}) })

const proof: JsonSchema = {
  description: 'Free text (inline markdown) or a source ref {repo,path,ref,lines,url,text} rendered as a link.',
  anyOf: [{ type: 'string' }, {
    type: 'object', additionalProperties: false,
    properties: { repo: s(), path: s(), ref: s(), lines: { anyOf: [{ type: 'number' }, { type: 'string' }, { type: 'array', items: { type: 'number' } }] }, url: s(), text: s() },
  }],
}
const narration: Record<string, JsonSchema> = {
  tone: e(TONES, 'Accent when this is the active step'),
  badge: e(BADGES, 'Semantic badge on the step'),
  title: s('Narration heading (falls back to label)'),
  flow: s('Sub-line under the heading (e.g. "SA → CodeCommit")'),
  desc: s('Narration text — inline markdown (**bold**, `code`, *italic*)'),
  proof,
}

export const sequenceDocSchema: JsonSchema = {
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
          codeBlocks: {
            type: 'array', maxItems: 20, description: 'Several files, each a collapsible block (header, copy, chevron)',
            items: {
              type: 'object', required: ['label', 'code'], additionalProperties: false,
              properties: {
                id: s(), label: s('File name or title on the block header'), lang: s('Language tag'), code: s('File content'),
                collapsed: b('Start collapsed (default: only the first block is open)'),
                maxLines: { type: 'integer', minimum: 3, maximum: 500, description: "Lines shown before 'Show more' (default 20)" },
              },
            },
          },
          codeSplit: e(['markers'], "Opt-in: split `code` at '===== name =====' lines into collapsible blocks"),
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

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0

// Types + referential integrity.
export function validateSequence(d: unknown): ValidationResult {
  const errors: string[] = []
  if (!isObj(d)) return { valid: false, errors: ['sequence: must be an object'] }
  const P = d.participants, EV = d.events
  if (!Array.isArray(P)) errors.push('participants: required array')
  else if (P.length > MAX_PARTICIPANTS) errors.push(`participants: at most ${MAX_PARTICIPANTS}`)
  if (!Array.isArray(EV)) errors.push('events: required array')
  else if (EV.length > MAX_EVENTS) errors.push(`events: at most ${MAX_EVENTS}`)
  const pids = new Set<unknown>(), eids = new Set<unknown>()
  ;(Array.isArray(P) ? P : []).forEach((p: unknown, i) => {
    if (!isObj(p) || !isStr(p.id)) { errors.push(`participants[${i}].id: required string`); return }
    if (pids.has(p.id)) errors.push(`participants[${i}].id: duplicate "${p.id}"`)
    pids.add(p.id)
    if (typeof p.label !== 'string') errors.push(`participants[${i}].label: required string`)
  })
  ;(Array.isArray(EV) ? EV : []).forEach((ev: unknown, i) => {
    const at = `events[${i}]`
    if (!isObj(ev)) { errors.push(`${at}: must be an object`); return }
    if (!isStr(ev.id)) errors.push(`${at}.id: required string`)
    else { if (eids.has(ev.id)) errors.push(`${at}.id: duplicate "${ev.id}"`); eids.add(ev.id) }
    if (ev.kind === 'message') {
      if (!ev.found && !pids.has(ev.from)) errors.push(`${at}.from: no participant "${ev.from}"`)
      if (!ev.lost && !pids.has(ev.to)) errors.push(`${at}.to: no participant "${ev.to}"`)
      if (ev.arrow != null && !oneOf(ARROWS, ev.arrow)) errors.push(`${at}.arrow: must be one of ${ARROWS.join('/')}`)
    } else if (ev.kind === 'note') {
      if (!Array.isArray(ev.over) || !ev.over.length) errors.push(`${at}.over: required non-empty array`)
      else ev.over.forEach((o: unknown, j: number) => { if (!pids.has(o)) errors.push(`${at}.over[${j}]: no participant "${o}"`) })
    } else errors.push(`${at}.kind: must be message or note`)
    if (ev.tone != null && !oneOf(TONES, ev.tone)) errors.push(`${at}.tone: must be one of ${TONES.join('/')}`)
    if (ev.badge != null && !oneOf(BADGES, ev.badge)) errors.push(`${at}.badge: must be one of ${BADGES.join('/')}`)
  })
  ;(Array.isArray(d.fragments) ? d.fragments : []).forEach((f: unknown, i) => {
    const at = `fragments[${i}]`
    if (!isObj(f)) { errors.push(`${at}: must be an object`); return }
    if (!oneOf(FRAGMENTS, f.kind)) errors.push(`${at}.kind: must be one of ${FRAGMENTS.join('/')}`)
    if (!eids.has(f.startId)) errors.push(`${at}.startId: no event "${f.startId}"`)
    if (!eids.has(f.endId)) errors.push(`${at}.endId: no event "${f.endId}"`)
    // Like `dv?.beforeId`: undefined for a missing divider.
    const beforeId = (dv: unknown): unknown => (dv == null ? undefined : (dv as Loose).beforeId)
    ;((f.dividers || []) as unknown[]).forEach((dv, j) => { if (!eids.has(beforeId(dv))) errors.push(`${at}.dividers[${j}].beforeId: no event "${beforeId(dv)}"`) })
  })
  if (d.fragments != null && !Array.isArray(d.fragments)) errors.push('fragments: must be an array')
  ;(Array.isArray(d.groups) ? d.groups : []).forEach((g: unknown, i) => {
    if (!isObj(g) || !Array.isArray(g.participants)) { errors.push(`groups[${i}].participants: required array`); return }
    g.participants.forEach((p: unknown, j: number) => { if (!pids.has(p)) errors.push(`groups[${i}].participants[${j}]: no participant "${p}"`) })
  })
  if (d.groups != null && !Array.isArray(d.groups)) errors.push('groups: must be an array')
  return { valid: errors.length === 0, errors }
}
