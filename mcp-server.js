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
import { generateHtml, SERVICE_ICONS, iconForService } from "./lib/html-generator.js";

const server = new McpServer({ name: "sample-aws-architecture-diagram-mcp", version: "2.0.0" });

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

// A bullet is a plain string OR a styled object. Reused for step + section bullets.
const bulletSchema = z.union([
  z.string(),
  z.object({
    text: z.string().describe("Bullet body text."),
    strong: z.string().optional().describe("Bold lead rendered before the text (e.g. a term being defined). If omitted, a 'Lead — rest' / 'Lead: rest' prefix in `text` is auto-bolded."),
    color: z.string().optional().describe("Hex colour for this bullet's marker + lead (overrides the card tone)."),
    icon: z.string().optional().describe("Icon reference used as the bullet marker (replaces the dot)."),
    glyph: z.string().optional().describe("Single-char marker instead of the dot: '✓' (green), '✕' (red), '≈'/'△' (amber), '→', etc."),
  }),
]);

// Reusable piece schemas — shared by the one-shot generate_html_diagram tool and
// the incremental diagram_add_* builder tools so both speak the exact same shape.
const toneEnum = z.enum(["accent", "info", "success", "warn", "danger", "neutral", "survive", "degrade", "severed"]);

const serviceSchema = z.object({
  id: z.string(),
  service: z.string().describe("Canonical AWS service name used as the node label. Use the official full name on first use (e.g. 'Amazon Simple Storage Service', 'Amazon Elastic Compute Cloud') per the AWS Offering Names Wiki; short forms ('Amazon S3', 'Amazon EC2') are fine when space is tight. Every node must be labeled."),
  shape: z.string(),
  icon: z.string().optional().describe("Icon reference inlined as base64 into the HTML: bare name resolves under icons/ (e.g. 'Arch_Amazon-RDS_48.png'), prefixed path used as-is (e.g. 'aws-icons/user.svg', 'tech-icons/whatsapp.svg')"),
  category: z.enum(["compute", "storage", "database", "networking", "security", "integration", "analytics", "ai", "management", "general"]),
  label: z.string().optional(),
  role: z.string().optional().describe("What this component DOES (the WHY). Shown as the description when the user CLICKS the node to open its detail modal. E.g. 'Authenticates API consumers via JWT', 'Stores order data with single-digit-ms reads'."),
  parentId: z.string().optional().describe("ID of the group this service belongs to (from the top-level `groups`). Enables arbitrary nesting: multi-VPC, AZs, accounts, on-prem. Takes precedence over `subnet`."),
  subnet: z.enum(["public", "private"]).optional().describe("Shortcut for single-VPC diagrams: auto-nests under AWS Cloud → VPC → public/private subnet when `groups` is not provided."),
  external: z.boolean().optional(),
  isApi: z.boolean().optional(),
  // Per-node detail modal content. Everything here is editable per service and
  // shown when the user clicks the node: role (above) + these key/value sections.
  config: z.object({
    iac: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe("Configuration rows shown under 'Configuração (IaC)' in the node modal: e.g. { instanceClass: 'db.m7g.xlarge', engine: 'PostgreSQL 15.2', storage: '45 GB gp3' }."),
    pricing: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe("Rows shown under 'Custo / dimensionamento' in the node modal: e.g. { replicas: 2, 'vCPU': 4, 'RAM': '16 GB', 'est. mensal': 'USD 320' }."),
    label: z.string().optional().describe("Short display label shown under the node icon (in the diagram, not the modal)."),
  }).optional().describe("Per-node detail-modal content (clicking the node opens it) + IaC/pricing handoff. Freely editable per service."),
});

const connectionSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string().optional().describe("Short label rendered as a pill on the edge (e.g. a port/protocol like '5432' or 'HTTPS 443')."),
  type: z.enum(["network", "iam", "event", "data"]).optional().describe("Connection semantics, styled distinctly: network (solid), iam (dashed, auth/permission), event (dotted, async/pub-sub), data (solid, read/write)."),
  dashed: z.boolean().optional(),
});

