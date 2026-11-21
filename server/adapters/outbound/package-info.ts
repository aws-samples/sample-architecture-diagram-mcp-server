// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// PackageInfo from the installed package.json.
import type { PackageInfo } from "#application/ports/index.ts";
import { findPackageRoot, readPackageJson } from "./package-root.ts";

export class NodePackageInfo implements PackageInfo {
  readonly name: string;
  readonly version: string;
  readonly root: string;
  constructor(root: string = findPackageRoot()) {
    const pkg = readPackageJson(root);
    this.root = root;
    this.name = pkg.name;
    this.version = pkg.version;
  }
}
