// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Architecture document — { services, connections, groups } (plus optional
// title/subtitle/direction/adr/wellArchitected), the shape the MCP's
// generate_html_diagram takes and its sidecar .json carries. A JSON Schema plus
// a dependency-free validator (no ajv), shared by every host.
//
// Beyond types, it enforces REFERENTIAL INTEGRITY — the invariants a diagram
// must hold to render correctly:
//   • every connection.source / .target references an existing service id
//   • every service.parentId references an existing group id
//   • every group.parent references an existing group id
//   • group.parent forms no cycle
// (This is the diagram analogue of the deck's block-name enum.)

import { validateSequence, SEQUENCE_KIND } from './sequence.ts'
import type { JsonSchema, ValidationResult } from './jsonSchema.ts'
import type { I18nText } from '#core/domain/i18n.ts'

/** Layout direction of the architecture canvas. */
export type Direction = 'TB' | 'LR' | 'BT' | 'RL'

/** A node's config: modal fields, pricing rows (flat or per environment), IaC. */
export interface ServiceConfig {
  label?: I18nText
  pricing?: unknown
  pricingByEnv?: Record<string, unknown>
  [key: string]: unknown
}

/** A `services[]` entry. Unknown fields are allowed (and preserved). */
export interface ArchService {
  id: string
  service?: I18nText
  label?: I18nText
  shape?: string
  icon?: string
  category?: string
  /** Group the service sits in (explicit membership). `group` is an alias. */
  parentId?: string
  group?: string
  /** Implicit membership: the classic single-VPC subnet. */
  subnet?: string
  external?: boolean
  role?: I18nText
  tone?: string
  pill?: I18nText
  pillOverlay?: unknown
  pillSide?: unknown
  config?: ServiceConfig
  /** Editor-saved position. */
  pos?: { x: number; y: number }
  [key: string]: unknown
}

/** A `connections[]` entry. */
export interface ArchConnection {
  id?: string
  source: string
  target: string
  label?: I18nText
  type?: string
  dashed?: boolean
  severed?: boolean
  bidirectional?: boolean
  showLabel?: boolean
  [key: string]: unknown
}

/** A `groups[]` entry (a container). */
export interface ArchGroup {
  id: string
  label?: I18nText
  parent?: string
  variant?: string
  icon?: string
  pill?: I18nText
  pillOverlay?: unknown
  pillSide?: unknown
  /** Editor-saved position and (resizable container) size. */
  pos?: { x: number; y: number; w?: number; h?: number }
  [key: string]: unknown
}

/** The architecture document: { services, connections, groups } plus top-level fields. */
export interface ArchitectureDoc {
  kind?: undefined
  title?: I18nText
  subtitle?: I18nText
  direction?: Direction
  services: ArchService[]
  connections?: ArchConnection[]
  groups?: ArchGroup[]
  [key: string]: unknown
}

// Author data seen as a loose record once known to be an object.
type Loose = Record<string, unknown>
const isObj = (v: unknown): v is Loose => v != null && typeof v === 'object'
export const MAX_SERVICES = 400
export const MAX_CONNECTIONS = 800
export const MAX_GROUPS = 100
export const DIRECTIONS: Direction[] = ['TB', 'LR', 'BT', 'RL']

// Display text: a string or a per-language map ({ en, pt, es }).
const text: JsonSchema = { anyOf: [{ type: 'string' }, { type: 'object', additionalProperties: { type: 'string' } }] }

// JSON Schema (draft 2020-12) — documentation + a contract the API can publish.
export const diagramSchema: JsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['services'],
  additionalProperties: true,
  properties: {
    title: text,
    subtitle: text,
    direction: { type: 'string', enum: DIRECTIONS },
    services: {
      type: 'array', maxItems: MAX_SERVICES,
      items: {
        type: 'object', required: ['id'], additionalProperties: true,
        properties: {
          id: { type: 'string', minLength: 1 },
          service: text,
          shape: { type: 'string' },
          icon: { type: 'string' },
          category: { type: 'string' },
          parentId: { type: 'string' },
          external: { type: 'boolean' },
          config: { type: 'object' },
        },
      },
    },
    connections: {
      type: 'array', maxItems: MAX_CONNECTIONS,
      items: {
        type: 'object', required: ['source', 'target'], additionalProperties: true,
        properties: {
          id: { type: 'string' },
          source: { type: 'string', minLength: 1 },
          target: { type: 'string', minLength: 1 },
          type: { type: 'string' },
          label: text,
          showLabel: { type: 'boolean', description: 'Opt-in label pill (hosts that hide labels by default)' },
        },
      },
    },
    groups: {
      type: 'array', maxItems: MAX_GROUPS,
      items: {
        type: 'object', required: ['id'], additionalProperties: true,
        properties: {
          id: { type: 'string', minLength: 1 },
          label: text,
          variant: { type: 'string' },
          parent: { type: 'string' },
          icon: { type: 'string' },
        },
      },
    },
  },
}

