#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { writeFileSync, readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { computeLayout } from "./lib/layout.js";
import { generateDrawio } from "./lib/drawio-xml.js";
import { generateHtml, SERVICE_ICONS, iconForService, resolveTabs } from "./lib/html-generator.js";
import { rasterizeDiagram } from "./lib/rasterize.js";
import { validateDiagram, formatValidationReport } from "./lib/validate.js";
import { computeDelta, formatDeltaSummary } from "./lib/delta.js";
import { generateSequenceHtml, seqIconResolutionReport } from "./lib/sequence-generator.js";
import { participantSchema, messageSchema, noteSchema, eventSchema, fragmentSchema, groupSchema as seqGroupSchema } from "./lib/sequence-schemas.js";
import { generateFlowHtml, flowIconResolutionReport } from "./lib/flow-generator.js";
import { flowNodeSchema, flowEdgeSchema, flowStepSchema } from "./lib/flow-schemas.js";

const server = new McpServer({ name: "sample-architecture-diagram-mcp-server", version: "2.0.0" });

// Neutral element JSON — the machine-readable diagram contract that downstream
// apps consume (cost estimation, inventory, docs). Built from the same arch-data
// the HTML embeds, so the sidecar `.json` and export_diagram_json agree. Language
// maps (e.g. { en, pt }) are preserved as-is; consumers pick their locale.
function diagramElementsJson(data, region = "us-east-1") {
  return {
    title: data.title,
    ...(data.subtitle ? { subtitle: data.subtitle } : {}),
    region,
    direction: data.direction || "LR",
    services: (data.services || []).map(s => ({
      id: s.id,
      service: s.service,
      ...(s.label ? { label: s.label } : {}),
      ...(s.role ? { role: s.role } : {}),
      category: s.category || "general",
      ...(s.external ? { external: true } : {}),
      ...(s.parentId ? { parentId: s.parentId } : {}),
      ...(s.subnet ? { subnet: s.subnet } : {}),
      ...(s.config ? { config: s.config } : {}),
    })),
    connections: (data.connections || []).map(c => ({
      id: c.id, source: c.source, target: c.target,
      ...(c.type ? { type: c.type } : {}),
      ...(c.label ? { label: c.label } : {}),
    })),
    groups: data.groups || [],
  };
}

// Write the neutral element JSON next to a generated .html (same basename, .json).
// Best-effort: a sidecar failure never fails the diagram write.
function writeSidecarJson(outputPath, title, subtitle, services, connections, options) {
  try {
    const jsonPath = outputPath.replace(/\.html?$/i, "") + ".json";
    const payload = diagramElementsJson(
      { title, subtitle, services, connections, direction: options.direction, groups: options.groups },
      options.region || "us-east-1"
    );
    writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf-8");
    return jsonPath;
  } catch { return null; }
}

// v2.0: Full auto-layout — just pass services + connections, positions computed automatically
server.tool(
  "auto_generate_diagram",
  "Generate a fully positioned AWS architecture .drawio diagram. Computes layout, container sizing, badge positions, and edge routing with the SAME ELK compound engine as the interactive HTML — no manual x/y. Containers: pass `groups` + services' `parentId` for arbitrary nesting (multi-VPC, accounts, AZs, on-prem), OR just `subnet` on services for the classic single AWS Cloud → VPC → public/private subnet tree.",
  {
    title: z.string(),
    subtitle: z.string().optional(),
    outputPath: z.string().describe("Absolute path for .drawio output"),
    region: z.string().optional().default("us-east-1"),
    services: z.array(z.object({
      id: z.string(),
      service: z.string().describe("Display name"),
      shape: z.string().describe("AWS4 shape: lambda, fargate, rds, s3, etc."),
      category: z.enum(["compute", "storage", "database", "networking", "security", "integration", "analytics", "ai", "management", "general"]),
      label: z.string().optional().describe("Italic sub-label"),
      parentId: z.string().optional().describe("Id of the container (from `groups`) this service sits in. Enables arbitrary nesting; takes precedence over `subnet`."),
      subnet: z.enum(["public", "private"]).optional().describe("Single-VPC shortcut when `groups`/`parentId` are not used (omit = outside VPC, edge service)."),
      external: z.boolean().optional().describe("True for external integrations (Pix, Gov.br, etc.)"),
      isApi: z.boolean().optional().describe("For externals: true=API/internet icon, false=app icon"),
    })),
    connections: z.array(z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      label: z.string().optional().describe("Step description for legend"),
      type: z.enum(["network", "iam", "event", "data"]).optional().describe("Connection semantics, styled distinctly (matches the HTML): network (blue), iam (red dashed), event (pink dotted), data (green)."),
      dashed: z.boolean().optional(),
    })),
    groups: z.array(z.object({
      id: z.string(),
      label: z.string(),
      parent: z.string().optional().describe("Parent container id, for nesting to any depth."),
      variant: z.enum(["aws-cloud", "region", "vpc", "public-subnet", "private-subnet", "availability-zone", "account", "organization", "auto-scaling-group", "group", "corporate-data-center", "on-premises"]).optional().describe("Container type → official AWS4 group icon + colour."),
    })).optional().describe("Explicit containers for arbitrary topologies. Services join one via `parentId`. Omit to derive the classic AWS Cloud → VPC → subnet tree from each service's `subnet`."),
    includeUsers: z.boolean().optional().default(true),
  },
  async ({ title, subtitle, outputPath, region, services, connections, groups, includeUsers }) => {
    // Add users node if requested
    const allServices = includeUsers ? [{ id: "users", service: "Users", shape: "users", category: "general" }, ...services] : services;

    // Auto-compute layout (shared ELK compound engine; async)
    const layout = await computeLayout({ services: allServices, connections, region, groups });

    // Generate XML
    const xml = generateDrawio(title, subtitle || "", layout.services, layout.connections, layout.groups, {
      users: layout.users,
      externals: layout.externals,
      steps: layout.badges,
    });

    writeFileSync(outputPath, xml, "utf-8");
    return { content: [{ type: "text", text: `Diagram saved: ${outputPath}\nServices: ${layout.services.length} | Edges: ${connections.length} | Groups: ${layout.groups.length} | Steps: ${layout.badges.length}\nUse export_diagram to convert to PNG.` }] };
  }
);

// v1.1: Manual positioning (keep for backward compat)
server.tool(
  "generate_diagram",
  "Generate diagram with manual x/y positioning. Use auto_generate_diagram for automatic layout.",
  {
    title: z.string(),
    subtitle: z.string().optional(),
    outputPath: z.string(),
    services: z.array(z.object({
      id: z.string(), service: z.string(), shape: z.string(),
      category: z.enum(["compute", "storage", "database", "networking", "security", "integration", "analytics", "ai", "management", "general"]),
      label: z.string().optional(), x: z.number(), y: z.number(), parentId: z.string().optional(),
    })),
    connections: z.array(z.object({
      id: z.string(), source: z.string(), target: z.string(), dashed: z.boolean().optional(),
      exitX: z.number().optional(), exitY: z.number().optional(), entryX: z.number().optional(), entryY: z.number().optional(),
    })),
    groups: z.array(z.object({
      id: z.string(), type: z.enum(["aws-cloud", "region", "vpc", "public-subnet", "private-subnet"]),
      label: z.string(), x: z.number(), y: z.number(), w: z.number(), h: z.number(), parentId: z.string().optional(),
    })).optional(),
    options: z.object({
      users: z.object({ x: z.number(), y: z.number() }).optional(),
      externals: z.array(z.object({ id: z.string(), label: z.string(), x: z.number(), y: z.number(), isApi: z.boolean().optional() })).optional(),
      steps: z.array(z.object({ number: z.number(), description: z.string(), badgeX: z.number(), badgeY: z.number() })).optional(),
    }).optional(),
  },
  async ({ title, subtitle, outputPath, services, connections, groups, options }) => {
    const xml = generateDrawio(title, subtitle || "", services, connections, groups || [], options || {});
    writeFileSync(outputPath, xml, "utf-8");
    return { content: [{ type: "text", text: `Diagram saved: ${outputPath}` }] };
  }
);

// Input schemas live in lib/schemas.js so the local example generators
// (gen-*.mjs) validate against the SAME contract these tools expose.
import { serviceSchema, connectionSchema, groupSchema, stepSchema, tabSchema, sequenceSchema, stageSchema } from "./lib/schemas.js";

