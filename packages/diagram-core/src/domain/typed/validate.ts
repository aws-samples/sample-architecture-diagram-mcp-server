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
import type { JsonSchema, JsonSchemaType, ValidationResult } from '#core/domain/schemas/jsonSchema.ts'

/** Fields every typed-diagram document may carry besides its own body. */
export interface TypedDocBase {
  kind?: string
  title?: string
  subtitle?: string
}

/** Referential integrity: every value at `from` must exist among the values at `to`. */
export interface TypedRef { from: string; to: string }

/** Gallery / editor category of a typed diagram. */
export type TypedCategory = 'process' | 'structure' | 'planning' | 'data' | 'software' | 'business'

/** The typed-diagram contract (see README.md). Methods (not function-valued
 *  properties) so a spec of a concrete document type is usable wherever a
 *  generic spec is expected. */
export interface TypedDiagramSpec<D extends TypedDocBase = TypedDocBase> {
  kind: string
  label: string
  description: string
  category: TypedCategory
  /** JSON Schema of the body without kind/title/subtitle. */
  schema: JsonSchema
  unique: string[]
  refs: TypedRef[]
  /** Reveal steps for decks/articles (0 = static). */
  steps(doc: D): number
  /** Starter document for "Novo diagrama". */
  empty(title?: string): D
  /** Plain-text summary (accessibility). */
  describe(doc: D): string
  /** Extra example documents (without `kind`). */
  samples?: D[]
  /** Optional custom rule (the README discourages it: the Lambda cannot mirror it). */
  check?(doc: D): readonly string[] | null | undefined
}

/** The parts of a spec validateWithSpec reads. */
export type TypedSpecContract<D extends TypedDocBase = TypedDocBase> =
  Pick<TypedDiagramSpec<D>, 'schema' | 'check'> & Partial<Pick<TypedDiagramSpec<D>, 'unique' | 'refs'>>

const isObj = (v: unknown): v is Record<string, unknown> => v != null && typeof v === 'object'

// Values at a path: 'a.b', 'items[].id', 'tasks[].dependsOn[]'.
export function valuesAt(doc: unknown, path: string): unknown[] {
  let cur: unknown[] = [doc]
  for (const raw of path.split('.')) {
    const isArr = raw.endsWith('[]')
    const key = isArr ? raw.slice(0, -2) : raw
    const next: unknown[] = []
    for (const v of cur) {
      if (!isObj(v)) continue
      const x = key ? v[key] : v
      if (isArr) { if (Array.isArray(x)) next.push(...x) } else if (x !== undefined) next.push(x)
    }
    cur = next
  }
  return cur
}

export function checkRefs(doc: unknown, refs: readonly TypedRef[] = []): string[] {
  const errors: string[] = []
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
export function checkUnique(doc: unknown, paths: readonly string[] = []): string[] {
  const errors: string[] = []
  for (const p of paths) {
    const seen = new Set<unknown>()
    for (const v of valuesAt(doc, p)) {
      if (v == null) continue
      if (seen.has(v)) errors.push(`${p}: id duplicado "${v}"`)
      seen.add(v)
    }
  }
  return errors
}

const typeOk = (t: JsonSchemaType, v: unknown): boolean => {
  if (t === 'string') return typeof v === 'string'
  if (t === 'number') return typeof v === 'number' && Number.isFinite(v)
  if (t === 'integer') return Number.isInteger(v)
  if (t === 'boolean') return typeof v === 'boolean'
  if (t === 'array') return Array.isArray(v)
  if (t === 'object') return v != null && typeof v === 'object' && !Array.isArray(v)
  return true
}

export function walkSchema(schema: JsonSchema | undefined, value: unknown, path: string, errors: string[]): void {
  if (!schema || value === undefined) return
  if (schema.anyOf) {
    const ok = schema.anyOf.some(s => { const e: string[] = []; walkSchema(s, value, path, e); return e.length === 0 })
    if (!ok) errors.push(`${path}: formato inválido`)
    return
  }
  if (schema.type && !typeOk(schema.type, value)) { errors.push(`${path}: esperado ${schema.type}`); return }
  if (schema.enum && !(schema.enum as readonly unknown[]).includes(value)) { errors.push(`${path}: deve ser um de ${schema.enum.join(', ')}`); return }
  if (schema.type === 'array' && Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) errors.push(`${path}: mínimo ${schema.minItems} item(ns)`)
    if (schema.maxItems != null && value.length > schema.maxItems) errors.push(`${path}: máximo ${schema.maxItems} itens`)
    value.forEach((v, i) => walkSchema(schema.items, v, `${path}[${i}]`, errors))
  } else if (schema.type === 'object' && isObj(value)) {
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
export function validateWithSpec<D extends TypedDocBase>(spec: TypedSpecContract<D>, doc: unknown): ValidationResult {
  const errors: string[] = []
  if (!doc || typeof doc !== 'object') return { valid: false, errors: ['diagram: must be an object'] }
  const body: Record<string, unknown> = { ...(doc as Record<string, unknown>) }
  delete body.kind
  walkSchema({ ...spec.schema, properties: { ...spec.schema.properties, title: { type: 'string' }, subtitle: { type: 'string' } } }, body, 'diagram', errors)
  errors.push(...checkUnique(doc, spec.unique || []))
  errors.push(...checkRefs(doc, spec.refs || []))
  // doc is an object here; check() receives it as authored, like the JS original.
  if (typeof spec.check === 'function') errors.push(...(spec.check(doc as D) || []))
  return { valid: errors.length === 0, errors }
}
