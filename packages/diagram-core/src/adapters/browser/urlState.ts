// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// UrlState over window.location / window.history. Without a window (SSR, Node)
// it reads an empty URL and writes nothing.
import type { UrlState } from "#core/ports/host.ts";

const hasWindow = (): boolean => typeof window !== "undefined";

export const browserUrlState: UrlState = {
  readHash: () => (hasWindow() ? window.location.hash || "" : ""),
  readPathAndQuery: () => (hasWindow() ? window.location.pathname + window.location.search : ""),
  replaceUrl: (url) => { if (hasWindow() && window.history?.replaceState) window.history.replaceState(null, "", url); },
  subscribeHash: (listener) => {
    if (!hasWindow()) return () => {};
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  },
};
