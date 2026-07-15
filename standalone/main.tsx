// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './index.css';
import { StandaloneApp } from './StandaloneApp';

const dataEl = document.getElementById('arch-data');
const archData = dataEl ? JSON.parse(dataEl.textContent || '{}') : {};

// Inlined base64 icon map ({{ICON_DATA}} is substituted at generation time).
// Components resolve icons through window.__ICONS__ so the HTML is fully
// self-contained — no external /icons/ requests that break under file://.
const iconEl = document.getElementById('icon-data');
try {
  const raw = iconEl?.textContent || '{}';
  (window as any).__ICONS__ = raw.includes('{{') ? {} : JSON.parse(raw);
} catch {
  (window as any).__ICONS__ = {};
}

// The core LiveDiagram wraps itself in a ReactFlowProvider.
createRoot(document.getElementById('root')!).render(
  <StandaloneApp data={archData} />
);
