// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The JSON catalogs bundled with the server (server/assets), typed. Pure data:
// importing them does no I/O (esbuild and vitest inline the JSON).
import serviceConfigsJson from "#assets/service-configs.json" with { type: "json" };
import serviceRegistryJson from "#assets/service-registry.json" with { type: "json" };
import cfnTypesJson from "#assets/cfn-types.json" with { type: "json" };

/** One IaC config field of a service (list_service_configs). */
export interface ServiceConfigField {
  key: string;
  label: string;
  type: string;
  options?: string[];
  placeholder?: string;
  default?: string | number | boolean;
}
export interface ServiceConfig {
  service: string;
  fields: ServiceConfigField[];
}

/** A service of the registry (exports["./service-registry.json"]). */
export interface RegistryService {
  icon?: string;
  cfn?: string;
  ns?: string;
  cfnTypes?: string[];
}
export interface ServiceRegistry {
  _generated: string;
  _count: number;
  _withCfn: number;
  services: Record<string, RegistryService>;
}

/** CloudFormation resource types per service (scripts/build-cfn-types.mjs). */
export interface CfnServiceTypes {
  primary?: string;
  ns?: string;
  types?: string[];
}
export interface CfnTypes {
  _generated: string;
  _catalogSize: number;
  _mapped: number;
  _nonDeployable: number;
  services: Record<string, CfnServiceTypes>;
  nonDeployable: unknown;
}

export const SERVICE_CONFIGS: readonly ServiceConfig[] = serviceConfigsJson as ServiceConfig[];
export const SERVICE_REGISTRY: ServiceRegistry = serviceRegistryJson as ServiceRegistry;
export const CFN_TYPES: CfnTypes = cfnTypesJson as CfnTypes;
