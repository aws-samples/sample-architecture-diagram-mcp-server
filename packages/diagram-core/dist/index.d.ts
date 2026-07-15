export { A as ALL_GROUP_ICONS, D as DEFAULT_VARIANT, G as GROUP_VARIANTS, V as VARIANT_ALIASES, r as resolveVariant, v as variantKey } from './groupVariants-Dh9m6l9E.js';

declare namespace TONE_COLORS {
    let accent: string;
    let info: string;
    let success: string;
    let warn: string;
    let danger: string;
    let neutral: string;
    let survive: string;
    let severed: string;
    let degrade: string;
}
declare namespace TONE_META {
    export namespace accent_1 {
        let label: string;
        let glyph: string;
    }
    export { accent_1 as accent };
    export namespace info_1 {
        let label_1: string;
        export { label_1 as label };
        let glyph_1: string;
        export { glyph_1 as glyph };
    }
    export { info_1 as info };
    export namespace success_1 {
        let label_2: string;
        export { label_2 as label };
        let glyph_2: string;
        export { glyph_2 as glyph };
    }
    export { success_1 as success };
    export namespace warn_1 {
        let label_3: string;
        export { label_3 as label };
        let glyph_3: string;
        export { glyph_3 as glyph };
    }
    export { warn_1 as warn };
    export namespace danger_1 {
        let label_4: string;
        export { label_4 as label };
        let glyph_4: string;
        export { glyph_4 as glyph };
    }
    export { danger_1 as danger };
    export namespace neutral_1 {
        let label_5: string;
        export { label_5 as label };
        let glyph_5: string;
        export { glyph_5 as glyph };
    }
    export { neutral_1 as neutral };
    export namespace survive_1 {
        let label_6: string;
        export { label_6 as label };
        let glyph_6: string;
        export { glyph_6 as glyph };
    }
    export { survive_1 as survive };
    export namespace severed_1 {
        let label_7: string;
        export { label_7 as label };
        let glyph_7: string;
        export { glyph_7 as glyph };
    }
    export { severed_1 as severed };
    export namespace degrade_1 {
        let label_8: string;
        export { label_8 as label };
        let glyph_8: string;
        export { glyph_8 as glyph };
    }
    export { degrade_1 as degrade };
}
declare function resolveToneColor(tone: any, color: any): any;
declare function toneColor(t: any): any;
declare function toneMeta(t: any): any;
type Tone = "accent" | "info" | "success" | "warn" | "danger" | "neutral" | "survive" | "severed" | "degrade";

/**
 * Resolve groups + membership. Two modes:
 *  1. Explicit: `declaredGroups` declares containers (any depth) and each
 *     service points at one via `parentId` (or `group`). Used for arbitrary
 *     topologies (multi-VPC, multi-account, AZs, on-prem…).
 *  2. Implicit (back-compat): no groups declared — derive the classic
 *     AWS Cloud → VPC → public/private subnet tree from the `subnet` field.
 *
 * `pill` is carried through in explicit mode for renderers that show a group
 * header badge (slides); renderers that don't (MCP) simply ignore it.
 */
declare function resolveGroupsAndMembership(services: any, declaredGroups: any): {
    groups: any;
    membership: {};
};

/** Resolve an author value that may be a plain string or a per-language map.
 *  Fallback order: lang → `fallback` (default "en") → first available value → "".
 */
declare function tr(val: any, lang: any, fallback?: string): any;
declare function i18n(val: any, lang: any): any;

/** ELK spacing applied at the root AND inside every group so nodes never end up
 *  adjacent-tight. `scale` (>1) loosens for small per-beat diagrams; `base`
 *  overrides the between-layers / node-node gaps (surfaces tune these). */
declare function elkSpacing(scale?: number, base?: {}): {
    "elk.layered.spacing.nodeNodeBetweenLayers": string;
    "elk.spacing.nodeNode": string;
    "elk.spacing.edgeNode": string;
    "elk.layered.spacing.edgeNodeBetweenLayers": string;
};
/** Graph-level ELK options for the layered compound layout with orthogonal
 *  edge routing. `dir` is "LR" (horizontal) or "TB" (vertical). Identical on
 *  both renderers — the one place the algorithm config lives. */
