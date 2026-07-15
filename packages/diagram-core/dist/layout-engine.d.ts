/**
 * Async ELK compound layout. Returns { nodes, edgePaths }.
 * @param {object} opts
 *   direction   'LR' | 'TB' | 'RADIAL'
 *   geometry    node/group size overrides (see DEFAULT_GEOMETRY)
 *   spacing     ELK spacing scale (default 1)
 *   reanchorEdges  apply the LCA edge re-anchor (elkjs ≈0.9); default false
 *   groupsInteractive  group nodes selectable/draggable; default false
 */
declare function elkLayout(serviceNodes: any, edges: any, membership: any, opts?: object): Promise<{
    nodes: any[];
    edgePaths: {};
}>;
/**
 * Synchronous dagre fallback (used when ELK throws). Includes the slides'
 * bbox-union group sizing + root-group overlap separation. Returns nodes only.
 */
declare function compoundLayout(serviceNodes: any, edges: any, membership: any, opts?: {}): any[];
/** ELK layout with automatic dagre fallback on failure — the call both apps use. */
declare function layoutWithFallback(serviceNodes: any, edges: any, membership: any, opts?: {}): Promise<{
    nodes: any[];
    edgePaths: {};
} | {
    nodes: any[];
    edgePaths: {};
}>;

export { compoundLayout, elkLayout, layoutWithFallback };
