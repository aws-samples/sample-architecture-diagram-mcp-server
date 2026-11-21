// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Drafts of the staged builders, in memory for the life of the process. Ids are
// `<prefix><n>` (d1, d2, … for diagrams; s1 for sequences; f1 for flows).
import type { SessionStore } from "#application/ports/index.ts";

export class MemorySessionStore<T> implements SessionStore<T> {
  private readonly prefix: string;
  private readonly drafts = new Map<string, T>();
  private seq = 0;
  constructor(prefix: string) { this.prefix = prefix; }
  create(value: T): string {
    const id = `${this.prefix}${++this.seq}`;
    this.drafts.set(id, value);
    return id;
  }
  get(id: string): T | undefined { return this.drafts.get(id); }
  delete(id: string): void { this.drafts.delete(id); }
}
