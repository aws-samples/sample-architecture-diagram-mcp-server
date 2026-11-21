// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { defineConfig } from 'vitest/config';
import { defaultServerConditions } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // The core is consumed through its public entries; the "source" export
  // condition points them at the TypeScript sources (no core build needed).
  ssr: { resolve: { conditions: ['source', ...defaultServerConditions] } },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
