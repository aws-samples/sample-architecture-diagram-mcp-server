// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Use case: the app shell's current page and its deep link (#<page id>), over
// the UrlState port.
import type { UrlState } from "#core/ports/host.ts";

/** The page a hash names, when it is one of `pages`. */
export function pageFromHash(hash: string, pages: readonly { id: string }[]): string | undefined {
  const h = decodeURIComponent((hash || "").replace(/^#/, ""));
  return pages.some((p) => p.id === h) ? h : undefined;
}

/** The hash that deep-links a page. */
export function pageHash(id: string): string {
  return `#${encodeURIComponent(id)}`;
}

/** Read, follow and write the current page through the page URL. */
export interface AppPageLink {
  current(pages: readonly { id: string }[]): string | undefined;
  /** Follow hash changes to a known page; returns the unsubscribe. */
  follow(pages: readonly { id: string }[], onPage: (id: string) => void): () => void;
  write(id: string): void;
}

export function createAppPageLink(url: UrlState): AppPageLink {
  return {
    current: (pages) => pageFromHash(url.readHash(), pages),
    follow: (pages, onPage) => url.subscribeHash(() => { const h = pageFromHash(url.readHash(), pages); if (h) onPage(h); }),
    write: (id) => url.replaceUrl(pageHash(id)),
  };
}
