// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// FileSaver over a temporary <a download> click.
import type { FileSaver } from "#core/ports/host.ts";

/** How long an object URL outlives its click (the download has started by then). */
export const OBJECT_URL_TTL_MS = 1000;

export const browserFileSaver: FileSaver = {
  // The anchor is attached for the click (some browsers ignore a detached one
  // for data: URLs).
  saveUrl: (filename, url) => {
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  },
  saveBlob: (filename, blob) => {
    const u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(u), OBJECT_URL_TTL_MS);
  },
};
