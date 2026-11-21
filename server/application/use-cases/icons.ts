// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Icons: resolve a service name, report whether the icon SET is installed, and
// install it (once per machine).
import { SERVICE_ICONS } from "#domain/render/icons.ts";
import type { AppDeps } from "./deps.ts";

export type SetupIconsResult =
  | { status: "already"; count: number; root: string }
  | { status: "ran"; output: string; root: string; installed: boolean };

export function createIcons(deps: AppDeps) {
  const { domain, icons, workspace: ws } = deps;
  return {
    /** True when the AWS Architecture Icons are installed (else every node renders as a colored initial). */
    installed(): boolean {
      return icons.installed();
    },
    /** Every service name with a catalog icon, sorted. */
    mappedServices(): string[] {
      return Object.keys(SERVICE_ICONS).sort();
    },
    resolve(service: string): string | null {
      return domain.icons.iconForService(service);
    },
    setup({ source, dest, force }: { source?: string; dest?: string; force?: boolean }): SetupIconsResult {
      if (!force && !source && !dest && icons.installed()) return { status: "already", count: icons.count(), root: icons.root() };
      const output = icons.install({ source: source ? ws.resolve(source) : undefined, dest: dest ? ws.resolve(dest) : undefined });
      icons.refresh(); // the next diagram must see what was just installed
      return { status: "ran", output, root: icons.root(), installed: icons.installed() };
    },
  };
}
export type Icons = ReturnType<typeof createIcons>;
