// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The JSON Schema subset the core's document schemas use (architecture,
// sequence, every typed-diagram spec). Types only — nothing here exists at
// runtime, so it adds no module to any built entry.

/** A JSON Schema primitive type name. */
export type JsonSchemaType = "string" | "number" | "integer" | "boolean" | "array" | "object" | "null";

/** A JSON Schema node (draft 2020-12 subset) plus the editor's `x-*` annotations
 *  (`x-label`, `x-item-title`, `x-ref`, `x-multiline`) the typed specs carry. */
export interface JsonSchema {
  $schema?: string;
  type?: JsonSchemaType;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema;
  enum?: readonly (string | number | boolean | null)[];
  anyOf?: JsonSchema[];
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  minimum?: number;
  maximum?: number;
  [annotation: `x-${string}`]: unknown;
}

/** What every document validator returns. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