const groupSchema = z.object({
  id: z.string().describe("Group id referenced by services' parentId and by child groups' parent."),
  label: z.string().describe("Display label, e.g. 'VPC A', 'us-east-1a', 'Prod Account'."),
  parent: z.string().optional().describe("Parent group id for nesting (arbitrary depth)."),
  variant: z.enum(["aws-cloud", "region", "vpc", "public-subnet", "private-subnet", "availability-zone", "account", "organization", "auto-scaling-group", "group", "corporate-data-center", "on-premises"]).optional().describe("Container type → official AWS group icon + color."),
  icon: z.string().optional().describe("Override the container's header glyph with a specific icon reference (e.g. 'Res_Amazon-Elastic-Kubernetes-Service_EKS-on-Outposts_48.png' to badge an 'EKS Cluster' group). Pass 'none' to show the label only (logical sub-groups like a Kubernetes namespace)."),
});

const stepSchema = z.object({
  tone: toneEnum.optional().describe("Named accent for this beat's highlight: accent (orange, default), info (blue), success (green), warn (amber), danger (red), neutral (slate). Resilience aliases survive/degrade/severed still work."),
  color: z.string().optional().describe("Arbitrary hex accent (e.g. '#8C4FFF') overriding `tone` for this beat's card + highlights."),
  cardSide: z.enum(["left", "right", "top", "full"]).optional().describe("Where the overlay card sits: right (default), left, top (flows above the canvas), or full (centered full-page modal with a dimmed backdrop — good for an intro/overview beat)."),
  nodes: z.array(z.string()).optional().describe("Service ids highlighted (tinted) in this beat."),
  edges: z.array(z.string()).optional().describe("Connection ids highlighted in this beat."),
  groups: z.array(z.string()).optional().describe("Group ids tinted (border+glow) in this beat."),
  tones: z.record(toneEnum).optional().describe("Per-node tone override: { nodeId: tone } — use when a beat mixes tones (e.g. one node danger, rest accent)."),
  edgeTones: z.record(toneEnum).optional().describe("Per-edge tone override: { edgeId: tone }."),
  groupTones: z.record(toneEnum).optional().describe("Per-group tone override: { groupId: tone }."),
  zoom: z.array(z.string()).optional().describe("Node/group ids to frame the camera on this beat (requires stepZoom). Empty array = fit the whole diagram."),
  maxZoom: z.number().optional().describe("Max zoom level when framing this beat (default 2.2). Lower it (e.g. 1.4) to keep more context visible."),
  eyebrow: z.string().optional().describe("Small uppercase label above the card title, e.g. '1 · Ingress'."),
  icon: z.string().optional().describe("Icon reference shown next to the card title (same resolution as service icon)."),
  title: z.string().optional().describe("Card heading for this beat."),
  body: z.string().optional().describe("Card description paragraph."),
  badge: z.union([z.string(), z.literal(false)]).optional().describe("Override the tone badge label; false hides it (recommended for architecture walkthroughs — the eyebrow already labels the beat)."),
  bullets: z.array(bulletSchema).optional().describe("Bullet list under the body. Each item is a plain string, or a styled object {text, strong?, color?, icon?, glyph?} for richer bullets."),
  chips: z.array(z.object({
    label: z.string(),
    ok: z.union([z.boolean(), z.literal("warn")]).optional().describe("Status glyph: true=green ✓, false=red ✗, 'warn'=amber ≈, omit=neutral dot."),
    icon: z.string().optional().describe("Icon reference shown inside the chip."),
  })).optional().describe("Status chips row at the bottom of the card."),
  sections: z.array(z.object({
    title: z.string().optional().describe("Section heading (uppercase accent), e.g. 'Data', 'Integrations'."),
    body: z.string().optional().describe("Section paragraph."),
    bullets: z.array(bulletSchema).optional().describe("Section bullet list (same string-or-styled-object format as step bullets)."),
  })).optional().describe("Rich documentation sections (title + body + bullets each). Mainly for a full-page overview beat (cardSide:'full') that reads like a system README — scrolls if long."),
});

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
    steps: z.array(stepSchema).optional().describe("Guided walkthrough beats. Arrow keys / the dock's play button step through them; each shows an overlay card and can tint+zoom a subset of the diagram."),
    stepZoom: z.boolean().optional().describe("When steps are present, glide the camera onto each beat's `zoom` (or `nodes`). Default off."),
    stepFocus: z.boolean().optional().describe("When steps are present, hide non-active nodes each beat to isolate it. Default off (dim instead of hide)."),
  },
  async ({ title, subtitle, outputPath, services, connections, groups, direction, steps, stepZoom, stepFocus }) => {
    const html = generateHtml(title, subtitle || "", services, connections, { groups, direction, steps, stepZoom, stepFocus });
    writeFileSync(outputPath, html, "utf-8");
    const extras = [groups?.length ? `${groups.length} group(s)` : null, steps?.length ? `${steps.length}-step walkthrough` : null].filter(Boolean);
    return { content: [{ type: "text", text: `Interactive diagram saved: ${outputPath}${extras.length ? "\nIncluded: " + extras.join(", ") : ""}\nOpen in browser for animated data flow visualization.` }] };
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
  "Export a .drawio file to PNG/SVG/PDF. Requires the draw.io desktop CLI (optional dependency). Note: the generate_html_diagram diagram already exports PNG and .drawio from the browser without any CLI.",
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
    const shapes = {
      compute: ["ec2", "lambda", "fargate", "batch", "lightsail", "elastic_beanstalk", "outposts", "parallel_computing_service"],
      containers: ["ecs", "eks", "fargate", "ecr", "red_hat_openshift"],
      storage: ["s3", "elastic_block_store", "elastic_file_system", "fsx", "backup", "storage_gateway"],
      database: ["rds", "aurora", "dynamodb", "elasticache", "neptune", "documentdb_with_mongodb_compatibility", "memorydb_for_redis", "keyspaces", "redshift"],
      networking: ["cloudfront", "route_53", "vpc", "elastic_load_balancing", "direct_connect", "global_accelerator", "transit_gateway", "vpc_lattice"],
      security: ["cognito", "guardduty", "secrets_manager", "key_management_service", "waf", "shield", "security_hub", "inspector", "macie", "network_firewall"],
      integration: ["simple_queue_service", "simple_notification_service", "eventbridge", "step_functions", "mq", "appsync", "simple_email_service"],
      analytics: ["athena", "kinesis", "glue", "managed_streaming_for_apache_kafka", "opensearch_service", "emr"],
      ai: ["bedrock", "sagemaker", "rekognition", "textract", "transcribe", "polly", "translate", "lex", "comprehend"],
      management: ["cloudwatch_2", "cloudtrail", "config", "systems_manager", "organizations", "cloudformation", "trusted_advisor"],
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
  { title: z.string(), subtitle: z.string().optional(), direction: z.enum(["LR", "TB"]).optional(), stepZoom: z.boolean().optional(), stepFocus: z.boolean().optional() },
  async ({ title, subtitle, direction, stepZoom, stepFocus }) => {
    const id = `d${++draftSeq}`;
    drafts.set(id, { title, subtitle: subtitle || "", direction: direction || "LR", services: [], connections: [], groups: [], steps: [], stepZoom: !!stepZoom, stepFocus: !!stepFocus });
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
    const html = generateHtml(d.title, d.subtitle, d.services, d.connections, { groups: d.groups, direction: d.direction, steps: d.steps, stepZoom: d.stepZoom, stepFocus: d.stepFocus });
    writeFileSync(outputPath, html, "utf-8");
    if (!keep) drafts.delete(draftId);
    return { content: [{ type: "text", text: `Rendered ${draftSummary(draftId, d)} → ${outputPath}${keep ? " (draft kept)" : " (draft cleared)"}` }] };
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
