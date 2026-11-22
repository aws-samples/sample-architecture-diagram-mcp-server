// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Own-property lookups. A plain-object table indexed by an author- or
// host-supplied key would otherwise answer "__proto__", "constructor",
// "toString", "hasOwnProperty", "valueOf" with Object.prototype's members.
// Tables are read through own(); maps BUILT from author ids are dict()s (no
// prototype, so such an id is an ordinary key). The modules inlined into the
// HTML players (flowLayout, sequenceLayout, codeBlocks) carry their own copy:
// they must stay import-free.
const has = Object.prototype.hasOwnProperty;

/** Whether `key` is an own property of `o`. */
export const hasOwn = (o: object | null | undefined, key: PropertyKey): boolean => o != null && has.call(o, key);

/** `table[key]` when it is an own property, else undefined. */
export function own<V>(table: Readonly<Partial<Record<string, V>>> | null | undefined, key: unknown): V | undefined {
  if (table == null) return undefined;
  const k = String(key);
  return has.call(table, k) ? table[k] : undefined;
}

/** An empty prototype-free map. */
export const dict = <V>(): Record<string, V> => Object.create(null) as Record<string, V>;

/** A prototype-free map of `entries` (Object.fromEntries without the prototype). */
export function dictOf<V>(entries: Iterable<readonly [PropertyKey, V]>): Record<string, V> {
  return Object.assign(dict<V>(), Object.fromEntries(entries));
}

/** A prototype-free copy of a constant table, so `t[key]` misses for any key it does not list. */
export const protoFree = <T extends object>(o: T): T => Object.assign(dict<unknown>(), o) as T;