declare function elkGraphOptions(dir?: string, scale?: number, base?: {}): {
    "elk.layered.nodePlacement.strategy": string;
    "elk.layered.considerModelOrder.strategy": string;
    "elk.layered.spacing.nodeNodeBetweenLayers": string;
    "elk.spacing.nodeNode": string;
    "elk.spacing.edgeNode": string;
    "elk.layered.spacing.edgeNodeBetweenLayers": string;
    "elk.algorithm": string;
    "elk.direction": string;
    "elk.hierarchyHandling": string;
    "elk.edgeRouting": string;
    "elk.json.edgeCoords": string;
};
/** Per-group ELK padding string for a container node. */
declare function elkGroupPadding(geom?: {
    nodeW: number;
    nodeH: number;
    groupPad: number;
    groupPadTop: number;
    groupExtraPerDepth: number;
    groupLabelStep: number;
    elkGroupPad: number;
    elkGroupPadTop: number;
    elkBetweenLayers: number;
    elkNodeNode: number;
}): string;
/** Depth of a group in the parent chain (0 = root-level). */
declare function groupDepth(id: any, groupById: any): number;
/** Ancestor group chain of a service, outermost → innermost. */
declare function ancestorsOf(svcId: any, membership: any, groupById: any): any[];
/** Least-common-ancestor container id of two services, or null (→ ROOT). */
declare function lcaContainer(src: any, tgt: any, membership: any, groupById: any): any;
/**
 * Radial (hub-and-spoke) placement: the most-connected node sits at the center,
 * the rest fan out on concentric rings. Returns nodes with `position` set.
 * Node geometry is a parameter so each surface centers with its own node size.
 */
declare function radialLayout(serviceNodes: any, edges: any, geom?: {
    nodeW: number;
    nodeH: number;
    groupPad: number;
    groupPadTop: number;
    groupExtraPerDepth: number;
    groupLabelStep: number;
    elkGroupPad: number;
    elkGroupPadTop: number;
    elkBetweenLayers: number;
    elkNodeNode: number;
}): any[];
declare namespace DEFAULT_GEOMETRY {
    let nodeW: number;
    let nodeH: number;
    let groupPad: number;
    let groupPadTop: number;
    let groupExtraPerDepth: number;
    let groupLabelStep: number;
    let elkGroupPad: number;
    let elkGroupPadTop: number;
    let elkBetweenLayers: number;
    let elkNodeNode: number;
}
declare namespace HORIZONTAL_GEOMETRY {
    let nodeW_1: number;
    export { nodeW_1 as nodeW };
    let nodeH_1: number;
    export { nodeH_1 as nodeH };
    let groupPad_1: number;
    export { groupPad_1 as groupPad };
    let groupPadTop_1: number;
    export { groupPadTop_1 as groupPadTop };
    let groupExtraPerDepth_1: number;
    export { groupExtraPerDepth_1 as groupExtraPerDepth };
    let groupLabelStep_1: number;
    export { groupLabelStep_1 as groupLabelStep };
    let elkGroupPad_1: number;
    export { elkGroupPad_1 as elkGroupPad };
    let elkGroupPadTop_1: number;
    export { elkGroupPadTop_1 as elkGroupPadTop };
    let elkBetweenLayers_1: number;
    export { elkBetweenLayers_1 as elkBetweenLayers };
    let elkNodeNode_1: number;
    export { elkNodeNode_1 as elkNodeNode };
}
declare namespace SLIDES_GEOMETRY { }

export { DEFAULT_GEOMETRY, HORIZONTAL_GEOMETRY, SLIDES_GEOMETRY, TONE_COLORS, TONE_META, type Tone, ancestorsOf, elkGraphOptions, elkGroupPadding, elkSpacing, groupDepth, i18n, lcaContainer, radialLayout, resolveGroupsAndMembership, resolveToneColor, toneColor, toneMeta, tr };
