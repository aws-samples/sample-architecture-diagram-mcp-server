// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Shared Icon — the ONE image/icon component for a diagram renderer. It knows
// how to (1) resolve a reference to a renderable src, (2) theme it (monochrome
// glyphs invert in dark mode; icons with an official *_Dark sibling swap to it
// via a two-image CSS swap), and (3) fall back to a colored initial on failure.
//
// It is framework-host-agnostic: the two things that differ per app — how a
// served path becomes a real URL (offline data-URI vs served path) and the base
// dir for flat icon refs — are INJECTED via props (`resolveAsset`, `iconBase`),
// so the slides deck and the MCP standalone each pass their own without forking
// this component.
//
// Reference forms accepted:
//   "/aws-icons/custom.svg", "/logo.svg", "/photo.jpg"  → served path (as-is)
//   "Arch_*.png" / "Res_*.png" / "Region_32.png"          → flat diagram icon (→ iconBase)
import { useState } from "react";
import { DARK_VARIANT_BASES } from "./darkVariants.js";

const DEFAULT_ICON_BASE = "/diagram-icons/";
const identity = (u) => u;

const isFlatDiagramRef = (ref) => typeof ref === "string" && !ref.startsWith("/") && !ref.startsWith("data:");

// Monochrome glyphs that must invert to stay visible on a dark background.
function isMonochrome(ref) {
  if (typeof ref !== "string") return false;
  if (ref.includes("/aws-category-icons/")) return true;
  if (ref.startsWith("Res_")) return true;
  return false;
}

/**
 * @param {object}   props
 * @param {string}   props.src            icon reference (any form above).
 * @param {number}  [props.size]          px width/height when using inline sizing.
 * @param {string}  [props.className]     Tailwind sizing/extra classes (overrides size).
 * @param {string}  [props.alt]           alt text / source of the fallback initial.
 * @param {string}  [props.color]         fallback initial color (default AWS orange).
 * @param {object}  [props.style]         extra inline styles.
 * @param {Function}[props.resolveAsset]  (servedPath) => url. Default: identity (served path passes through).
 * @param {string}  [props.iconBase]      base dir for flat refs. Default "/diagram-icons/".
 */
export function Icon({ src, size, className, alt = "", color = "#FF9900", style, resolveAsset = identity, iconBase = DEFAULT_ICON_BASE }) {
  const [failed, setFailed] = useState(false);
  if (!src) return null;

  const servedPath = (ref) => {
    if (!ref) return null;
    if (ref.startsWith("data:") || ref.startsWith("/")) return ref;
    return iconBase + ref;
  };
  const darkSiblingPath = (ref) => {
    if (!isFlatDiagramRef(ref) || !ref.endsWith(".png")) return null;
    const base = ref.slice(0, -4);
    return DARK_VARIANT_BASES.has(base) ? iconBase + base + "_Dark.png" : null;
  };

  const light = resolveAsset(servedPath(src));
  const darkRef = darkSiblingPath(src);
  const dark = darkRef ? resolveAsset(darkRef) : null;

  const dims = className ? {} : { width: size ?? 24, height: size ?? 24 };
  const cls = className || "";

  if (failed || !light) {
    const initial = (alt || "").replace(/^(Amazon |AWS )/, "").charAt(0) || "•";
    const fs = className ? undefined : (size ?? 24) * 0.5;
    return <span className={cls} style={{ fontSize: fs, fontWeight: 700, color, lineHeight: 1, ...style }}>{initial}</span>;
  }

  // Two-image CSS swap for icons that ship an official dark variant.
  if (dark) {
    return (
      <>
        <img src={light} alt={alt} {...dims} className={`${cls} dark:hidden`.trim()} style={style} onError={() => setFailed(true)} />
        <img src={dark} alt={alt} {...dims} className={`${cls} hidden dark:block`.trim()} style={style} onError={() => setFailed(true)} />
      </>
    );
  }

  // Monochrome glyphs invert in dark mode; everything else renders untouched.
  const mono = isMonochrome(src);
  return (
    <img
      src={light}
      alt={alt}
      {...dims}
      className={`${cls}${mono ? " dark:brightness-0 dark:invert" : ""}`.trim()}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}
Icon.displayName = "Icon";

export default Icon;
