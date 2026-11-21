// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Reference data an agent can browse: a service's IaC config fields and the
// draw.io shape names.
import { SERVICE_CONFIGS } from "#domain/catalog/service-data.ts";
import type { ServiceConfig } from "#domain/catalog/service-data.ts";
import { DRAWIO_SHAPES } from "#domain/catalog/shapes.ts";

export function createCatalog() {
  return {
    /** Every service with a config entry, sorted by name. */
    serviceNames(): string[] {
      return SERVICE_CONFIGS.map(s => s.service).sort();
    },
    /** Services whose name contains `query` (case-insensitive). */
    serviceConfigs(query: string): ServiceConfig[] {
      return SERVICE_CONFIGS.filter(s => s.service.toLowerCase().includes(query.toLowerCase()));
    },
    /** The shape names, all categories or one (undefined when the category is unknown). */
    shapes(category?: string): Record<string, readonly string[] | undefined> {
      return category ? { [category]: DRAWIO_SHAPES[category] } : { ...DRAWIO_SHAPES };
    },
  };
}
export type Catalog = ReturnType<typeof createCatalog>;