// Interactive animated HTML diagram (an interactive canvas)
server.tool(
  "generate_html_diagram",
  "Generate an interactive animated HTML diagram with React Flow in ONE call. Nodes are draggable and clickable (detail modal), edges animate + carry label pills, optional guided walkthrough. Self-contained single HTML file. For staged assembly, use diagram_create + diagram_add_* + diagram_render instead.",
  {
    title: z.string(),
    subtitle: z.string().optional(),
    outputPath: z.string().describe("Output .html file path"),
    services: z.array(serviceSchema),
    connections: z.array(connectionSchema),
    groups: z.array(groupSchema).optional().describe("Explicit containers for arbitrary topologies. When omitted, a single AWS Cloud → VPC → public/private subnet tree is derived from each service's `subnet`."),
    direction: z.enum(["LR", "TB"]).optional().describe("Layout flow direction: LR (left→right, default) or TB (top→bottom)."),
    lang: z.string().optional().describe("Language the content is authored in (ISO 639-1, e.g. 'en', 'pt', 'es'). Default 'en'. The UI chrome (modal headings, tooltips) adapts to it."),
    languages: z.array(z.string()).optional().describe("Offer a language switch in the toolbar. List every language you provide text for — ANY ISO 639-1 code works, not just en/pt (e.g. ['en','es','ja','fr']). When set with >1 entry, ALL author text fields (title, subtitle, service/role, group label, step title/eyebrow/body/badge, bullets, chips, sections) may be a per-language map { en: '…', ja: '…' } instead of a plain string, and the toolbar lets the viewer switch. Omit for single-language diagrams."),
    uiStrings: z.record(z.record(z.string())).optional().describe("Localize the built-in UI chrome (toolbar tooltips + node-modal headings) for languages beyond the built-in en/pt/es — keyed by UI key then language, e.g. { restart: { ja: 'ウォークスルーを再開' }, theme: { ja: 'テーマ切替' } }. Keys: iac, pricing, architecture, restart, play, pause, theme, collapse, expand, language. Omitted (key,lang) falls back to the built-in table, then English."),
    langLabels: z.record(z.string()).optional().describe("Display label per language for its toolbar switch button, e.g. { en: 'EN', ja: '日本語', 'zh-CN': '中文' }. Defaults to a built-in for en/pt/es/fr/de, else the uppercased code."),
    steps: z.array(stepSchema).optional().describe("Guided walkthrough beats. Arrow keys / the dock's play button step through them; each shows an overlay card and can tint+zoom a subset of the diagram."),
    startStep: z.number().int().optional().describe("Which beat the diagram opens on: -1 (default) shows the whole-diagram overview first; 0+ opens directly on that beat, so a wide/dense diagram lands already zoomed into a legible region (requires stepZoom to frame it)."),
    startCardScale: z.number().int().min(0).max(3).optional().describe("Initial text-size step (0–3, default 0) the walkthrough card opens at — set 1–3 to start with a LARGER card; the A−/A+ card buttons still adjust from there."),
    stepZoom: z.boolean().optional().describe("When steps are present, glide the camera onto each beat's `zoom` (or `nodes`). Default off."),
    stepFocus: z.boolean().optional().describe("When steps are present, hide non-active nodes each beat to isolate it. Default off (dim instead of hide)."),
    flowDots: z.boolean().optional().describe("Animate a dot travelling along each connection to convey flow direction. Default true. Set false for a static, print-friendly look (arrowheads only, no motion)."),
    flowPeriod: z.number().optional().describe("Uniform flow-dot period in seconds: make EVERY edge's dot share this exact period (instead of the default staggered per-edge timing) so a GIF captured over `flowPeriod` seconds via render_diagram_media loops seamlessly. Set this when the HTML will be turned into a looping GIF."),
    collapsible: z.boolean().optional().describe("Show a fold toggle (▸/▾) on every group header so the viewer can collapse/expand containers (d3-zoomable-treemap style); collapsing a group hides its children, shrinks it to a small box, and re-runs the layout. Default true."),
    defaultCollapsed: z.array(z.string()).optional().describe("Group ids that start COLLAPSED on load — good for a dense diagram whose overview should read clean, letting the viewer expand only what they need (e.g. ['vpcdados'])."),
    sequence: sequenceSchema.optional().describe("Add a SECOND VIEW of the same system: an animated UML sequence diagram (participants + ordered messages, alt/opt/loop fragments, notes). Passing it turns the output into a two-tab document (Architecture + Sequence) with a tab rail — no `tabs` needed. Play/→ walks the flow beat by beat."),
    tabs: z.array(tabSchema).optional().describe("Full control over the MULTI-TAB document: one tab per view — kind 'architecture' (the live canvas), 'sequence' (animated UML sequence, needs `sequence`), or 'doc' (prose sections). Use this instead of `sequence` when you want custom labels/order or extra prose tabs. Each tab is deep-linkable via the URL hash."),
    stage: stageSchema.optional().describe("PRESENTER MODE (opt-in): bridge the walkthrough to a REAL shell for a live demo or a screen recording — a `cmd` button next to the code block's `copiar` types that beat's command on the live prompt (un-executed: the presenter only presses Enter, nothing is pasted on camera), an `auto` switch sits in the step rail, and a browser terminal (ttyd) is embedded in the card. Needs a small loopback control server (SSE /events + /step/<token>); without it the diagram is unaffected. Add only when the user asks for a demo/recording setup."),
  },
  async ({ title, subtitle, outputPath, services, connections, groups, direction, steps, startStep, startCardScale, stepZoom, stepFocus, lang, languages, uiStrings, langLabels, flowDots, flowPeriod, collapsible, defaultCollapsed, sequence, tabs, stage }) => {
    // Validate + auto-repair the IR before rendering; the repaired model is what
    // reaches the generator (dangling edges dropped, missing refs cleaned, etc.).
    const { report, repaired } = validateDiagram({ services, connections, groups, steps });
    const html = generateHtml(title, subtitle || "", repaired.services, repaired.connections, { groups: repaired.groups, direction, steps: repaired.steps, startStep, startCardScale, stepZoom, stepFocus, lang, languages, uiStrings, langLabels, flowDots, flowPeriod, collapsible, defaultCollapsed, sequence, tabs, stage });
    writeFileSync(outputPath, html, "utf-8");
    const jsonPath = writeSidecarJson(outputPath, title, subtitle, repaired.services, repaired.connections, { groups: repaired.groups, direction });
    // When `sequence`/`tabs` is present the output is a multi-tab document; report
    // the resolved rail so the agent sees what the viewer will actually get.
    const resolvedTabs = resolveTabs({ sequence, tabs });
    const seqTabs = (resolvedTabs || []).filter(t => t.kind === "sequence");
    const extras = [
      repaired.groups?.length ? `${repaired.groups.length} group(s)` : null,
      repaired.steps?.length ? `${repaired.steps.length}-step walkthrough` : null,
      resolvedTabs?.length ? `${resolvedTabs.length} tabs (${resolvedTabs.map(t => t.kind).join(", ")})` : null,
      seqTabs.length ? `sequence: ${seqTabs.reduce((n, t) => n + (t.sequence?.participants?.length || 0), 0)} participants / ${seqTabs.reduce((n, t) => n + (t.sequence?.events?.length || 0), 0)} events` : null,
    ].filter(Boolean);
    return { content: [{ type: "text", text: `Interactive diagram saved: ${outputPath}${extras.length ? "\nIncluded: " + extras.join(", ") : ""}${jsonPath ? `\nElements JSON: ${jsonPath}` : ""}\nOpen in browser for animated data flow visualization.${formatValidationReport(report)}` }] };
  }
);

// Standalone validation: run the same well-formedness pass the render tools run,
// without writing any file. Returns coded findings + the receipts an auto-repair
// WOULD log, plus the repaired IR — so an agent can lint an IR up front (or in CI)
// and decide whether to fix by hand before rendering.
server.tool(
  "validate_diagram",
  "Validate a diagram IR (services + connections + groups + steps) for well-formedness — orphan nodes, dangling connection endpoints, duplicate ids, missing icons, broken parent references, group cycles, and unreachable/dangling walkthrough steps. Returns a structured report with STABLE rule codes and, when repair=true (default), the auto-repaired IR plus a receipt of every change. The render tools (generate_html_diagram / diagram_render) run this same pass automatically; call this to lint first or in CI.",
  {
    services: z.array(serviceSchema),
    connections: z.array(connectionSchema),
    groups: z.array(groupSchema).optional(),
    steps: z.array(stepSchema).optional(),
    repair: z.boolean().optional().describe("Compute the auto-repaired IR + receipts (default true). Set false to only report findings against the IR as-is."),
  },
  async ({ services, connections, groups, steps, repair }) => {
    const { report, repaired } = validateDiagram({ services, connections, groups, steps }, { repair: repair !== false });
    const payload = { report, ...(repair !== false ? { repaired } : {}) };
    return { content: [{ type: "text", text: `${formatValidationReport(report)}\n\n${JSON.stringify(payload, null, 2)}` }] };
  }
);

