import { toPng } from "html-to-image";
import { getNodesBounds, getViewportForBounds, type Node } from "@xyflow/react";

// Export the diagram as a PNG. We render the React Flow viewport at a fixed
// resolution framed to fit all nodes, so the saved image matches what's drawn
// regardless of the current zoom/pan. Works under file:// (icons are inlined).
export async function exportPng(nodes: Node[], dark: boolean, filename = "architecture.png") {
  const viewportEl = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewportEl || nodes.length === 0) return;

  const PAD = 0.12;
  const W = 1920, H = 1200;
  const bounds = getNodesBounds(nodes);
  const vp = getViewportForBounds(bounds, W, H, 0.2, 2, PAD);

  const dataUrl = await toPng(viewportEl, {
    backgroundColor: dark ? "#0f1117" : "#f8fafc",
    width: W,
    height: H,
    pixelRatio: 2,
    style: {
      width: `${W}px`,
      height: `${H}px`,
      transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
    },
  });

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
