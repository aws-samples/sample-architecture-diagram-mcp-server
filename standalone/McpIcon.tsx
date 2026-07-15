// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The MCP's icon component, matching the interface the shared core components
// expect (<Icon src size alt color/>), but keeping the MCP's OWN resolution and
// theming rules — resolveIcon via window.__ICONS__ (base64-inlined for the
// self-contained HTML) and iconFilter's selective invert (only aws-icons/* and
// *_Light are monochrome; the AWS Resource set here is mostly full-color, so it
// must NOT get the two-image _Dark swap the deck's Icon uses). Passed to the
// core LiveDiagram as its `Icon` prop.
import { resolveIcon, iconFilter } from "@/lib/icons";

export function McpIcon({ src, size, className, alt = "", color = "#FF9900", style }: {
  src?: string; size?: number; className?: string; alt?: string; color?: string; style?: React.CSSProperties;
}) {
  if (!src) return null;
  const resolved = resolveIcon(String(src));
  if (!resolved) {
    const initial = (alt || "").replace(/^(Amazon |AWS )/, "").charAt(0) || "•";
    const fs = className ? undefined : (size ?? 24) * 0.5;
    return <span className={className} style={{ fontSize: fs, fontWeight: 700, color, lineHeight: 1, ...style }}>{initial}</span>;
  }
  const dims = className ? {} : { width: size ?? 24, height: size ?? 24 };
  return (
    <img src={resolved} alt={alt} {...dims} className={className}
      style={{ filter: iconFilter(String(src)), objectFit: "contain", ...style }}
      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
  );
}

export default McpIcon;
