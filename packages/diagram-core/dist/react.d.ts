import * as react from 'react';
import { r as resolveVariant } from './groupVariants-Dh9m6l9E.js';

declare const DARK_VARIANT_BASES: Set<string>;

declare const _default$2: react.MemoExoticComponent<typeof AwsNode>;

declare function AwsNode({ data, selected }: {
    data: any;
    selected: any;
}): react.JSX.Element;

declare const _default$1: react.MemoExoticComponent<typeof GroupNode>;

declare function GroupNode({ data, selected }: {
    data: any;
    selected: any;
}): react.JSX.Element;

declare const _default: react.MemoExoticComponent<typeof CustomEdge>;

declare function CustomEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style }: {
    id: any;
    sourceX: any;
    sourceY: any;
    targetX: any;
    targetY: any;
    sourcePosition: any;
    targetPosition: any;
    data: any;
    style: any;
}): react.JSX.Element;

declare function StepCard({ steps, activeStep, lang, Icon, onPick, expanded, onToggleExpand, expandLabel, collapseLabel, onTextBigger, onTextSmaller, canTextBigger, canTextSmaller, textSmallerLabel, textLargerLabel }: {
    steps: any;
    activeStep: any;
    lang?: string;
    Icon: any;
    onPick: any;
    expanded?: boolean;
    onToggleExpand: any;
    expandLabel?: string;
    collapseLabel?: string;
    onTextBigger: any;
    onTextSmaller: any;
    canTextBigger?: boolean;
    canTextSmaller?: boolean;
    textSmallerLabel?: string;
    textLargerLabel?: string;
}): react.JSX.Element;

declare function NodeModal({ node, onClose, Icon, strings }: {
    node: any;
    onClose: any;
    Icon: any;
    strings: any;
}): react.JSX.Element;

declare function ZoomBar({ title, subtitle, dark, visible, onToggle, onTheme, hasWalk, playing, onPlay, onReset, attention, onRecord, recording, canRecord, lang, languages, onLang, ui, langLabel, }: {
    title: any;
    subtitle: any;
    dark: any;
    visible: any;
    onToggle: any;
    onTheme: any;
    hasWalk: any;
    playing: any;
    onPlay: any;
    onReset: any;
    attention?: boolean;
    onRecord: any;
    recording?: boolean;
    canRecord?: boolean;
    lang?: string;
    languages?: any[];
    onLang: any;
    ui?: (k: any) => any;
    langLabel?: (l: any) => any;
}): react.JSX.Element;

declare function mdInline(str: any): any;
declare function CodeBlock({ code, label, color }: {
    code: any;
    label: any;
    color: any;
}): react.JSX.Element;
declare function CardShell({ color, full, header, children }: {
    color: any;
    full: any;
    header: any;
    children: any;
}): react.JSX.Element;
declare function IconTile({ icon, color, size, Icon }: {
    icon: any;
    color: any;
    size?: number;
    Icon: any;
}): react.JSX.Element;
declare function CardHeader({ icon, eyebrow, title, color, big, trailing, Icon }: {
    icon: any;
    eyebrow: any;
    title: any;
    color: any;
    big: any;
    trailing: any;
    Icon: any;
}): react.JSX.Element;
declare function Body({ children, big }: {
    children: any;
    big: any;
}): react.JSX.Element;
declare function NumberedSteps({ items, color, Icon }: {
    items: any;
    color: any;
    Icon: any;
}): react.JSX.Element;
declare function Bullets({ items, color, Icon }: {
    items: any;
    color: any;
    Icon: any;
}): react.JSX.Element;
declare function Section({ title, color, children }: {
    title: any;
    color: any;
    children: any;
}): react.JSX.Element;
declare function KeyValues({ rows }: {
    rows: any;
}): react.JSX.Element;
declare function Chips({ chips, color, Icon }: {
    chips: any;
    color: any;
    Icon: any;
}): react.JSX.Element;

declare const cardKit_Body: typeof Body;
declare const cardKit_Bullets: typeof Bullets;
declare const cardKit_CardHeader: typeof CardHeader;
declare const cardKit_CardShell: typeof CardShell;
declare const cardKit_Chips: typeof Chips;
declare const cardKit_CodeBlock: typeof CodeBlock;
declare const cardKit_IconTile: typeof IconTile;
declare const cardKit_KeyValues: typeof KeyValues;
declare const cardKit_NumberedSteps: typeof NumberedSteps;
declare const cardKit_Section: typeof Section;
declare const cardKit_mdInline: typeof mdInline;
declare const cardKit_resolveVariant: typeof resolveVariant;
declare namespace cardKit {
  export { cardKit_Body as Body, cardKit_Bullets as Bullets, cardKit_CardHeader as CardHeader, cardKit_CardShell as CardShell, cardKit_Chips as Chips, cardKit_CodeBlock as CodeBlock, cardKit_IconTile as IconTile, cardKit_KeyValues as KeyValues, cardKit_NumberedSteps as NumberedSteps, cardKit_Section as Section, cardKit_mdInline as mdInline, cardKit_resolveVariant as resolveVariant };
}

declare const LiveDiagramEditor: react.ForwardRefExoticComponent<react.RefAttributes<any>>;

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
declare function Icon({ src, size, className, alt, color, style, resolveAsset, iconBase }: {
    src: string;
    size?: number;
    className?: string;
    alt?: string;
    color?: string;
    style?: object;
    resolveAsset?: Function;
    iconBase?: string;
}): react.JSX.Element;
declare namespace Icon {
    let displayName: string;
}

declare function LiveDiagram({ data, lang, animate, direction, edgeStyle, steps, activeStep, stepLayout, fitPadding, stepFocus, spacing, stepZoom, className, geometry, nodeLayout, vars, Icon, markerId, reanchorEdges, groupsInteractive, edgeTuning, flowDots, control, chrome, theme, dark: darkProp, onThemeChange, languages, onLangChange, ui, langLabel, title, subtitle, collapsible, defaultCollapsed, zoomOnScroll, nodeModal, startStep, startCardScale, minZoom, maxZoom, fitMaxZoom, stepMaxZoom, }: {
    data: any;
    lang?: string;
    animate?: boolean;
    direction: any;
    edgeStyle: any;
    steps: any;
    activeStep: any;
    stepLayout?: string;
    fitPadding?: number;
    stepFocus?: boolean;
    spacing?: number;
    stepZoom?: boolean;
    className?: string;
    geometry: any;
    nodeLayout?: string;
    vars: any;
    Icon: any;
    markerId?: string;
    reanchorEdges?: boolean;
    groupsInteractive?: boolean;
    edgeTuning: any;
    flowDots?: boolean;
    control?: string;
    chrome?: boolean;
    theme?: string;
    dark: any;
    onThemeChange: any;
    languages?: any[];
    onLangChange: any;
    ui: any;
    langLabel: any;
    title: any;
    subtitle: any;
    collapsible?: boolean;
    defaultCollapsed?: any[];
    zoomOnScroll?: boolean;
    nodeModal?: boolean;
    startStep?: number;
    startCardScale?: number;
    minZoom?: number;
    maxZoom?: number;
    fitMaxZoom: any;
    stepMaxZoom?: number;
}): react.JSX.Element;

export { _default$2 as AwsNode, _default as CustomEdge, DARK_VARIANT_BASES, _default$1 as GroupNode, Icon, Icon as IconDefault, LiveDiagram, LiveDiagram as LiveDiagramDefault, LiveDiagramEditor, NodeModal, StepCard, ZoomBar, cardKit };
