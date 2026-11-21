// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Driven ports of the presentation: what the components need from the page they
// run in. Each one is only as wide as the code that uses it. Adapters:
// adapters/browser (window / document / navigator), or fakes in a host or a test
// (mounted through <CoreHostProvider ports>).

/** The page URL's deep-link state (the hash: #env=…, #<page>). */
export interface UrlState {
  /** The current hash, with its leading "#" ("" when there is none or no page). */
  readHash(): string;
  /** The current path + query (no hash) — the URL to write to clear the hash. */
  readPathAndQuery(): string;
  /** Replace the current history entry's URL (no navigation, no new entry). No-op without history. */
  replaceUrl(url: string): void;
  /** Call `listener` on every hash change (back/forward, a typed hash). Returns the unsubscribe. */
  subscribeHash(listener: () => void): () => void;
}

/** Copy to the clipboard. Fire-and-forget: a blocked clipboard (file://) is a silent no-op. */
export interface Clipboard {
  writeText(text: string): void;
}

/** A file the user downloads. */
export interface FileSaver {
  /** Save from a URL the page already holds (a data: URL). */
  saveUrl(filename: string, url: string): void;
  /** Save a Blob (the adapter owns the object URL's lifetime). */
  saveBlob(filename: string, blob: Blob): void;
}

/** What a fullscreen request targets (an element, in a browser). */
export interface FullscreenTarget {
  requestFullscreen?: () => Promise<void>;
}

/** User preferences and display state of the page. */
export interface Environment {
  /** prefers-reduced-motion: reduce. */
  prefersReducedMotion(): boolean;
  /** Something is shown fullscreen. */
  isFullscreen(): boolean;
  /** Ask to show `target` fullscreen; resolves when granted (immediately when unsupported). */
  requestFullscreen(target: FullscreenTarget): Promise<void>;
  /** Leave fullscreen. */
  exitFullscreen(): void;
  /** Call `listener` when fullscreen is entered or left. Returns the unsubscribe. */
  subscribeFullscreen(listener: () => void): () => void;
}
