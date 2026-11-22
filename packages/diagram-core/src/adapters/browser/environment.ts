// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Environment over matchMedia and the Fullscreen API. Without a document (SSR,
// Node): no reduced-motion preference, never fullscreen.
import type { Environment } from "#core/ports/host.ts";

export const browserEnvironment: Environment = {
  prefersReducedMotion: () => typeof window !== "undefined" && !!window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  isFullscreen: () => typeof document !== "undefined" && !!document.fullscreenElement,
  requestFullscreen: (target) => target.requestFullscreen?.() ?? Promise.resolve(),
  exitFullscreen: () => { if (typeof document !== "undefined") document.exitFullscreen?.(); },
  subscribeFullscreen: (listener) => {
    if (typeof document === "undefined") return () => {};
    document.addEventListener("fullscreenchange", listener);
    return () => document.removeEventListener("fullscreenchange", listener);
  },
};
