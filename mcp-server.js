import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { computeLayout } from "./lib/layout.js";
import { generateDrawio } from "./lib/drawio-xml.js";
import { generateHtml, SERVICE_ICONS, iconForService } from "./lib/html-generator.js";

const server = new McpServer({ name: "aws-architecture-diagram-mcp", version: "2.0.0" });

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

    // Auto-compute layout
    const layout = computeLayout({ services: allServices, connections, region });

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

// Interactive animated HTML diagram (an interactive canvas)
server.tool(
  "generate_html_diagram",
  "Generate an interactive animated HTML diagram with React Flow. Nodes are draggable, edges animate data flow direction. Self-contained single HTML file.",
  {
    title: z.string(),
    subtitle: z.string().optional(),
    outputPath: z.string().describe("Output .html file path"),
    services: z.array(z.object({
      id: z.string(),
      service: z.string().describe("Canonical AWS service name used as the node label. Use the official full name on first use (e.g. 'Amazon Simple Storage Service', 'Amazon Elastic Compute Cloud') per the AWS Offering Names Wiki; short forms ('Amazon S3', 'Amazon EC2') are fine when space is tight. Every node must be labeled."),
      shape: z.string(),
      icon: z.string().optional().describe("Icon reference inlined as base64 into the HTML: bare name resolves under icons/ (e.g. 'Arch_Amazon-RDS_48.png'), prefixed path used as-is (e.g. 'aws-icons/user.svg', 'tech-icons/whatsapp.svg')"),
      category: z.enum(["compute", "storage", "database", "networking", "security", "integration", "analytics", "ai", "management", "general"]),
      label: z.string().optional(),
      subnet: z.enum(["public", "private"]).optional(),
      external: z.boolean().optional(),
      isApi: z.boolean().optional(),
      config: z.object({
        iac: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe("IaC properties (CDK/CFN/TF): cpu, memory, engine, instanceClass, etc."),
        pricing: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe("Calculator properties: vCPU-hours, GB-hours, requests/month, storage GB, etc."),
        label: z.string().optional().describe("Short display label shown under the node icon"),
      }).optional().describe("Service configuration for IaC generation and cost estimation"),
    })),
    connections: z.array(z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      label: z.string().optional().describe("Step description shown in step modal"),
      dashed: z.boolean().optional(),
    })),
  },
  async ({ title, subtitle, outputPath, services, connections }) => {
    const html = generateHtml(title, subtitle || "", services, connections, []);
    writeFileSync(outputPath, html, "utf-8");
    return { content: [{ type: "text", text: `Interactive diagram saved: ${outputPath}\nOpen in browser for animated data flow visualization.` }] };
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
      const probe = cmd.includes("/") ? `test -x "${cmd}"` : `command -v ${cmd}`;
      execSync(probe, { stdio: "ignore" });
      return cmd;
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
      // Headless export needs a display; Linux servers require xvfb-run.
      const needsXvfb = process.platform === "linux" && !process.env.DISPLAY;
      const base = `"${cli}" --export --format ${format} --scale ${scale} --output "${outputPath}" "${inputPath}"`;
      execSync(needsXvfb ? `xvfb-run -a ${base}` : base, { timeout: 60000, stdio: "ignore" });
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
import { readFileSync as _readFileSync } from "fs";
const SERVICE_CONFIGS = JSON.parse(_readFileSync(new URL("./lib/service-configs.json", import.meta.url), "utf-8"));

// Pricing field hints for common services (maps to aws-calculator-mcp field keys)
// Maps IaC service names to aws-calculator-mcp service keys.
// Agent uses get_service_fields(calculatorKey) in calculator MCP for full pricing field details.
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

server.tool(
  "list_service_configs",
  "List service configuration in two scopes: 'iac' (CDK/TF properties) and 'pricing' (calculator service key for aws-calculator-mcp). Use get_service_fields(calculatorKey) in calculator MCP for full pricing fields.",
  { service: z.string().optional().describe("Filter by service name (partial match). Omit to list all.") },
  async ({ service }) => {
    if (!service) {
      const names = SERVICE_CONFIGS.map(s => s.service).sort();
      return { content: [{ type: "text", text: "Available services (" + names.length + "):\n" + names.join("\n") + "\n\nConfig schema: { iac: {...}, pricing: {...}, label: \"...\" }\nFor pricing fields: use get_service_fields(calculatorKey) in aws-calculator-mcp" }] };
    }
    const matches = SERVICE_CONFIGS.filter(s => s.service.toLowerCase().includes(service.toLowerCase()));
    if (!matches.length) return { content: [{ type: "text", text: `No config found for "${service}".` }] };
    const result = matches.map(m => ({
      service: m.service,
      iac: m.fields,
      calculatorKey: CALCULATOR_MAP[m.service] || null,
      note: CALCULATOR_MAP[m.service] ? `Use get_service_fields("${CALCULATOR_MAP[m.service]}") in aws-calculator-mcp for pricing fields` : "No calculator mapping available",
    }));
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// Export pricing data for aws-calculator-mcp integration
server.tool(
  "export_pricing_json",
  "Extract pricing configuration from a diagram's services. Returns JSON ready to be used with aws-calculator-mcp's create_estimate + add_service tools. The agent should: 1) call create_estimate, 2) call add_service for each entry returned.",
  { diagramPath: z.string().describe("Path to the .html diagram file to extract pricing from") },
  async ({ diagramPath }) => {
    const html = readFileSync(diagramPath, "utf-8");
    const m = html.match(/id="arch-data"[^>]*>(.*?)<\/script/);
    if (!m) return { content: [{ type: "text", text: "Error: No arch-data found in file" }] };
    const data = JSON.parse(m[1]);
    const services = (data.services || [])
      .filter(s => s.config?.pricing || CALCULATOR_MAP[s.service])
      .map(s => ({
        service: s.service,
        calculatorKey: CALCULATOR_MAP[s.service] || null,
        pricing: s.config?.pricing || {},
        description: s.config?.label || s.service,
      }));
    if (!services.length) return { content: [{ type: "text", text: "No pricing data found in diagram services." }] };
    return { content: [{ type: "text", text: JSON.stringify({ title: data.title, services, instruction: "Use create_estimate in aws-calculator-mcp, then add_service for each entry using calculatorKey as the service and pricing values as config." }, null, 2) }] };
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

const transport = new StdioServerTransport();
await server.connect(transport);