// Architecture delta: render a before → after comparison as ONE interactive
// diagram with a Before/Delta/After toggle. Given two IRs, computeDelta tags every
// service/connection/group as added/removed/changed/unchanged; layout is computed
// once over the union so node positions stay stable as the viewer toggles views.
server.tool(
  "diagram_delta",
  "Render an ARCHITECTURE DELTA — a before→after comparison of two diagram IRs as ONE self-contained interactive HTML. Every service/connection/group is tagged added / removed / changed / unchanged; the viewer gets a Before / Delta / After toggle (added=green, removed=red, changed=amber). Layout is computed once over the union so nodes keep their position as you flip views. Pass the SAME service/connection/group shapes as generate_html_diagram, split into `before` and `after`.",
  {
    title: z.string(),
    subtitle: z.string().optional(),
    outputPath: z.string().describe("Output .html file path"),
    before: z.object({
      services: z.array(serviceSchema),
      connections: z.array(connectionSchema),
      groups: z.array(groupSchema).optional(),
    }).describe("The 'before' state (current architecture)."),
    after: z.object({
      services: z.array(serviceSchema),
      connections: z.array(connectionSchema),
      groups: z.array(groupSchema).optional(),
    }).describe("The 'after' state (proposed / target architecture)."),
    direction: z.enum(["LR", "TB"]).optional(),
    defaultView: z.enum(["before", "delta", "after"]).optional().describe("Which view the diagram opens on (default 'delta')."),
    lang: z.string().optional(),
  },
  async ({ title, subtitle, outputPath, before, after, direction, defaultView, lang }) => {
    const delta = computeDelta(
      { services: before.services, connections: before.connections, groups: before.groups },
      { services: after.services, connections: after.connections, groups: after.groups },
    );
    // Validate + auto-repair the MERGED (union) IR before rendering. delta status
    // is preserved: repair only touches ids/parents/refs, not the delta field.
    const { report, repaired } = validateDiagram({ services: delta.services, connections: delta.connections, groups: delta.groups });
    // Re-attach delta tags onto the repaired items (repair may have re-pointed a
    // few connection ids, but keeps object identity of the fields we set).
    const html = generateHtml(title, subtitle || "", repaired.services, repaired.connections, {
      groups: repaired.groups, direction, lang,
      delta: true, deltaSummary: delta.summary, deltaView: defaultView || "delta",
    });
    writeFileSync(outputPath, html, "utf-8");
    return { content: [{ type: "text", text: `Architecture delta saved: ${outputPath}\n${formatDeltaSummary(delta.summary)}\nOpen in a browser and use the Before / Delta / After toggle.${formatValidationReport(report)}` }] };
  }
);

// Locate the draw.io desktop CLI. It ships under different names/paths per OS;
// returns an invocable command string, or null if not installed.
function findDrawioCli() {
  const candidates = [
    "drawio",
    "/Applications/draw.io.app/Contents/MacOS/draw.io", // macOS app bundle
    "/usr/bin/drawio",
    "/snap/bin/drawio",
  ];
  for (const cmd of candidates) {
    try {
      if (cmd.includes("/")) {
        // Absolute path: just check the file exists (no process spawn).
        if (existsSync(cmd)) return cmd;
      } else {
        // Bare name: resolve on PATH via `which` (a real binary), args as an
        // array so there is no shell to inject into.
        execFileSync("which", [cmd], { stdio: "ignore" });
        return cmd;
      }
    } catch { /* try next */ }
  }
  return null;
}

// Export tool
server.tool(
  "export_diagram",
  "Export a .drawio file (from auto_generate_diagram / generate_diagram) to PNG/SVG/PDF. Requires the draw.io desktop CLI (optional dependency).",
  { inputPath: z.string(), outputPath: z.string(), format: z.enum(["png", "svg", "pdf"]).optional().default("png"), scale: z.number().optional().default(2) },
  async ({ inputPath, outputPath, format, scale }) => {
    if (!existsSync(inputPath)) {
      return { content: [{ type: "text", text: `Input not found: ${inputPath}` }], isError: true };
    }
    const cli = findDrawioCli();
    if (!cli) {
      return { content: [{ type: "text", text:
        "draw.io CLI not found, so this tool can't rasterize the file.\n" +
        "Options:\n" +
        "  - Install it: https://github.com/jgraph/drawio-desktop/releases (or `brew install --cask drawio`), then retry.\n" +
        "  - Or open the .drawio in https://app.diagrams.net and File > Export.\n" +
        "  - For PNG, prefer generate_html_diagram and use the in-browser PNG button (no CLI needed)." }], isError: true };
    }
    try {
      // Build the argument list (no shell string) so paths/format cannot be
      // used for command injection. zod already constrains format/scale.
      const drawioArgs = ["--export", "--format", String(format), "--scale", String(scale), "--output", outputPath, inputPath];
      // Headless export needs a display; Linux servers require xvfb-run.
      const needsXvfb = process.platform === "linux" && !process.env.DISPLAY;
      const [bin, argv] = needsXvfb ? ["xvfb-run", ["-a", cli, ...drawioArgs]] : [cli, drawioArgs];
      execFileSync(bin, argv, { timeout: 60000, stdio: "ignore" });
      if (!existsSync(outputPath)) {
        return { content: [{ type: "text", text: `Export ran but no output was produced at ${outputPath}. On headless Linux, ensure xvfb is installed (apt-get install xvfb).` }], isError: true };
      }
      return { content: [{ type: "text", text: `Exported: ${outputPath}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Export failed: ${e.message}\nIf on a headless Linux host, install xvfb (apt-get install xvfb).` }], isError: true };
    }
  }
);

server.tool(
  "render_diagram_media",
  "Rasterize an interactive diagram HTML (from generate_html_diagram / diagram_render) into publishable assets: a PNG @2x figure, an animated GIF, and/or an animated SVG. GIF has two modes: 'flow' (the dots travelling the edges, one seamless loop) and 'walkthrough' (one animated segment PER guided beat/step, concatenated into a looping tour). The SVG is vector + STILL ANIMATED (the flow-dot SMIL is preserved) — sharp at any size and tiny to serve, but many CMSs incl. the AWS Blog/WordPress BLOCK svg upload, so use SVG for your OWN site/embed and GIF for WordPress. Use this to embed a diagram where JS can't run — blog post, PDF, email, slide. Needs headless Chromium (Playwright) and, for GIF, a full ffmpeg on PATH.",
  {
    htmlPath: z.string().describe("Path to the interactive diagram .html produced by generate_html_diagram or diagram_render."),
    pngPath: z.string().optional().describe("If set, write a static PNG figure here (motion frozen)."),
    gifPath: z.string().optional().describe("If set, write an animated GIF here."),
    svgPath: z.string().optional().describe("If set, write a self-contained ANIMATED SVG here (vector, flow-dot animation preserved). For your own site/embed — NOT the AWS Blog/WordPress, which blocks SVG upload."),
    mode: z.enum(["flow", "walkthrough"]).optional().default("flow").describe("GIF content: 'flow' = one looping segment of the animated data flow; 'walkthrough' = one animated segment per guided beat (requires the HTML to have `steps`), concatenated into a looping tour. PNG/SVG are unaffected."),
    theme: z.enum(["light", "dark"]).optional().default("light").describe("Render theme."),
    width: z.number().int().optional().default(1200).describe("Capture width in px."),
    height: z.number().int().optional().default(675).describe("Capture height in px."),
    scale: z.number().optional().default(2).describe("Device scale factor (PNG @Nx)."),
    period: z.number().optional().default(4).describe("flow mode: GIF loop length in seconds; every edge's flow dot shares this exact period so the loop closes seamlessly. (For the sharpest loop, also pass the SAME value as flowPeriod to generate_html_diagram.)"),
    frames: z.number().int().optional().default(24).describe("flow mode: frames captured across one period (GIF smoothness)."),
    beatDuration: z.number().optional().default(2.5).describe("walkthrough mode: seconds held on each beat."),
    beatFrames: z.number().int().optional().default(15).describe("walkthrough mode: frames captured per beat."),
  },
  async ({ htmlPath, pngPath, gifPath, svgPath, mode, theme, width, height, scale, period, frames, beatDuration, beatFrames }) => {
    if (!pngPath && !gifPath && !svgPath) {
      return { content: [{ type: "text", text: "Nothing to render: set pngPath, gifPath and/or svgPath." }], isError: true };
    }
    try {
      const r = await rasterizeDiagram({ htmlPath, pngPath, gifPath, svgPath, mode, theme, width, height, scale, period, frames, beatDuration, beatFrames });
      const gifDesc = r.gif && (r.mode === "walkthrough"
        ? `GIF: ${r.gif} (walkthrough · ${r.beats || 0} beats × ${beatDuration}s)`
        : `GIF: ${r.gif} (flow · ${period}s loop, ${frames} frames)`);
      const made = [r.png && `PNG: ${r.png}`, gifDesc, r.svg && `SVG: ${r.svg} (animated vector)`].filter(Boolean);
      return { content: [{ type: "text", text: `Rendered:\n  ${made.join("\n  ")}` + (r.warnings.length ? `\n\n${r.warnings.join("\n")}` : "") }] };
    } catch (e) {
      return { content: [{ type: "text", text:
        `Render failed: ${e.message}\n` +
        "Requirements: headless Chromium via Playwright (`npx playwright install chromium`) and, for GIF, a full ffmpeg on PATH (`brew install ffmpeg`)." }], isError: true };
    }
  }
);

