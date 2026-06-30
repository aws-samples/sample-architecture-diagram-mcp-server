import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
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

createRoot(document.getElementById('root')!).render(
  <ReactFlowProvider>
    <StandaloneApp data={archData} />
  </ReactFlowProvider>
);