// Lightweight validator → { valid, errors: string[] }.
export function validateDiagram(d: unknown): ValidationResult {
  const errors: string[] = []
  if (!isObj(d)) return { valid: false, errors: ['diagram: must be an object'] }
  // kind 'sequence' = UML sequence diagram (own model, see ./sequence.js).
  if (d.kind === SEQUENCE_KIND) return validateSequence(d)
  if (d.kind != null) return { valid: false, errors: [`kind: unknown diagram kind "${d.kind}" (omit for architecture, or "sequence")`] }

  const services = d.services
  if (!Array.isArray(services)) { errors.push('services: required array') }
  else if (services.length > MAX_SERVICES) errors.push(`services: at most ${MAX_SERVICES}`)

  const connections = Array.isArray(d.connections) ? d.connections : []
  const groups = Array.isArray(d.groups) ? d.groups : []
  if (d.connections != null && !Array.isArray(d.connections)) errors.push('connections: must be an array')
  if (d.groups != null && !Array.isArray(d.groups)) errors.push('groups: must be an array')
  if (d.direction != null && !(DIRECTIONS as unknown[]).includes(d.direction)) errors.push(`direction: must be one of ${DIRECTIONS.join('/')}`)

  // Collect ids (and flag duplicates / missing).
  const serviceIds = new Set<unknown>()
  ;(Array.isArray(services) ? services : []).forEach((s: unknown, i) => {
    if (!isObj(s)) { errors.push(`services[${i}]: must be an object`); return }
    if (typeof s.id !== 'string' || !s.id) { errors.push(`services[${i}].id: required string`); return }
    if (serviceIds.has(s.id)) errors.push(`services[${i}].id: duplicate "${s.id}"`)
    serviceIds.add(s.id)
  })
  const groupIds = new Set<unknown>()
  groups.forEach((g: unknown, i) => {
    if (!isObj(g)) { errors.push(`groups[${i}]: must be an object`); return }
    if (typeof g.id !== 'string' || !g.id) { errors.push(`groups[${i}].id: required string`); return }
    if (groupIds.has(g.id)) errors.push(`groups[${i}].id: duplicate "${g.id}"`)
    groupIds.add(g.id)
  })

  // Referential integrity.
  ;(Array.isArray(services) ? services : []).forEach((s: unknown, i) => {
    if (isObj(s) && s.parentId != null && !groupIds.has(s.parentId)) errors.push(`services[${i}].parentId: no group "${s.parentId}"`)
  })
  connections.forEach((c: unknown, i) => {
    if (!isObj(c)) { errors.push(`connections[${i}]: must be an object`); return }
    if (!serviceIds.has(c.source)) errors.push(`connections[${i}].source: no service "${c.source}"`)
    if (!serviceIds.has(c.target)) errors.push(`connections[${i}].target: no service "${c.target}"`)
  })
  groups.forEach((g: unknown, i) => {
    if (isObj(g) && g.parent != null && !groupIds.has(g.parent)) errors.push(`groups[${i}].parent: no group "${g.parent}"`)
  })

  // No cycle in group.parent chains.
  const parentOf: Record<string, unknown> = {}
  groups.forEach((g: unknown) => { if (isObj(g) && g.parent) parentOf[String(g.id)] = g.parent })
  for (const start of Object.keys(parentOf)) {
    const seen = new Set<unknown>([start])
    let cur = parentOf[start]
    while (cur) {
      if (seen.has(cur)) { errors.push(`groups: parent cycle at "${start}"`); break }
      seen.add(cur); cur = parentOf[String(cur)]
    }
  }

  return { valid: errors.length === 0, errors }
}
