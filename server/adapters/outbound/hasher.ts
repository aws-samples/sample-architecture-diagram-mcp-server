// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { createHash } from "node:crypto";
import type { Hasher } from "#domain/ports/index.ts";

export class NodeHasher implements Hasher {
  sha256Hex(data: string | Uint8Array): string {
    return createHash("sha256").update(data).digest("hex");
  }
}
