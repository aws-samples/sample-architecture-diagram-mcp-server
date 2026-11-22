// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Use case: the selected cost environment and its deep link (#env=… in the
// URL hash), over the UrlState port.
import { costEnvs, envFromHash, hashWithEnv, initialCostEnv } from "#core/domain/costs.ts";
import type { CostEntry } from "#core/domain/costs.ts";
import type { UrlState } from "#core/ports/host.ts";

/** The environment to open on: the deep-linked one when the estimates offer it, else initialCostEnv. */
export function costEnvFromHash(hash: string, costList: readonly CostEntry[]): string | undefined {
  const fromHash = envFromHash(hash);
  return fromHash && costEnvs(costList).includes(fromHash) ? fromHash : initialCostEnv(costList);
}

/** The URL that records `env` in `hash` (the path + query alone when the hash ends up empty). */
export function costEnvUrl(hash: string, env: string, pathAndQuery: string): string {
  return hashWithEnv(hash, env) || pathAndQuery;
}

/** Read and write the cost environment through the page URL. */
export interface CostEnvLink {
  initial(costList: readonly CostEntry[]): string | undefined;
  write(env: string): void;
}

export function createCostEnvLink(url: UrlState): CostEnvLink {
  return {
    initial: (costList) => costEnvFromHash(url.readHash(), costList),
    write: (env) => url.replaceUrl(costEnvUrl(url.readHash(), env, url.readPathAndQuery())),
  };
}
