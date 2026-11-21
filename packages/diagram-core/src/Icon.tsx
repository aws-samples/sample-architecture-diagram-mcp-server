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
//   "/diagram-icons/Res_Users_48.png"                     → pathed diagram icon (themes like its bare form)
import { useState } from "react";
import type { CSSProperties, ComponentType } from "react";
import { DARK_VARIANT_BASES } from "./darkVariants.ts";
import { MONO_INVERT_RES } from "./icons.ts";
import { AWS_ORANGE } from "./tones.ts";

const DEFAULT_ICON_BASE = "/diagram-icons/";
const identity = (u: string | null): string | null => u;
const NO_BRANDS: ReadonlySet<string> = new Set();

const isFlatDiagramRef = (ref: unknown): ref is string => typeof ref === "string" && !ref.startsWith("/") && !ref.startsWith("data:");
const baseName = (ref: string): string => { const f = ref.split("/").pop() || ref; return f.endsWith(".png") ? f.slice(0, -4) : f; };

// Monochrome glyphs that must invert to stay visible on a dark background:
// the category icons (/aws-category-icons/*, *_64.svg — one navy shape) and the
// few navy Res_ glyphs without a usable *_Dark sibling (MONO_INVERT_RES). Not
// "all Res_": most Res_ icons are full-color service glyphs, and the navy ones
// WITH a *_Dark sibling are swapped instead. Detected from the original ref (the
// resolved src may be a data: URI).
function isMonochrome(ref: unknown): boolean {
  if (typeof ref !== "string") return false;
  return ref.includes("/aws-category-icons/") || /_64\.svg$/.test(ref) || MONO_INVERT_RES.has(baseName(ref));
}

// The *_Dark sibling of a ref: a flat or pathed diagram .png listed in
// DARK_VARIANT_BASES, or an absolute-path logo listed in `brandDarkVariants`
// (file name → its `<name>_Dark.<ext>` sits next to it).
function darkSiblingPath(ref: unknown, iconBase: string, brands: ReadonlySet<string>): string | null {
  if (typeof ref !== "string") return null;
  if (ref.startsWith("/")) {
    const file = ref.split("/").pop() ?? "";
    if (ref.startsWith(iconBase) && file.endsWith(".png")) {
      const base = file.slice(0, -4);
      return DARK_VARIANT_BASES.has(base) ? iconBase + base + "_Dark.png" : null;
    }
    if (brands.has(file)) { const dot = ref.lastIndexOf("."); return ref.slice(0, dot) + "_Dark" + ref.slice(dot); }
    return null;
  }
  if (!isFlatDiagramRef(ref) || !ref.endsWith(".png")) return null;
  const base = ref.slice(0, -4);
  return DARK_VARIANT_BASES.has(base) ? iconBase + base + "_Dark.png" : null;
}

export interface IconProps {
  /** Icon reference (any form above). */
  src?: string | null;
  /** px width/height, or a key of `sizes` (a named, class-based size). */
  size?: number | string;
  /** Sizing/extra classes (merged with a named size). */
  className?: string;
  /** Alt text / source of the fallback initial. */
  alt?: string;
  /** Fallback initial color (default AWS orange). */
  color?: string;
  /** Extra inline styles. */
  style?: CSSProperties;
  /** (servedPath) => url. Default: identity (served path passes through). */
  resolveAsset?: (servedPath: string | null) => string | null | undefined;
  /** Base dir for flat refs. Default "/diagram-icons/". */
  iconBase?: string;
  /** Logo file names that ship a *_Dark sibling. */
  brandDarkVariants?: ReadonlySet<string>;
  /** Named sizes → class names (e.g. { sm: "w-6 h-6" }). */
  sizes?: Record<string, string>;
}

/**
 * The props a host-injected `Icon` component (the `Icon` prop of the cards,
 * nodes and players) is rendered with — a subset of IconProps, so a host can
 * pass its own pre-wired wrapper around the core Icon.
 */
export interface IconRenderProps {
  /** May be empty: the core Icon then renders nothing. */
  src?: string;
  /** px (the core always passes a number). */
  size?: number;
  alt?: string;
  color?: string;
  className?: string;
  style?: CSSProperties;
}
export type IconComponent = ComponentType<IconRenderProps>;

/**
 * @param {object}   props
 * @param {string}   props.src            icon reference (any form above).
 * @param {number|string} [props.size]    px width/height, or a key of `sizes` (a named, class-based size).
 * @param {string}  [props.className]     sizing/extra classes (merged with a named size).
 * @param {string}  [props.alt]           alt text / source of the fallback initial.
 * @param {string}  [props.color]         fallback initial color (default AWS orange).
 * @param {object}  [props.style]         extra inline styles.
 * @param {Function}[props.resolveAsset]  (servedPath) => url. Default: identity (served path passes through).
 * @param {string}  [props.iconBase]      base dir for flat refs. Default "/diagram-icons/".
 * @param {Set}     [props.brandDarkVariants] logo file names that ship a *_Dark sibling.
 * @param {object}  [props.sizes]         named sizes → class names (e.g. { sm: "w-6 h-6" }).
 */
export function Icon({ src, size, className, alt = "", color = AWS_ORANGE, style, resolveAsset = identity, iconBase = DEFAULT_ICON_BASE, brandDarkVariants = NO_BRANDS, sizes = undefined }: IconProps) {
  const [failed, setFailed] = useState(false);
  if (!src) return null;

  const servedPath = (ref: string | null): string | null => (!ref ? null : ref.startsWith("data:") || ref.startsWith("/") ? ref : iconBase + ref);
  const light = resolveAsset(servedPath(src));
  const darkRef = darkSiblingPath(src, iconBase, brandDarkVariants);
  const dark = darkRef ? resolveAsset(darkRef) : null;

  const named = typeof size === "string" ? (sizes?.[size] || "") : "";
  const cls = [named, className].filter(Boolean).join(" ");
  const px = typeof size === "number" ? size : 24;
  const dims = cls ? {} : { width: px, height: px };

  if (failed || !light) {
    const initial = (alt || "").replace(/^(Amazon |AWS )/, "").charAt(0) || "•";
    return <span className={cls} style={{ fontSize: cls ? undefined : px * 0.5, fontWeight: 700, color, lineHeight: 1, ...style }}>{initial}</span>;
  }

  // Two-image CSS swap for icons that ship a dark variant.
  if (dark) {
    return (
      <>
        <img src={light} alt={alt} {...dims} className={`${cls} dark:hidden`.trim()} style={style} onError={() => setFailed(true)} />
        <img src={dark} alt={alt} {...dims} className={`${cls} hidden dark:block`.trim()} style={style} onError={() => setFailed(true)} />
      </>
    );
  }

  // Monochrome glyphs invert in dark mode; everything else renders untouched.
  return (
    <img
      src={light}
      alt={alt}
      {...dims}
      className={`${cls}${isMonochrome(src) ? " dark:brightness-0 dark:invert" : ""}`.trim()}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}
Icon.displayName = "Icon";

export default Icon;
