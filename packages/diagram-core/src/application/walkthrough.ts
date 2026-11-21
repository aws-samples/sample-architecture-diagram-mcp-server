// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The architecture walkthrough's step machine (LiveDiagram in "auto" control):
// beat -1 is the whole-diagram overview, 0…count-1 the beats. Pure; the React
// adapter maps keys and timers onto these transitions.

/** A walkthrough transition. */
export type WalkAction =
  | { type: "next" } | { type: "prev" } | { type: "first" } | { type: "last" } | { type: "exit" }
  | { type: "goto"; index: number };

/** Milliseconds a beat stays on screen while playing (and the hold on the last one). */
export const WALK_AUTOPLAY_MS = 2600;

/** The beat to open on: startStep clamped to [-1, count-1]; -1 (overview) unless an integer is given. */
export function initialWalkStep(startStep: unknown, count: number): number {
  return Number.isInteger(startStep) ? Math.max(-1, Math.min(startStep as number, count - 1)) : -1;
}

/** The beat after `action` from `step`, for a walkthrough of `count` beats. */
export function reduceWalkStep(step: number, action: WalkAction, count: number): number {
  switch (action.type) {
    case "next": return Math.min(step + 1, count - 1);
    case "prev": return Math.max(step - 1, -1);
    case "first": return 0;
    case "last": return count - 1;
    case "exit": return -1;
    case "goto": return Math.max(-1, Math.min(action.index, count - 1));
  }
}

/** What the key under the walkthrough's keyboard map does (and whether the page must not also act on it). */
export interface WalkKey { action: WalkAction; preventDefault: boolean }

/** The element a key event targets, as much as the keyboard map reads of it. */
export interface WalkKeyTarget { tagName?: string; isContentEditable?: boolean; role?: string | null }

/**
 * The walkthrough's keyboard map: → / Space / PageDown next, ← / PageUp back,
 * Home first, End last, Esc overview. Keys typed into a field, and Space on a
 * focused button/link, belong to that control — null.
 */
export function walkKey(key: string, target: WalkKeyTarget | null | undefined): WalkKey | null {
  const tag = target?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return null;
  if (key === " " && (tag === "BUTTON" || tag === "A" || target?.role === "button")) return null;
  if (key === "ArrowRight" || key === " " || key === "PageDown") return { action: { type: "next" }, preventDefault: true };
  if (key === "ArrowLeft" || key === "PageUp") return { action: { type: "prev" }, preventDefault: true };
  if (key === "Home") return { action: { type: "first" }, preventDefault: false };
  if (key === "End") return { action: { type: "last" }, preventDefault: false };
  if (key === "Escape") return { action: { type: "exit" }, preventDefault: false };
  return null;
}

/** One autoplay tick: on the last beat playing stops (after the hold); else it advances. */
export function autoplayTick(step: number, count: number): { stop: true } | { stop: false; next: number } {
  return step >= count - 1 ? { stop: true } : { stop: false, next: Math.min(step + 1, count - 1) };
}

/** Clamp `cur + delta` to [min, max] (the sequence and flow players' ← / →). */
export function stepBy(cur: number, delta: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, cur + delta));
}
