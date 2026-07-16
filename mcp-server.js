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
import { generateHtml, SERVICE_ICONS, iconForService, iconResolutionReport } from "./lib/html-generator.js";

const server = new McpServer({ name: "sample-aws-architecture-diagram-mcp", version: "2.0.0" });

// Build a model-facing note listing nodes that resolved to NO icon (bare initial).
// Returned in the tool result so the model can fix them in a follow-up call —
// icons are resolved from the `service` display name, so the fix is either a
// canonical AWS name (query resolve_icon) or an explicit `icon` reference.
function iconWarning(services) {
  const unresolved = iconResolutionReport(services);
  if (!unresolved.length) return "";
  const lines = unresolved.map(u => `  • "${u.id}" (service: ${JSON.stringify(u.service)})`).join("\n");
  return `\n\n⚠️ ${unresolved.length} node(s) had NO icon and render as a plain initial:\n${lines}\n`
    + `To fix: give each a canonical AWS service name (call resolve_icon to confirm, e.g. "Amazon SageMaker", "NAT Gateway") `
    + `or pass an explicit \`icon\` (e.g. "aws-icons/kiro.svg"). Keep your human-readable text in \`label\`/\`role\`, not \`service\`, `
    + `since \`service\` is what drives icon resolution.`;
}

// v2.0: Full auto-layout — just pass services + connections, positions computed automatically
server.tool(
  "auto_generate_diagram",
  "Generate a fully positioned AWS architecture diagram. Automatically computes layout, group sizing, badge positions, and edge routing. No manual x/y needed.",
  {
    title: z.string(),
    subtitle: z.string().optional(),
    outputPath: z.string().describe("Absolute path for .drawio output"),
    region: z.string().optional().default("sa-east-1"),
    services: z.array(z.object({
      id: z.string(),
      service: z.string().describe("Display name"),
      shape: z.string().describe("AWS4 shape: lambda, fargate, rds, s3, etc."),
      category: z.enum(["compute", "storage", "database", "networking", "security", "integration", "analytics", "ai", "management", "general"]),
      label: z.string().optional().describe("Italic sub-label"),
      subnet: z.enum(["public", "private"]).optional().describe("Which subnet (omit = outside VPC, edge service)"),
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
    includeUsers: z.boolean().optional().default(true),
  },
  async ({ title, subtitle, outputPath, region, services, connections, includeUsers }) => {
    // Add users node if requested
    const allServices = includeUsers ? [{ id: "users", service: "Users", shape: "users", category: "general" }, ...services] : services;

    // Auto-compute layout (ELK layered engine; async)
    const layout = await computeLayout({ services: allServices, connections, region });

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
import { serviceSchema, connectionSchema, groupSchema, stepSchema } from "./lib/schemas.js";

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
    uiStrings: z.record(z.record(z.string())).optional().describe("Localize the built-in UI chrome (toolbar tooltips + node-modal headings) for languages beyond the built-in en/pt/es — keyed by UI key then language, e.g. { cost: { ja: '料金見積もり' }, restart: { ja: 'ウォークスルーを再開' } }. Keys: iac, pricing, architecture, restart, play, pause, theme, collapse, expand, language, cost. Omitted (key,lang) falls back to the built-in table, then English."),
    langLabels: z.record(z.string()).optional().describe("Display label per language for its toolbar switch button, e.g. { en: 'EN', ja: '日本語', 'zh-CN': '中文' }. Defaults to a built-in for en/pt/es/fr/de, else the uppercased code."),
    steps: z.array(stepSchema).optional().describe("Guided walkthrough beats. Arrow keys / the dock's play button step through them; each shows an overlay card and can tint+zoom a subset of the diagram."),
    stepZoom: z.boolean().optional().describe("When steps are present, glide the camera onto each beat's `zoom` (or `nodes`). Default off."),
    stepFocus: z.boolean().optional().describe("When steps are present, hide non-active nodes each beat to isolate it. Default off (dim instead of hide)."),
    flowDots: z.boolean().optional().describe("Animate a dot travelling along each connection to convey flow direction. Default true. Set false for a static, print-friendly look (arrowheads only, no motion)."),
    collapsible: z.boolean().optional().describe("Show a fold toggle (▸/▾) on every group header so the viewer can collapse/expand containers (d3-zoomable-treemap style); collapsing a group hides its children, shrinks it to a small box, and re-runs the layout. Default true."),
    defaultCollapsed: z.array(z.string()).optional().describe("Group ids that start COLLAPSED on load — good for a dense diagram whose overview should read clean, letting the viewer expand only what they need (e.g. ['vpcdados'])."),
    costUrl: z.string().optional().describe("If set, the toolbar dock shows a 'Cost estimate' button that opens this URL in a new tab (e.g. an AWS Pricing Calculator estimate)."),
    costLabel: z.string().optional().describe("Label for the cost button (default: localized 'Cost estimate')."),
  },
  async ({ title, subtitle, outputPath, services, connections, groups, direction, steps, stepZoom, stepFocus, lang, languages, uiStrings, langLabels, flowDots, collapsible, defaultCollapsed, costUrl, costLabel }) => {
    const html = generateHtml(title, subtitle || "", services, connections, { groups, direction, steps, stepZoom, stepFocus, lang, languages, uiStrings, langLabels, flowDots, collapsible, defaultCollapsed, costUrl, costLabel });
    writeFileSync(outputPath, html, "utf-8");
    const extras = [groups?.length ? `${groups.length} group(s)` : null, steps?.length ? `${steps.length}-step walkthrough` : null].filter(Boolean);
    return { content: [{ type: "text", text: `Interactive diagram saved: ${outputPath}${extras.length ? "\nIncluded: " + extras.join(", ") : ""}\nOpen in browser for animated data flow visualization.${iconWarning(services)}` }] };
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

// Service configs reference - tells the agent what config fields each AWS service accepts
const SERVICE_CONFIGS = JSON.parse(readFileSync(new URL("./lib/service-configs.json", import.meta.url), "utf-8"));

// Maps IaC/display service names to AWS Pricing Calculator MCP service keys
// (sample-aws-pricing-calculator-mcp). The agent calls add_service(calculatorKey)
// there — no AWS credentials needed. Also used as the "priceable services" set so
// export_pricing_json surfaces services even without explicit pricing config.
const CALCULATOR_MAP = {
  // AI/ML
  "Amazon Bedrock": "amazonBedrock", "Amazon SageMaker AI": "amazonSageMaker", "Amazon SageMaker": "amazonSageMaker",
  "Amazon Kendra": "amazonKendra", "Amazon Lex": "amazonLex", "Amazon Polly": "amazonPolly",
  "Amazon Rekognition": "amazonRekognition", "Amazon Textract": "amazonTextract", "Amazon Transcribe": "amazonTranscribe",
  "Amazon Translate": "amazonTranslate", "Amazon Comprehend": "amazonComprehend", "Amazon Personalize": "amazonPersonalize",
  "Amazon Q": "amazonQ",
  // Analytics
  "Amazon Athena": "amazonAthena", "AWS Glue": "aWSGlue", "Amazon EMR": "amazonEMR",
  "Amazon MSK": "amazonMSK", "Amazon Managed Streaming for Apache Kafka": "amazonMSK",
  "Amazon OpenSearch Service": "amazonOpenSearchService", "Amazon QuickSight": "amazonQuickSight",
  "Amazon Data Firehose": "amazonKinesisDataFirehose", "AWS Lake Formation": "aWSLakeFormation",
  // Compute
  "Amazon EC2": "ec2Enhancement", "AWS Lambda": "aWSLambda", "Amazon ECS": "awsFargate",
  "Amazon EKS": "amazonEKS", "AWS Fargate": "awsFargate", "AWS Batch": "aWSBatch",
  "Amazon Lightsail": "amazonLightsail", "AWS App Runner": "aWSAppRunner",
  "Amazon ECR": "amazonECR", "Amazon Elastic Container Registry": "amazonECR",
  // Database
  "Amazon RDS": "amazonRDS", "Amazon Aurora": "amazonAurora", "Amazon DynamoDB": "amazonDynamoDB",
  "Amazon Redshift": "amazonRedshift", "Amazon Neptune": "amazonNeptune", "Amazon DocumentDB": "amazonDocumentDB",
  "Amazon ElastiCache": "amazonElastiCache", "Amazon Keyspaces": "amazonKeyspaces",
  "Amazon Timestream": "amazonTimestream", "Amazon MemoryDB": "amazonMemoryDBForRedis",
  "Amazon QLDB": "amazonQLDB", "Amazon Quantum Ledger Database": "amazonQLDB",
  // Integration
  "Amazon SQS": "amazonSQS", "Amazon Simple Queue Service": "amazonSQS",
  "Amazon SNS": "amazonSNS", "Amazon Simple Notification Service": "amazonSNS",
  "Amazon EventBridge": "amazonEventBridge", "EventBridge": "amazonEventBridge",
  "AWS Step Functions": "aWSStepFunctions", "Step Functions": "aWSStepFunctions",
  "Amazon MQ": "amazonMQ", "Amazon Simple Email Service": "amazonSES",
  // Networking
  "Amazon CloudFront": "amazonCloudFront", "CloudFront": "amazonCloudFront",
  "Amazon Route 53": "amazonRoute53", "Route 53": "amazonRoute53",
  "Elastic Load Balancing": "elasticLoadBalancing", "ELB": "elasticLoadBalancing",
  "Amazon API Gateway": "amazonApiGateway", "API Gateway": "amazonApiGateway",
  "NAT Gateway": "amazonVPC", "Amazon VPC": "amazonVPC",
  "AWS Direct Connect": "aWSDirectConnect", "AWS Transit Gateway": "aWSTransitGateway",
  "AWS Global Accelerator": "aWSGlobalAccelerator",
  "AWS Site-to-Site VPN": "aWSVPN", "AWS Client VPN": "aWSClientVPN",
  // Security
  "Amazon Cognito": "amazonCognito", "Cognito": "amazonCognito",
  "AWS WAF": "aWSWAF", "Amazon GuardDuty": "amazonGuardDuty", "Amazon Inspector": "amazonInspector",
  "AWS Secrets Manager": "aWSSecretsManager", "AWS KMS": "aWSKeyManagementService",
  "AWS Key Management Service": "aWSKeyManagementService", "AWS Certificate Manager": "aWSCertificateManager",
  "AWS Shield": "aWSShield", "Amazon Macie": "amazonMacie", "AWS Security Hub": "aWSSecurityHub",
  // Storage
  "Amazon S3": "amazonS3Standard", "Amazon EFS": "amazonEFS", "Amazon Elastic File System": "amazonEFS",
  "Amazon EBS": "amazonEBS", "Amazon Elastic Block Store": "amazonEBS", "Amazon FSx": "amazonFSx",
  "AWS Backup": "aWSBackup", "AWS Storage Gateway": "aWSStorageGateway",
  "Amazon S3 Glacier": "amazonS3GlacierFlexibleRetrieval", "Amazon Simple Storage Service Glacier": "amazonS3GlacierFlexibleRetrieval",
  // Management
  "Amazon CloudWatch": "amazonCloudWatch", "CloudWatch": "amazonCloudWatch",
  "AWS CloudTrail": "aWSCloudTrail", "AWS Config": "aWSConfig",
  "Amazon Kinesis": "amazonKinesisDataStreams",
  // Developer
  "AWS CodeBuild": "aWSCodeBuild", "AWS CodePipeline": "aWSCodePipeline",
  // Other
  "AWS Amplify": "aWSAmplify", "AWS AppSync": "aWSAppSync", "AWS DataSync": "aWSDataSync",
  "AWS Transfer Family": "aWSTransferFamily", "AWS Database Migration Service": "aWSDatabaseMigrationService",
  "Amazon Managed Grafana": "amazonManagedGrafana", "Amazon Managed Service for Prometheus": "amazonManagedServiceForPrometheus",
  // New (14 validated active services)
  "AWS Network Firewall": "aWSNetworkFirewall", "Amazon Detective": "amazonDetective",
  "Amazon Security Lake": "amazonSecurityLake", "Amazon Verified Permissions": "amazonVerifiedPermissions",
  "AWS Verified Access": "aWSVerifiedAccess", "AWS Application Migration Service": "aWSApplicationMigrationService",
  "AWS IoT Core": "aWSIoTCore", "Amazon WorkSpaces": "amazonWorkSpaces",
  "AWS Elemental MediaConvert": "aWSElementalMediaConvert", "Amazon DataZone": "amazonDataZone",
  "Amazon Location Service": "amazonLocationService", "Amazon Braket": "amazonBraket",
  "AWS CodeArtifact": "aWSCodeArtifact", "AWS Firewall Manager": "aWSFirewallManager",
  // Additional active services
  "Amazon Connect": "amazonConnect", "Amazon Pinpoint": "amazonPinpoint",
  "AWS IoT Greengrass": "aWSIoTGreengrass", "Amazon IVS": "amazonIVS",
  "AWS Outposts": "aWSOutposts", "Amazon GameLift": "amazonGameLift",
  "Amazon FinSpace": "amazonFinSpace", "AWS Clean Rooms": "aWSCleanRooms",
  "AWS Glue DataBrew": "aWSGlueDataBrew", "Amazon CloudSearch": "amazonCloudSearch",
  "AWS AppConfig": "aWSAppConfig", "AWS RoboMaker": "aWSRoboMaker",
  "AWS Ground Station": "aWSGroundStation", "AWS Mainframe Modernization": "aWSMainframeModernization",
  "Amazon Managed Blockchain": "amazonManagedBlockchain", "Amazon Entity Resolution": "amazonEntityResolution",
  "AWS Resilience Hub": "aWSResilienceHub",
  // Batch 3
  "Amazon MWAA": "amazonMWAA", "AWS CloudHSM": "aWSCloudHSM",
  "AWS Elemental MediaLive": "aWSElementalMediaLive", "AWS Elemental MediaPackage": "aWSElementalMediaPackage",
  "AWS Elemental MediaTailor": "aWSElementalMediaTailor", "Amazon Bedrock AgentCore": "amazonBedrockAgentCore",
  "AWS B2B Data Interchange": "aWSB2BDataInterchange", "AWS Payment Cryptography": "aWSPaymentCryptography",
  "Amazon Chime SDK": "amazonChimeSDK", "Amazon Route 53 Resolver": "amazonRoute53Resolver",
  "AWS Network Manager": "aWSNetworkManager", "Amazon Data Lifecycle Manager": "amazonDLM",
  "AWS RAM": "aWSRAM", "AWS Audit Manager": "aWSAuditManager",
  "Amazon AppStream 2.0": "amazonAppStream", "AWS Parallel Computing Service": "aWSParallelComputingService",
  "AWS Cloud WAN": "aWSCloudWAN",
};

// Derive a regex seed for the AWS Price List service_code from a display name.
server.tool(
  "list_service_configs",
  "List service configuration in two scopes: 'iac' (CDK/TF properties) and a calculator service key for the AWS Pricing Calculator MCP (sample-aws-pricing-calculator-mcp). Use add_service(calculatorKey) — or search_services by display name — in the calculator MCP to price it.",
  { service: z.string().optional().describe("Filter by service name (partial match). Omit to list all.") },
  async ({ service }) => {
    if (!service) {
      const names = SERVICE_CONFIGS.map(s => s.service).sort();
      return { content: [{ type: "text", text: "Available services (" + names.length + "):\n" + names.join("\n") + "\n\nConfig schema: { iac: [...], calculatorKey: \"...\", label: \"...\" }\nFor pricing: use the AWS Pricing Calculator MCP — add_service(calculatorKey) or search_services by display name." }] };
    }
    const matches = SERVICE_CONFIGS.filter(s => s.service.toLowerCase().includes(service.toLowerCase()));
    if (!matches.length) return { content: [{ type: "text", text: `No config found for "${service}".` }] };
    const result = matches.map(m => ({
      service: m.service,
      iac: m.fields,
      calculatorKey: CALCULATOR_MAP[m.service] || null,
      note: CALCULATOR_MAP[m.service]
        ? `In the AWS Pricing Calculator MCP: add_service("${CALCULATOR_MAP[m.service]}", config) to price it.`
        : "No calculator key mapped — use search_services by display name in the calculator MCP.",
    }));
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// Export pricing data for the AWS Pricing Calculator MCP (sample-aws-pricing-calculator-mcp).
// Handoff only — this server prices nothing itself; the agent drives create_estimate /
// add_service in the calculator MCP, which needs no AWS credentials.
server.tool(
  "export_pricing_json",
  "Extract a pricing handoff payload from a diagram's services for the AWS Pricing Calculator MCP (sample-aws-pricing-calculator-mcp). This server does NOT price anything itself; it returns per-service config ready for the calculator, which needs NO AWS credentials. The agent should, in the calculator MCP: 1) create_estimate, 2) add_service for each entry (calculatorKey as the service, or the display name; pricing values as config), 3) build_estimate / export_estimate.",
  {
    diagramPath: z.string().describe("Path to the .html diagram file to extract pricing from"),
    region: z.string().optional().default("us-east-1").describe("AWS region applied to each estimate line (e.g. us-east-1, sa-east-1)"),
  },
  async ({ diagramPath, region }) => {
    if (!existsSync(diagramPath)) return { content: [{ type: "text", text: `Error: file not found: ${diagramPath}` }], isError: true };
    const html = readFileSync(diagramPath, "utf-8");
    const m = html.match(/id="arch-data"[^>]*>(.*?)<\/script/);
    if (!m) return { content: [{ type: "text", text: "Error: No arch-data found in file" }], isError: true };
    const data = JSON.parse(m[1]);
    const services = (data.services || [])
      .filter(s => s.config?.pricing || CALCULATOR_MAP[s.service])
      .map(s => ({
        service: s.service,
        calculatorKey: CALCULATOR_MAP[s.service] || null,
        config: { region, ...(s.config?.pricing || {}) },
        description: s.config?.label || s.service,
      }));
    if (!services.length) return { content: [{ type: "text", text: "No pricing data found in diagram services." }] };
    return { content: [{ type: "text", text: JSON.stringify({
      title: data.title,
      region,
      services,
      instruction: "Use the AWS Pricing Calculator MCP (sample-aws-pricing-calculator-mcp — no AWS credentials required). 1) create_estimate(name=title); 2) for each service call add_service using calculatorKey as the service (or search_services by display name if calculatorKey is null), passing config; 3) build_estimate then export_estimate for the shareable URL and totals.",
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
const draftSummary = (id, d) => `draft ${id}: ${d.services.length} service(s), ${d.connections.length} connection(s), ${d.groups.length} group(s), ${d.steps.length} step(s)`;

server.tool("diagram_create",
  "Start an incremental diagram draft. Returns a draftId; feed it to diagram_add_services / diagram_add_connections / diagram_add_groups / diagram_add_steps in any order, then diagram_render to write the HTML. Use this when building a diagram in stages; use generate_html_diagram for a single-shot build.",
  { title: z.string(), subtitle: z.string().optional(), direction: z.enum(["LR", "TB"]).optional(), stepZoom: z.boolean().optional(), stepFocus: z.boolean().optional(), flowDots: z.boolean().optional().describe("Animate a dot travelling along each connection. Default true. Set false for a static, print-friendly look."), lang: z.string().optional(), languages: z.array(z.string()).optional().describe("Offer a toolbar language switch; ANY language works (en, es, ja, …). When >1, author text fields may be per-language maps { en, ja, … }."), uiStrings: z.record(z.record(z.string())).optional().describe("Localize the UI chrome (tooltips/modal headings) for languages beyond built-in en/pt/es: { <uiKey>: { <lang>: text } }. Keys: iac, pricing, architecture, restart, play, pause, theme, collapse, expand, language, cost."), langLabels: z.record(z.string()).optional().describe("Toolbar switch label per language, e.g. { ja: '日本語' }."), costUrl: z.string().optional().describe("If set, the toolbar shows a 'Cost estimate' button opening this URL (e.g. AWS Pricing Calculator)."), costLabel: z.string().optional().describe("Label for the cost button.") },
  async ({ title, subtitle, direction, stepZoom, stepFocus, flowDots, lang, languages, uiStrings, langLabels, costUrl, costLabel }) => {
    const id = `d${++draftSeq}`;
    drafts.set(id, { title, subtitle: subtitle || "", direction: direction || "LR", services: [], connections: [], groups: [], steps: [], stepZoom: !!stepZoom, stepFocus: !!stepFocus, flowDots, lang, languages, uiStrings, langLabels, costUrl, costLabel });
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

server.tool("diagram_render",
  "Render an incremental draft to a self-contained HTML file, then discard the draft. Pass keep:true to keep the draft for further edits.",
  { draftId: z.string(), outputPath: z.string(), keep: z.boolean().optional() },
  async ({ draftId, outputPath, keep }) => {
    const d = getDraft(draftId);
    const html = generateHtml(d.title, d.subtitle, d.services, d.connections, { groups: d.groups, direction: d.direction, steps: d.steps, stepZoom: d.stepZoom, stepFocus: d.stepFocus, flowDots: d.flowDots, lang: d.lang, languages: d.languages, uiStrings: d.uiStrings, langLabels: d.langLabels, costUrl: d.costUrl, costLabel: d.costLabel });
    writeFileSync(outputPath, html, "utf-8");
    if (!keep) drafts.delete(draftId);
    return { content: [{ type: "text", text: `Rendered ${draftSummary(draftId, d)} → ${outputPath}${keep ? " (draft kept)" : " (draft cleared)"}${iconWarning(d.services)}` }] };
  }
);

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
      "       npx --package sample-aws-architecture-diagram-mcp fetch-icons <Asset-Package.zip>\n" +
      "  or set AWS_DIAGRAM_ICON_ROOT to a folder containing icons/ (icons are not bundled — AWS Terms of Use)."
    );
  }
} catch { /* best-effort hint only */ }

const transport = new StdioServerTransport();
await server.connect(transport);