// Service configs reference - tells the agent what config fields each AWS service accepts
const SERVICE_CONFIGS = JSON.parse(readFileSync(new URL("./lib/service-configs.json", import.meta.url), "utf-8"));

// Derive a regex seed for the AWS Price List service_code from a display name.
server.tool(
  "list_service_configs",
  "List a service's IaC config fields (CDK/TF properties) — useful when authoring a node's config.iac. For pricing, hand the diagram off (export_diagram_json) to a pricing app such as aws-cost-app-mcp.",
  { service: z.string().optional().describe("Filter by service name (partial match). Omit to list all.") },
  async ({ service }) => {
    if (!service) {
      const names = SERVICE_CONFIGS.map(s => s.service).sort();
      return { content: [{ type: "text", text: "Available services (" + names.length + "):\n" + names.join("\n") + "\n\nConfig schema: { iac: [...], label: \"...\" }" }] };
    }
    const matches = SERVICE_CONFIGS.filter(s => s.service.toLowerCase().includes(service.toLowerCase()));
    if (!matches.length) return { content: [{ type: "text", text: `No config found for "${service}".` }] };
    const result = matches.map(m => ({
      service: m.service,
      iac: m.fields,
    }));
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// Export the diagram's elements as neutral JSON — the machine-readable contract
// for downstream tools/apps (cost estimation, inventory, docs). This server owns
// the diagram; it does not price or deploy. Mirrors the sidecar `.json` that the
// generate_* tools write next to each .html, but extracts it from an existing file.
server.tool(
  "export_diagram_json",
  "Extract the diagram's elements as neutral JSON from a generated .html: { title, subtitle, region, direction, services[], connections[], groups[] }. This is the machine-readable handoff any downstream app consumes (e.g. aws-cost-app-mcp to price it, an inventory or docs generator). Each service carries its display name, role, category, and any authored config (iac/pricing metadata). No pricing or IaC is performed here — this server only draws the diagram and hands off its structure.",
  {
    diagramPath: z.string().describe("Path to the .html diagram file to extract elements from"),
    region: z.string().optional().default("us-east-1").describe("AWS region annotation carried into the payload (e.g. us-east-1, sa-east-1)"),
  },
  async ({ diagramPath, region }) => {
    if (!existsSync(diagramPath)) return { content: [{ type: "text", text: `Error: file not found: ${diagramPath}` }], isError: true };
    const html = readFileSync(diagramPath, "utf-8");
    const m = html.match(/id="arch-data"[^>]*>(.*?)<\/script/);
    if (!m) return { content: [{ type: "text", text: "Error: No arch-data found in file" }], isError: true };
    const data = JSON.parse(m[1]);
    return { content: [{ type: "text", text: JSON.stringify(diagramElementsJson(data, region), null, 2) }] };
  }
);

// IaC handoff: turn a generated diagram into a structured spec + instruction so
// an agent can generate production IaC via the official AWS IaC MCP, instead of
// this server re-implementing infrastructure generation itself.
server.tool(
  "export_iac_json",
  "Extract an Infrastructure-as-Code handoff payload from a generated diagram's services and connections, for the official AWS IaC MCP (awslabs.aws-iac-mcp-server). This server does NOT generate IaC itself; it returns the architecture (resources + dependencies + any per-node config.iac) plus an instruction telling the agent to use the AWS IaC MCP's cdk_best_practices / search_cdk_samples_and_constructs and validate before deploy.",
  {
    diagramPath: z.string().describe("Path to the .html diagram file to extract the architecture from"),
    region: z.string().optional().default("us-east-1").describe("AWS region for the target IaC (e.g. us-east-1, sa-east-1)"),
  },
  async ({ diagramPath, region }) => {
    if (!existsSync(diagramPath)) return { content: [{ type: "text", text: `Error: file not found: ${diagramPath}` }], isError: true };
    const html = readFileSync(diagramPath, "utf-8");
    const m = html.match(/id="arch-data"[^>]*>(.*?)<\/script/);
    if (!m) return { content: [{ type: "text", text: "Error: No arch-data found in file" }], isError: true };
    const data = JSON.parse(m[1]);
    const txt = (v) => typeof v === "string" ? v : (v?.en || v?.pt || (v && Object.values(v)[0]) || undefined);
    const isExternal = (s) => s.external || s.id === "users";
    const resources = (data.services || [])
      .filter(s => !isExternal(s))
      .map(s => ({
        id: s.id,
        service: txt(s.service),
        category: s.category || "general",
        ...(txt(s.role) ? { role: txt(s.role) } : {}),
        config: s.config?.iac || {},
      }));
    if (!resources.length) return { content: [{ type: "text", text: "No resources found in diagram services." }] };
    const extIds = new Set((data.services || []).filter(isExternal).map(s => s.id));
    const dependencies = (data.connections || [])
      .filter(c => !extIds.has(c.source) && !extIds.has(c.target))
      .map(c => ({ from: c.source, to: c.target, ...(c.type ? { type: c.type } : {}), ...(txt(c.label) ? { via: txt(c.label) } : {}) }));
    return { content: [{ type: "text", text: JSON.stringify({
      target: { iac_mcp: "awslabs.aws-iac-mcp-server", region },
      architecture: { name: txt(data.title), region, resources, dependencies },
      instruction:
        "Generate production-ready IaC for this architecture using the AWS IaC MCP (awslabs.aws-iac-mcp-server). That server provides GUIDANCE + VALIDATION only — none of its tools take an architecture graph, so YOU (the agent) translate this payload into a template. Do NOT hand-write resources from scratch. Recommended flow: " +
        "1) call cdk_best_practices() ONCE (it takes no arguments) and follow the guidelines it returns; " +
        "2) for each resource (or integration), formulate a TEXT query for search_cdk_samples_and_constructs(query, language) — e.g. \"aws-lambda.Function\", \"API Gateway AND Lambda\", \"aws-s3.Bucket\" — to get the right constructs/patterns; pass your target `language` (typescript|python|java|csharp|go); " +
        "3) wire resources using the 'dependencies' list — connection 'type' tells you the relationship (network/iam/event/data); " +
        "4) fill required properties not present in each resource's 'config' (credentials, networking, IAM) following best practices; " +
        "5) before deploy: call get_cloudformation_pre_deploy_validation_instructions(), then validate the synthesized/CloudFormation template with validate_cloudformation_template(template_content) and check_cloudformation_template_compliance(template_content). Use troubleshoot_cloudformation_deployment if a deploy fails.",
    }, null, 2) }] };
  }
);

// Shapes reference
server.tool("list_shapes", "List common AWS4 drawio shape names for the .drawio path (auto_generate_diagram/generate_diagram, field `shape`). For the interactive HTML path use service display names + resolve_icon instead.", { category: z.string().optional() },
  async ({ category }) => {
    // Curated per AWS official service categories. Every 48px architecture icon
    // shipped in assets/icons is represented here by its canonical shape key
    // (aliases like `dms`, `iam`, `firehose` also resolve — see shape-icons.json).
    const shapes = {
      compute: ["ec2", "lambda", "fargate", "batch", "lightsail", "lightsail_for_research", "elastic_beanstalk", "outposts", "outposts_family", "outposts_servers", "parallel_computing_service", "parallel_cluster", "ec2_auto_scaling", "auto_scaling", "application_auto_scaling", "app_runner", "ec2_image_builder", "elastic_fabric_adapter", "nitro_enclaves", "bottlerocket", "elastic_vmware_service", "elastic_inference", "serverless_application_repository", "simspace_weaver", "nice_enginframe"],
      containers: ["ecs", "eks", "ecr", "red_hat_openshift", "eks_anywhere", "ecs_anywhere", "eks_cloud", "eks_distro"],
      storage: ["s3", "s3_on_outposts", "elastic_block_store", "elastic_file_system", "fsx", "fsx_ontap", "fsx_lustre", "fsx_openzfs", "fsx_for_wfs", "file_cache", "backup", "storage_gateway", "glacier", "backint_agent"],
      database: ["rds", "aurora", "dynamodb", "elasticache", "neptune", "documentdb_with_mongodb_compatibility", "memorydb_for_redis", "keyspaces", "redshift", "timestream", "qldb", "rds_on_vmware", "oracle_database_at_aws"],
      networking: ["cloudfront", "route_53", "vpc", "elastic_load_balancing", "direct_connect", "global_accelerator", "transit_gateway", "vpc_lattice", "api_gateway", "privatelink", "cloud_map", "client_vpn", "site_to_site_vpn", "cloud_wan", "app_mesh", "local_zones", "wavelength", "private_5g", "telco_network_builder"],
      security: ["cognito", "guardduty", "acm", "private_ca", "secrets_manager", "key_management_service", "waf", "shield", "security_hub", "inspector", "macie", "network_firewall", "iam", "iam_identity_center", "cloudhsm", "firewall_manager", "detective", "audit_manager", "directory_service", "verified_access", "verified_permissions", "signer", "security_incident_response", "payment_cryptography", "artifact", "cloud_directory", "security_lake"],
      integration: ["simple_queue_service", "simple_notification_service", "eventbridge", "step_functions", "express_workflows", "mq", "appsync", "simple_email_service", "appflow", "b2b_data_interchange", "appconfig", "appfabric"],
      analytics: ["athena", "kinesis", "kinesis_data_streams", "kinesis_video_streams", "firehose", "glue", "glue_databrew", "glue_elastic_views", "managed_streaming_for_apache_kafka", "managed_flink", "opensearch_service", "emr", "quicksight", "lake_formation", "datazone", "mwaa", "clean_rooms", "data_exchange", "finspace", "cloudsearch", "data_pipeline", "entity_resolution"],
      ai: ["bedrock", "sagemaker", "sagemaker_ai", "sagemaker_ground_truth", "sagemaker_studio_lab", "amazon_q", "nova", "rekognition", "textract", "transcribe", "polly", "translate", "lex", "comprehend", "kendra", "personalize", "forecast", "fraud_detector", "augmented_ai_a2i", "codeguru", "codewhisperer", "devops_guru", "monitron", "lookout_for_equipment", "lookout_for_metrics", "lookout_for_vision", "panorama", "deep_learning_amis", "deep_learning_containers", "deepcomposer", "deeplens", "deepracer", "neuron", "elastic_transcoder"],
      ml_frameworks: ["apache_mxnet_on_aws", "pytorch_on_aws", "tensorflow_on_aws"],
      healthcare: ["healthlake", "healthimaging", "healthomics", "healthscribe", "comprehend_medical"],
      developer_tools: ["codeartifact", "codebuild", "codecommit", "codedeploy", "codepipeline", "codestar", "codecatalyst", "cdk", "cloud9", "cloudshell", "command_line_interface", "x_ray", "corretto", "tools_and_sdks", "application_composer", "infrastructure_composer", "cloud_control_api"],
      migration: ["dms", "datasync", "migration_hub", "application_migration_service", "application_discovery_service", "migration_evaluator", "elastic_disaster_recovery", "transfer_family", "snowball", "snowball_edge", "snowcone", "mainframe_modernization", "data_transfer_terminal", "transform"],
      management: ["cloudwatch_2", "cloudtrail", "config", "systems_manager", "organizations", "cloudformation", "trusted_advisor", "control_tower", "service_catalog", "resource_access_manager", "well_architected_tool", "resilience_hub", "fault_injection_service", "compute_optimizer", "proton", "chatbot", "health_dashboard", "management_console", "console_mobile_application", "launch_wizard", "license_manager", "resource_explorer", "distro_for_opentelemetry", "user_notifications", "service_management_connector", "managed_services", "application_recovery_controller", "opsworks", "prometheus", "grafana"],
      cost: ["cost_explorer", "budgets", "cost_and_usage_report", "billing_conductor", "savings_plans", "reserved_instance_reporting", "application_cost_profiler"],
      iot: ["iot_core", "iot_greengrass", "iot_analytics", "iot_button", "iot_1_click", "iot_device_defender", "iot_device_management", "iot_events", "iot_expresslink", "iot_fleetwise", "iot_sitewise", "iot_twinmaker", "iot_roborunner", "freertos"],
      media: ["elemental_appliances_and_software", "elemental_conductor", "elemental_delta", "elemental_link", "elemental_live", "elemental_mediaconnect", "elemental_mediaconvert", "elemental_medialive", "elemental_mediapackage", "elemental_mediastore", "elemental_mediatailor", "elemental_server", "interactive_video_service", "nimble_studio", "deadline_cloud", "thinkbox_deadline", "thinkbox_frost", "thinkbox_krakatoa", "thinkbox_sequoia", "thinkbox_stoke", "thinkbox_xmesh"],
      business_apps: ["connect", "pinpoint", "pinpoint_apis", "chime", "chime_sdk", "workmail", "workdocs", "workdocs_sdk", "wickr", "supply_chain", "end_user_messaging", "alexa_for_business", "app_studio"],
      end_user_computing: ["workspaces", "workspaces_thin_client", "appstream_2", "nice_dcv", "dcv"],
      front_end: ["amplify", "device_farm", "location_service"],
      game: ["gamelift", "gamelift_servers", "gamelift_streams", "gamesparks", "gamekit", "open_3d_engine"],
      robotics: ["robomaker"],
      satellite: ["ground_station"],
      quantum: ["braket"],
      blockchain: ["managed_blockchain"],
      customer_enablement: ["activate", "iq", "marketplace", "professional_services", "support", "training_certification", "repost", "repost_private"],
    };
    return { content: [{ type: "text", text: JSON.stringify(category ? { [category]: shapes[category] } : shapes, null, 2) }] };
  }
);

// Icon resolution — agent can omit `icon` (auto-resolved at generation), but may
// also query this to confirm or to discover available service icons.
server.tool(
  "resolve_icon",
  "Resolve an AWS service display name to its icon filename. Omit `service` to list all mapped services. The generator auto-resolves icons from service names, so passing `icon` in services is optional.",
  { service: z.string().optional().describe("Service display name, e.g. 'Amazon RDS', 'AWS Lambda'") },
  async ({ service }) => {
    if (!service) {
      const names = Object.keys(SERVICE_ICONS).sort();
      return { content: [{ type: "text", text: `Mapped services (${names.length}):\n${names.join("\n")}` }] };
    }
    const file = iconForService(service);
    return { content: [{ type: "text", text: file
      ? `${service} -> ${file}`
      : `No icon mapping for "${service}". It will fall back to a category-colored initial. Pass an explicit icon (e.g. 'aws-icons/<name>.svg') if needed.` }] };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Incremental builder — assemble a diagram in stages instead of one big call.
//
// Flow: diagram_create → (add_services / add_connections / add_groups / add_steps)*
//       → diagram_render. Each draft lives in memory keyed by an id; render writes
//       the HTML and clears the draft. All the piece shapes match the one-shot
//       generate_html_diagram tool exactly, so the mental model is identical.
// ─────────────────────────────────────────────────────────────────────────────
const drafts = new Map(); // id -> { title, subtitle, direction, services, connections, groups, steps, stepZoom, stepFocus }
let draftSeq = 0;
const getDraft = (id) => {
  const d = drafts.get(id);
  if (!d) throw new Error(`Unknown draftId "${id}". Call diagram_create first.`);
  return d;
};
const draftSummary = (id, d) => `draft ${id}: ${d.services.length} service(s), ${d.connections.length} connection(s), ${d.groups.length} group(s), ${d.steps.length} step(s)${d.tabs?.length ? `, ${d.tabs.length} tab(s)` : ""}`;

server.tool("diagram_create",
  "Start an incremental diagram draft. Returns a draftId; feed it to diagram_add_services / diagram_add_connections / diagram_add_groups / diagram_add_steps in any order, then diagram_render to write the HTML. Use this when building a diagram in stages; use generate_html_diagram for a single-shot build.",
  { title: z.string(), subtitle: z.string().optional(), direction: z.enum(["LR", "TB"]).optional(), stepZoom: z.boolean().optional(), stepFocus: z.boolean().optional(), startStep: z.number().int().optional().describe("Beat to open on: -1 (default) overview first; 0+ opens zoomed on that beat."), startCardScale: z.number().int().min(0).max(3).optional().describe("Initial walkthrough-card text size (0–3, default 0); 1–3 opens a larger card."), flowDots: z.boolean().optional().describe("Animate a dot travelling along each connection. Default true. Set false for a static, print-friendly look."), lang: z.string().optional(), languages: z.array(z.string()).optional().describe("Offer a toolbar language switch; ANY language works (en, es, ja, …). When >1, author text fields may be per-language maps { en, ja, … }."), uiStrings: z.record(z.record(z.string())).optional().describe("Localize the UI chrome (tooltips/modal headings) for languages beyond built-in en/pt/es: { <uiKey>: { <lang>: text } }. Keys: iac, pricing, architecture, restart, play, pause, theme, collapse, expand, language."), langLabels: z.record(z.string()).optional().describe("Toolbar switch label per language, e.g. { ja: '日本語' }."), stage: stageSchema.optional().describe("PRESENTER MODE (opt-in): bridge the walkthrough to a real shell — `cmd` button next to `copiar`, `auto` in the step rail, embedded browser terminal. Needs a loopback control server; see generate_html_diagram.") },
  async ({ title, subtitle, direction, stepZoom, stepFocus, startStep, startCardScale, flowDots, lang, languages, uiStrings, langLabels, stage }) => {
    const id = `d${++draftSeq}`;
    drafts.set(id, { title, subtitle: subtitle || "", direction: direction || "LR", services: [], connections: [], groups: [], steps: [], stepZoom: !!stepZoom, stepFocus: !!stepFocus, startStep, startCardScale, flowDots, lang, languages, uiStrings, langLabels, stage });
    return { content: [{ type: "text", text: `Created ${id}. Add pieces with diagram_add_* (draftId="${id}"), then diagram_render.` }] };
  }
);

server.tool("diagram_add_services",
  "Append services (nodes) to a draft. Same service shape as generate_html_diagram: { id, service, shape, category, icon?, role?, parentId?, subnet?, config? }.",
  { draftId: z.string(), services: z.array(serviceSchema) },
  async ({ draftId, services }) => {
    const d = getDraft(draftId); d.services.push(...services);
    return { content: [{ type: "text", text: `Added ${services.length} service(s). ${draftSummary(draftId, d)}` }] };
  }
);

server.tool("diagram_add_connections",
  "Append connections (edges) to a draft. Same shape as generate_html_diagram: { id, source, target, label?, type?, dashed? }.",
  { draftId: z.string(), connections: z.array(connectionSchema) },
  async ({ draftId, connections }) => {
    const d = getDraft(draftId); d.connections.push(...connections);
    return { content: [{ type: "text", text: `Added ${connections.length} connection(s). ${draftSummary(draftId, d)}` }] };
  }
);

server.tool("diagram_add_groups",
  "Append container groups to a draft. Same shape as generate_html_diagram: { id, label, parent?, variant?, icon? }.",
  { draftId: z.string(), groups: z.array(groupSchema) },
  async ({ draftId, groups }) => {
    const d = getDraft(draftId); d.groups.push(...groups);
    return { content: [{ type: "text", text: `Added ${groups.length} group(s). ${draftSummary(draftId, d)}` }] };
  }
);

server.tool("diagram_add_steps",
  "Append guided-walkthrough beats to a draft. Same step shape as generate_html_diagram (tone/color/cardSide/nodes/edges/groups/eyebrow/icon/title/body/bullets/chips/sections…).",
  { draftId: z.string(), steps: z.array(stepSchema) },
  async ({ draftId, steps }) => {
    const d = getDraft(draftId); d.steps.push(...steps);
    return { content: [{ type: "text", text: `Added ${steps.length} step(s). ${draftSummary(draftId, d)}` }] };
  }
);

server.tool("diagram_add_sequence",
  "Attach an animated UML SEQUENCE view to a draft (participants + ordered messages, alt/opt/loop fragments, notes). The rendered HTML becomes a two-tab document: Architecture + Sequence. Call once per sequence tab; pass `tabLabel` to name the tab.",
  { draftId: z.string(), sequence: sequenceSchema, tabLabel: z.union([z.string(), z.record(z.string())]).optional(), tabId: z.string().optional() },
  async ({ draftId, sequence, tabLabel, tabId }) => {
    const d = getDraft(draftId);
    d.tabs = d.tabs || [{ id: "arch", kind: "architecture" }];
    const id = tabId || `seq${d.tabs.filter(t => t.kind === "sequence").length + 1}`;
    d.tabs.push({ id, kind: "sequence", ...(tabLabel ? { label: tabLabel } : {}), sequence });
    return { content: [{ type: "text", text: `Added sequence tab "${id}": ${sequence.participants?.length || 0} participant(s), ${sequence.events?.length || 0} event(s). ${draftSummary(draftId, d)}` }] };
  }
);

server.tool("diagram_add_doc_tab",
  "Attach a prose tab (readable sections: title + body + bullets + code) to a draft — the written companion to the architecture and sequence tabs in the same self-contained file.",
  { draftId: z.string(), tab: tabSchema.omit({ kind: true, sequence: true }).extend({ id: z.string().optional() }) },
  async ({ draftId, tab }) => {
    const d = getDraft(draftId);
    d.tabs = d.tabs || [{ id: "arch", kind: "architecture" }];
    const id = tab.id || `doc${d.tabs.filter(t => t.kind === "doc").length + 1}`;
    d.tabs.push({ ...tab, id, kind: "doc" });
    return { content: [{ type: "text", text: `Added doc tab "${id}" (${tab.sections?.length || 0} section(s)). ${draftSummary(draftId, d)}` }] };
  }
);

server.tool("diagram_render",
  "Render an incremental draft to a self-contained HTML file, then discard the draft. Pass keep:true to keep the draft for further edits.",
  { draftId: z.string(), outputPath: z.string(), keep: z.boolean().optional() },
  async ({ draftId, outputPath, keep }) => {
    const d = getDraft(draftId);
    const { report, repaired } = validateDiagram({ services: d.services, connections: d.connections, groups: d.groups, steps: d.steps });
    const html = generateHtml(d.title, d.subtitle, repaired.services, repaired.connections, { groups: repaired.groups, direction: d.direction, steps: repaired.steps, stepZoom: d.stepZoom, stepFocus: d.stepFocus, startStep: d.startStep, startCardScale: d.startCardScale, flowDots: d.flowDots, lang: d.lang, languages: d.languages, uiStrings: d.uiStrings, langLabels: d.langLabels, tabs: d.tabs, stage: d.stage });
    writeFileSync(outputPath, html, "utf-8");
    const jsonPath = writeSidecarJson(outputPath, d.title, d.subtitle, repaired.services, repaired.connections, { groups: repaired.groups, direction: d.direction });
    if (!keep) drafts.delete(draftId);
    return { content: [{ type: "text", text: `Rendered ${draftSummary(draftId, d)} → ${outputPath}${jsonPath ? `\nElements JSON: ${jsonPath}` : ""}${keep ? " (draft kept)" : " (draft cleared)"}${formatValidationReport(report)}` }] };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SEQUENCE diagrams — animated, self-contained HTML player (lifelines + ordered
// messages + alt/opt/loop fragments), stepped through with a synced narration
// panel. Complements the architecture path: use this for "what happens over time"
// (a provisioning flow, an auth handshake, a saga) rather than a topology.
//
// Flow mirrors the architecture builders: generate_sequence_diagram (one-shot) OR
// sequence_create → sequence_add_participants / _messages / _notes / _fragments →
// sequence_render. Lifeline header icons reuse the SAME resolver/inliner.
// ─────────────────────────────────────────────────────────────────────────────
function seqIconWarning(participants) {
  const unresolved = seqIconResolutionReport(participants);
  if (!unresolved.length) return "";
  const lines = unresolved.map(u => `  • "${u.id}" (service: ${JSON.stringify(u.service)})`).join("\n");
  return `\n\n⚠️ ${unresolved.length} participant(s) asked for an icon but none resolved (header shows a plain label):\n${lines}\n`
    + `Fix: give a canonical AWS service name (call resolve_icon) or an explicit \`icon\` (e.g. "tech-icons/vault.svg").`;
}

server.tool(
  "generate_sequence_diagram",
  "Generate an ANIMATED, self-contained HTML sequence diagram in ONE call (no CDN, opens under file://). Full UML vocabulary: lifelines with execution/activation bars, sync (filled) / async (open) / reply (dashed) arrowheads, «create» & destroy(✕) messages, found/lost boundary dots, stick-figure actors, participant stereotypes, aggregation boxes (groups), and combined fragments (alt/opt/loop/par/break/critical/ref/neg/assert). Plays step by step: each message draws its arrow, active participants light up, and a synced side panel shows title/description/proof/code. For staged assembly use sequence_create + sequence_add_* + sequence_render. Lifeline icons auto-resolve from each participant's `service` (or explicit `icon`, e.g. tech-icons/vault.svg) — call resolve_icon to confirm.",
  {
    title: z.string(),
    subtitle: z.string().optional(),
    outputPath: z.string().describe("Output .html file path"),
    participants: z.array(participantSchema).describe("Lifeline columns (actors + systems), left→right in the order given."),
    events: z.array(eventSchema).describe("Ordered interactions. Message: { kind:'message', id, from, to, label?, arrow?('sync'|'async'|'reply'), create?, destroy?, found?, lost?, activate?, deactivate?, badge?, title?, flow?, desc?, proof?, code? } or note: { kind:'note', id, over:[ids], label, ... }. Reveal order = array order."),
    fragments: z.array(fragmentSchema).optional().describe("Combined-fragment boxes (alt/opt/loop/par/break/critical/ref/neg/assert) around a contiguous event range (anchored by startId/endId; dividers for the 'else' of an alt)."),
    groups: z.array(seqGroupSchema).optional().describe("Aggregation containers (PlantUML `box`) grouping contiguous participant columns, e.g. { label:'AWS Control Plane', participants:[ids], tone? }."),
    autoActivate: z.boolean().optional().describe("Auto-derive activation bars (default true). Ignored if any message sets activate/deactivate; set false to hide bars."),
    autoplay: z.boolean().optional().describe("Start playing on load (default false — opens on step 1)."),
    stepMs: z.number().int().optional().describe("Default ms per step when playing (default 1300)."),
  },
  async ({ title, subtitle, outputPath, participants, events, fragments, groups, autoActivate, autoplay, stepMs }) => {
    const html = generateSequenceHtml({ title, subtitle, participants, events, fragments, groups, autoActivate, autoplay, stepMs });
    writeFileSync(outputPath, html, "utf-8");
    const frag = fragments?.length ? `, ${fragments.length} fragment(s)` : "";
    const grp = groups?.length ? `, ${groups.length} group(s)` : "";
    return { content: [{ type: "text", text: `Animated sequence diagram saved: ${outputPath}\n${participants.length} participant(s), ${events.length} step(s)${frag}${grp}\nOpen in a browser and press Play (or ← → / space).${seqIconWarning(participants)}` }] };
  }
);

// Incremental sequence builder — assemble in stages, mirroring diagram_create.
const seqDrafts = new Map();
let seqSeq = 0;
const getSeqDraft = (id) => {
  const d = seqDrafts.get(id);
  if (!d) throw new Error(`Unknown sequenceId "${id}". Call sequence_create first.`);
  return d;
};
const seqSummary = (id, d) => `sequence ${id}: ${d.participants.length} participant(s), ${d.events.length} step(s), ${d.fragments.length} fragment(s), ${d.groups.length} group(s)`;

server.tool("sequence_create",
  "Start an incremental sequence-diagram draft. Returns a sequenceId; feed it to sequence_add_participants / sequence_add_messages / sequence_add_notes / sequence_add_fragments / sequence_add_groups in any order, then sequence_render to write the animated HTML.",
  { title: z.string(), subtitle: z.string().optional(), autoActivate: z.boolean().optional().describe("Auto-derive activation bars (default true)."), autoplay: z.boolean().optional(), stepMs: z.number().int().optional() },
  async ({ title, subtitle, autoActivate, autoplay, stepMs }) => {
    const id = `s${++seqSeq}`;
    seqDrafts.set(id, { title, subtitle: subtitle || "", participants: [], events: [], fragments: [], groups: [], autoActivate: autoActivate !== false, autoplay: !!autoplay, stepMs });
    return { content: [{ type: "text", text: `Created ${id}. Add pieces with sequence_add_* (sequenceId="${id}"), then sequence_render.` }] };
  }
);

server.tool("sequence_add_participants",
  "Append lifeline participants to a sequence draft. Shape: { id, label, sub?, service?, icon?, actor? }. Order = left→right column order.",
  { sequenceId: z.string(), participants: z.array(participantSchema) },
  async ({ sequenceId, participants }) => {
    const d = getSeqDraft(sequenceId); d.participants.push(...participants);
    return { content: [{ type: "text", text: `Added ${participants.length} participant(s). ${seqSummary(sequenceId, d)}` }] };
  }
);

server.tool("sequence_add_messages",
  "Append message steps to a sequence draft (reveal order = call order across all add calls). Shape: { id, from, to, label?, arrow?('sync'|'async'|'reply'), create?, destroy?, found?, lost?, activate?, deactivate?, tone?, badge?, title?, flow?, desc?, proof?, code?, codeLabel? }. arrow: sync=filled head, async=open head, reply=dashed open head.",
  { sequenceId: z.string(), messages: z.array(messageSchema) },
  async ({ sequenceId, messages }) => {
    const d = getSeqDraft(sequenceId); d.events.push(...messages.map(m => ({ kind: "message", ...m })));
    return { content: [{ type: "text", text: `Added ${messages.length} message(s). ${seqSummary(sequenceId, d)}` }] };
  }
);

server.tool("sequence_add_notes",
  "Append note bands (phase markers / asides) to a sequence draft, interleaved in reveal order. Shape: { id, over:[participantIds], label, tone?, badge?, title?, flow?, desc?, proof? }.",
  { sequenceId: z.string(), notes: z.array(noteSchema) },
  async ({ sequenceId, notes }) => {
    const d = getSeqDraft(sequenceId); d.events.push(...notes.map(n => ({ kind: "note", ...n })));
    return { content: [{ type: "text", text: `Added ${notes.length} note(s). ${seqSummary(sequenceId, d)}` }] };
  }
);

server.tool("sequence_add_fragments",
  "Append alt/opt/loop/par fragment boxes to a sequence draft. Shape: { kind, label, startId, endId, dividers?:[{beforeId,label}] } — anchored by event ids already added.",
  { sequenceId: z.string(), fragments: z.array(fragmentSchema) },
  async ({ sequenceId, fragments }) => {
    const d = getSeqDraft(sequenceId); d.fragments.push(...fragments);
    return { content: [{ type: "text", text: `Added ${fragments.length} fragment(s). ${seqSummary(sequenceId, d)}` }] };
  }
);

server.tool("sequence_add_groups",
  "Append aggregation container boxes (PlantUML `box`) to a sequence draft — group contiguous participant columns under a labeled boundary. Shape: { label, participants:[ids], tone? }.",
  { sequenceId: z.string(), groups: z.array(seqGroupSchema) },
  async ({ sequenceId, groups }) => {
    const d = getSeqDraft(sequenceId); d.groups.push(...groups);
    return { content: [{ type: "text", text: `Added ${groups.length} group(s). ${seqSummary(sequenceId, d)}` }] };
  }
);

server.tool("sequence_render",
  "Render an incremental sequence draft to a self-contained animated HTML file, then discard the draft. Pass keep:true to keep it for further edits.",
  { sequenceId: z.string(), outputPath: z.string(), keep: z.boolean().optional() },
  async ({ sequenceId, outputPath, keep }) => {
    const d = getSeqDraft(sequenceId);
    const html = generateSequenceHtml(d);
    writeFileSync(outputPath, html, "utf-8");
    if (!keep) seqDrafts.delete(sequenceId);
    return { content: [{ type: "text", text: `Rendered ${seqSummary(sequenceId, d)} → ${outputPath}${keep ? " (draft kept)" : " (draft cleared)"}${seqIconWarning(d.participants)}` }] };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// FLOW diagrams — workflow, data-flow (DFD), and lifecycle/state. All three are
// directed node+edge graphs with an optional stepped walkthrough, so they share
// ONE self-contained SVG player (flow-template.html) + ONE layered auto-layout,
// parameterized by `type`. Complements the architecture (topology) and sequence
// (time-ordered) paths: use FLOW for "how the process/state moves". Node icons
// reuse the SAME resolver/inliner. Each type gets its own one-shot
// generate_<type>_diagram + incremental <type>_create / _add_nodes / _add_edges /
// _add_steps / _render path (registered by the factory below).
// ─────────────────────────────────────────────────────────────────────────────
function flowIconWarning(nodes) {
  const unresolved = flowIconResolutionReport(nodes);
  if (!unresolved.length) return "";
  const lines = unresolved.map(u => `  • "${u.id}" (service: ${JSON.stringify(u.service)})`).join("\n");
  return `\n\n⚠️ ${unresolved.length} node(s) asked for an icon but none resolved (node renders as a plain shape):\n${lines}\n`
    + `Fix: give a canonical AWS service name (call resolve_icon) or an explicit \`icon\` (e.g. "tech-icons/vault.svg").`;
}

// Per-type wording so each tool's description reads naturally (the engine and
// schemas are identical; only defaults + vocabulary differ).
const FLOW_TYPES = {
  workflow: {
    noun: "workflow / flowchart",
    kinds: "start · task · decision (diamond branch) · subprocess · wait · end",
    edgeHint: "Label edges with the branch guard (e.g. '[approved]', '[else]').",
  },
  dataflow: {
    noun: "data-flow diagram (DFD)",
    kinds: "external (source/sink) · process · datastore (cylinder)",
    edgeHint: "Each edge IS a data flow — label it with the data that moves (e.g. 'order.json').",
  },
  lifecycle: {
    noun: "lifecycle / state-machine diagram",
    kinds: "initial (●) · state · choice (diamond) · final (◎)",
    edgeHint: "Label edges with the triggering event/transition (e.g. 'onApprove'); self-transitions and loop-backs are drawn as returns.",
  },
};

const flowDrafts = new Map();
let flowSeq = 0;
const getFlowDraft = (id) => {
  const d = flowDrafts.get(id);
  if (!d) throw new Error(`Unknown flowId "${id}". Call <type>_create first.`);
  return d;
};
const flowSummary = (id, d) => `${d.type} ${id}: ${d.nodes.length} node(s), ${d.edges.length} edge(s), ${d.steps.length} step(s)`;

function registerFlowType(type) {
  const t = FLOW_TYPES[type];
  server.tool(
    `generate_${type}_diagram`,
    `Generate a self-contained, interactive HTML ${t.noun} in ONE call (no CDN, opens under file://). Directed graph with a layered auto-layout, typed node shapes (${t.kinds}), labeled edges, and an optional stepped walkthrough with a synced narration panel (title/desc/proof/code) — same look and feel as the architecture & sequence players (dark/light, zoom/pan, search '/', SVG/PNG export). ${t.edgeHint} For staged assembly use ${type}_create + ${type}_add_nodes/_add_edges/_add_steps + ${type}_render. Node icons auto-resolve from each node's \`service\` (or explicit \`icon\`) — call resolve_icon to confirm.`,
    {
      title: z.string(),
      subtitle: z.string().optional(),
      outputPath: z.string().describe("Output .html file path"),
      direction: z.enum(["TB", "LR"]).optional().describe("Flow direction: TB = top→bottom (default), LR = left→right."),
      nodes: z.array(flowNodeSchema).describe(`Graph nodes. Kinds for ${type}: ${t.kinds}.`),
      edges: z.array(flowEdgeSchema).describe(`Directed edges (from→to). ${t.edgeHint}`),
      steps: z.array(flowStepSchema).optional().describe("Optional guided walkthrough — each beat lights up its nodes/edges and drives the narration panel. Omit for a static diagram."),
      autoplay: z.boolean().optional().describe("Start playing on load when steps exist (default false)."),
      stepMs: z.number().int().optional().describe("Default ms per step when playing (default 1500)."),
    },
    async ({ title, subtitle, outputPath, direction, nodes, edges, steps, autoplay, stepMs }) => {
      const html = generateFlowHtml({ type, title, subtitle, direction, nodes, edges, steps, autoplay, stepMs });
      writeFileSync(outputPath, html, "utf-8");
      const st = steps?.length ? `, ${steps.length} step(s)` : " (static)";
      return { content: [{ type: "text", text: `${t.noun} saved: ${outputPath}\n${nodes.length} node(s), ${edges.length} edge(s)${st}\nOpen in a browser${steps?.length ? " and press Play (or ← → / space)." : "."}${flowIconWarning(nodes)}` }] };
    }
  );

  server.tool(`${type}_create`,
    `Start an incremental ${t.noun} draft. Returns a flowId; feed it to ${type}_add_nodes / ${type}_add_edges / ${type}_add_steps in any order, then ${type}_render to write the self-contained HTML.`,
    { title: z.string(), subtitle: z.string().optional(), direction: z.enum(["TB", "LR"]).optional(), autoplay: z.boolean().optional(), stepMs: z.number().int().optional() },
    async ({ title, subtitle, direction, autoplay, stepMs }) => {
      const id = `f${++flowSeq}`;
      flowDrafts.set(id, { type, title, subtitle: subtitle || "", direction: direction || "TB", nodes: [], edges: [], steps: [], autoplay: !!autoplay, stepMs });
      return { content: [{ type: "text", text: `Created ${id} (${type}). Add pieces with ${type}_add_* (flowId="${id}"), then ${type}_render.` }] };
    }
  );

  server.tool(`${type}_add_nodes`,
    `Append nodes to a ${type} draft. Shape: { id, label, sub?, kind?, service?, icon?, tone? }. Kinds for ${type}: ${t.kinds}.`,
    { flowId: z.string(), nodes: z.array(flowNodeSchema) },
    async ({ flowId, nodes }) => {
      const d = getFlowDraft(flowId); d.nodes.push(...nodes);
      return { content: [{ type: "text", text: `Added ${nodes.length} node(s). ${flowSummary(flowId, d)}` }] };
    }
  );

  server.tool(`${type}_add_edges`,
    `Append directed edges to a ${type} draft. Shape: { id, from, to, label?, kind?('flow'|'branch'|'back'|'async'), dashed?, tone? }. ${t.edgeHint}`,
    { flowId: z.string(), edges: z.array(flowEdgeSchema) },
    async ({ flowId, edges }) => {
      const d = getFlowDraft(flowId); d.edges.push(...edges);
      return { content: [{ type: "text", text: `Added ${edges.length} edge(s). ${flowSummary(flowId, d)}` }] };
    }
  );

  server.tool(`${type}_add_steps`,
    `Append walkthrough beats to a ${type} draft (reveal order = call order). Shape: { nodes?:[ids], edges?:[ids], title?, flow?, desc?, proof?, code?, codeLabel?, tone?, badge? }.`,
    { flowId: z.string(), steps: z.array(flowStepSchema) },
    async ({ flowId, steps }) => {
      const d = getFlowDraft(flowId); d.steps.push(...steps);
      return { content: [{ type: "text", text: `Added ${steps.length} step(s). ${flowSummary(flowId, d)}` }] };
    }
  );

  server.tool(`${type}_render`,
    `Render an incremental ${type} draft to a self-contained HTML file, then discard the draft. Pass keep:true to keep it for further edits.`,
    { flowId: z.string(), outputPath: z.string(), keep: z.boolean().optional() },
    async ({ flowId, outputPath, keep }) => {
      const d = getFlowDraft(flowId);
      const html = generateFlowHtml(d);
      writeFileSync(outputPath, html, "utf-8");
      if (!keep) flowDrafts.delete(flowId);
      return { content: [{ type: "text", text: `Rendered ${flowSummary(flowId, d)} → ${outputPath}${keep ? " (draft kept)" : " (draft cleared)"}${flowIconWarning(d.nodes)}` }] };
    }
  );
}
["workflow", "dataflow", "lifecycle"].forEach(registerFlowType);

// First-run hint: if no icons are available, tell the user how to add them.
// stderr only — never stdout — so the stdio MCP protocol stays clean.
try {
  const base = process.env.AWS_DIAGRAM_ICON_ROOT || new URL("./assets", import.meta.url).pathname;
  const iconDir = join(base, "icons");
  const hasIcons = existsSync(iconDir) && readdirSync(iconDir).some(f => f.endsWith(".png"));
  if (!hasIcons) {
    console.error(
      "[aws-architecture-diagram] AWS Architecture Icons not found — diagrams will render " +
      "category-colored initials until you add them.\n" +
      "  Fix: download the Asset Package from https://aws.amazon.com/architecture/icons/ then run\n" +
      "       npx --package sample-architecture-diagram-mcp-server fetch-icons <Asset-Package.zip>\n" +
      "  or set AWS_DIAGRAM_ICON_ROOT to a folder containing icons/ (icons are not bundled — AWS Terms of Use)."
    );
  }
} catch { /* best-effort hint only */ }

const transport = new StdioServerTransport();
await server.connect(transport);
