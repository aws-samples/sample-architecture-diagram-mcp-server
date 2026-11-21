// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Clipboard over navigator.clipboard. The clipboard is often blocked under
// file:// — both the throw and the rejection are swallowed.
import type { Clipboard } from "#core/ports/host.ts";

export const browserClipboard: Clipboard = {
  writeText: (text) => {
    if (typeof navigator === "undefined") return;
    try { navigator.clipboard?.writeText(text)?.catch?.(() => {}); } catch { /* clipboard blocked (file://) — no-op */ }
  },
};
