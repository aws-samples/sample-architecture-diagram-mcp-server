// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  root: resolve(__dirname, 'standalone'),
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'es2020',
    // viteSingleFile inlines everything into one HTML, so there are never any
    // `<link rel="modulepreload">` chunks for Vite's polyfill to preload — it ships
    // as unreachable code in every generated diagram. Drop it.
    modulePreload: false,
  },
});
