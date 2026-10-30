// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── Typed diagrams: generic validation (pure JS) ───
// Two checks every typed diagram gets, driven by its spec (see README.md):
//   1. walkSchema — a JSON Schema subset (type, required, enum, items,
//      properties, additionalProperties:false, anyOf, minItems, maxItems).
//   2. checkRefs  — referential integrity declared as path pairs, e.g.
//      { from: 'relations[].from', to: 'entities[].id' }: every value found at
//      `from` must exist among the values at `to`.
// Mirrored in Python by _walk_prop_schema + _check_refs (login.py) so the
// browser, the studio-deck MCP and the Session Lambda agree.

// Values at a path: 'a.b', 'items[].id', 'tasks[].dependsOn[]'.
export function valuesAt(doc, path) {
  let cur = [doc]
  for (const raw of path.split('.')) {
    const isArr = raw.endsWith('[]')
    const key = isArr ? raw.slice(0, -2) : raw
    const next = []
    for (const v of cur) {
      if (v == null || typeof v !== 'object') continue
      const x = key ? v[key] : v
      if (isArr) { if (Array.isArray(x)) next.push(...x) } else if (x !== undefined) next.push(x)
    }
    cur = next
  }
  return cur
}

export function checkRefs(doc, refs = []) {
  const errors = []
  for (const r of refs) {
    const pool = new Set(valuesAt(doc, r.to).filter(v => v != null).map(String))
    for (const v of valuesAt(doc, r.from)) {
      if (v == null || v === '') continue
      if (!pool.has(String(v))) errors.push(`${r.from}: "${v}" não existe em ${r.to}`)
    }
  }
  return errors
}

// Duplicate ids: paths whose values must be unique (e.g. 'entities[].id').
export function checkUnique(doc, paths = []) {
  const errors = []
  for (const p of paths) {
    const seen = new Set()
    for (const v of valuesAt(doc, p)) {
      if (v == null) continue
      if (seen.has(v)) errors.push(`${p}: id duplicado "${v}"`)
      seen.add(v)
    }
  }
  return errors
}

const typeOk = (t, v) => {
  if (t === 'string') return typeof v === 'string'
  if (t === 'number') return typeof v === 'number' && Number.isFinite(v)
  if (t === 'integer') return Number.isInteger(v)
  if (t === 'boolean') return typeof v === 'boolean'
  if (t === 'array') return Array.isArray(v)
  if (t === 'object') return v != null && typeof v === 'object' && !Array.isArray(v)
  return true
}

export function walkSchema(schema, value, path, errors) {
  if (!schema || value === undefined) return
  if (schema.anyOf) {
    const ok = schema.anyOf.some(s => { const e = []; walkSchema(s, value, path, e); return e.length === 0 })
    if (!ok) errors.push(`${path}: formato inválido`)
    return
  }
  if (schema.type && !typeOk(schema.type, value)) { errors.push(`${path}: esperado ${schema.type}`); return }
  if (schema.enum && !schema.enum.includes(value)) { errors.push(`${path}: deve ser um de ${schema.enum.join(', ')}`); return }
  if (schema.type === 'array') {
    if (schema.minItems != null && value.length < schema.minItems) errors.push(`${path}: mínimo ${schema.minItems} item(ns)`)
    if (schema.maxItems != null && value.length > schema.maxItems) errors.push(`${path}: máximo ${schema.maxItems} itens`)
    value.forEach((v, i) => walkSchema(schema.items, v, `${path}[${i}]`, errors))
  } else if (schema.type === 'object') {
    for (const k of schema.required || []) if (value[k] === undefined) errors.push(`${path}.${k}: obrigatório`)
    for (const [k, v] of Object.entries(value)) {
      const sub = schema.properties?.[k]
      // Unknown props are rejected unless the schema says additionalProperties:true
      // (same default as the Lambda's _walk_prop_schema).
      if (!sub) { if (schema.additionalProperties !== true) errors.push(`${path}.${k}: propriedade desconhecida`); continue }
      walkSchema(sub, v, `${path}.${k}`, errors)
    }
  }
}

// Full check for one spec: schema + unique ids + refs + optional custom rule.
export function validateWithSpec(spec, doc) {
  const errors = []
  if (!doc || typeof doc !== 'object') return { valid: false, errors: ['diagram: must be an object'] }
  const body = { ...doc }
  delete body.kind
  walkSchema({ ...spec.schema, properties: { ...spec.schema.properties, title: { type: 'string' }, subtitle: { type: 'string' } } }, body, 'diagram', errors)
  errors.push(...checkUnique(doc, spec.unique || []))
  errors.push(...checkRefs(doc, spec.refs || []))
  if (typeof spec.check === 'function') errors.push(...(spec.check(doc) || []))
  return { valid: errors.length === 0, errors }
}
