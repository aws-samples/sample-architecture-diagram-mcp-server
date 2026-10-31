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

import { validateSequence, SEQUENCE_KIND } from './sequence.js'
export const MAX_SERVICES = 400
export const MAX_CONNECTIONS = 800
export const MAX_GROUPS = 100
export const DIRECTIONS = ['TB', 'LR', 'BT', 'RL']

// Display text: a string or a per-language map ({ en, pt, es }).
const text = { anyOf: [{ type: 'string' }, { type: 'object', additionalProperties: { type: 'string' } }] }

// JSON Schema (draft 2020-12) — documentation + a contract the API can publish.
export const diagramSchema = {
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
export function validateDiagram(d) {
  const errors = []
  if (!d || typeof d !== 'object') return { valid: false, errors: ['diagram: must be an object'] }
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
  if (d.direction != null && !DIRECTIONS.includes(d.direction)) errors.push(`direction: must be one of ${DIRECTIONS.join('/')}`)

  // Collect ids (and flag duplicates / missing).
  const serviceIds = new Set()
  ;(Array.isArray(services) ? services : []).forEach((s, i) => {
    if (!s || typeof s !== 'object') { errors.push(`services[${i}]: must be an object`); return }
    if (typeof s.id !== 'string' || !s.id) { errors.push(`services[${i}].id: required string`); return }
    if (serviceIds.has(s.id)) errors.push(`services[${i}].id: duplicate "${s.id}"`)
    serviceIds.add(s.id)
  })
  const groupIds = new Set()
  groups.forEach((g, i) => {
    if (!g || typeof g !== 'object') { errors.push(`groups[${i}]: must be an object`); return }
    if (typeof g.id !== 'string' || !g.id) { errors.push(`groups[${i}].id: required string`); return }
    if (groupIds.has(g.id)) errors.push(`groups[${i}].id: duplicate "${g.id}"`)
    groupIds.add(g.id)
  })

  // Referential integrity.
  ;(Array.isArray(services) ? services : []).forEach((s, i) => {
    if (s && s.parentId != null && !groupIds.has(s.parentId)) errors.push(`services[${i}].parentId: no group "${s.parentId}"`)
  })
  connections.forEach((c, i) => {
    if (!c || typeof c !== 'object') { errors.push(`connections[${i}]: must be an object`); return }
    if (!serviceIds.has(c.source)) errors.push(`connections[${i}].source: no service "${c.source}"`)
    if (!serviceIds.has(c.target)) errors.push(`connections[${i}].target: no service "${c.target}"`)
  })
  groups.forEach((g, i) => {
    if (g && g.parent != null && !groupIds.has(g.parent)) errors.push(`groups[${i}].parent: no group "${g.parent}"`)
  })

  // No cycle in group.parent chains.
  const parentOf = {}
  groups.forEach(g => { if (g && g.parent) parentOf[g.id] = g.parent })
  for (const start of Object.keys(parentOf)) {
    const seen = new Set([start])
    let cur = parentOf[start]
    while (cur) {
      if (seen.has(cur)) { errors.push(`groups: parent cycle at "${start}"`); break }
      seen.add(cur); cur = parentOf[cur]
    }
  }

  return { valid: errors.length === 0, errors }
}
