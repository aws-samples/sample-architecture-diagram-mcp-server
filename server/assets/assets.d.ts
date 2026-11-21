// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Text assets (HTML templates) are imported with the `?raw` suffix: vite/vitest
// support it natively and scripts/build-server.mjs maps it to esbuild's text loader.
declare module "*?raw" {
  const text: string;
  export default text;
}
