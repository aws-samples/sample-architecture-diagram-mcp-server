// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Reference data and handoff: service configs, the elements / IaC JSON of a
// generated diagram, draw.io shapes, icon lookup and the icon install.
import { z } from "zod";
import type { Application } from "#application/index.ts";
import { failure, text, tool } from "#adapters/inbound/mcp/tool.ts";
import type { ToolDef } from "#adapters/inbound/mcp/tool.ts";

// The IaC handoff: this server does NOT generate IaC; the agent does, with the
// official AWS IaC MCP's guidance and validation tools.
const IAC_INSTRUCTION =
  "Generate production-ready IaC for this architecture using the AWS IaC MCP (awslabs.aws-iac-mcp-server). That server provides GUIDANCE + VALIDATION only — none of its tools take an architecture graph, so YOU (the agent) translate this payload into a template. Do NOT hand-write resources from scratch. Recommended flow: " +
  "1) call cdk_best_practices() ONCE (it takes no arguments) and follow the guidelines it returns; " +
  "2) for each resource (or integration), formulate a TEXT query for search_cdk_samples_and_constructs(query, language) — e.g. \"aws-lambda.Function\", \"API Gateway AND Lambda\", \"aws-s3.Bucket\" — to get the right constructs/patterns; pass your target `language` (typescript|python|java|csharp|go); " +
  "3) wire resources using the 'dependencies' list — connection 'type' tells you the relationship (network/iam/event/data); " +
  "4) fill required properties not present in each resource's 'config' (credentials, networking, IAM) following best practices; " +
  "5) before deploy: call get_cloudformation_pre_deploy_validation_instructions(), then validate the synthesized/CloudFormation template with validate_cloudformation_template(template_content) and check_cloudformation_template_compliance(template_content). Use troubleshoot_cloudformation_deployment if a deploy fails.";


export function catalogTools(app: Application): ToolDef[] {
  return [
    tool("list_service_configs",
      "List a service's IaC config fields (CDK/TF properties) — useful when authoring a node's config.iac. For pricing, hand the diagram off (export_diagram_json) to a pricing app such as aws-cost-app-mcp.",
      { service: z.string().optional().describe("Filter by service name (partial match). Omit to list all.") },
      ({ service }) => {
    if (!service) {
      const names = app.catalog.serviceNames();
      return text("Available services (" + names.length + "):\n" + names.join("\n") + "\n\nConfig schema: { iac: [...], label: \"...\" }");
    }
    const matches = app.catalog.serviceConfigs(service);
    if (!matches.length) return text(`No config found for "${service}".`);
    return text(JSON.stringify(matches.map(m => ({ service: m.service, iac: m.fields })), null, 2));
  }),
    tool("export_diagram_json",
      "Extract the diagram's elements as neutral JSON from a generated .html: { title, subtitle, region, direction, services[], connections[], groups[] }. This is the machine-readable handoff any downstream app consumes (e.g. aws-cost-app-mcp to price it, an inventory or docs generator). Each service carries its display name, role, category, and any authored config (iac/pricing metadata). No pricing or IaC is performed here — this server only draws the diagram and hands off its structure.",
      {
    diagramPath: z.string().describe("Path to the .html diagram file to extract elements from"),
    region: z.string().optional().default("us-east-1").describe("AWS region annotation carried into the payload (e.g. us-east-1, sa-east-1)"),
  },
      ({ diagramPath, region }) => {
    const r = app.handoff.readArchData(diagramPath);
    if (!r.ok) return failure(r.error === "not-found" ? `Error: file not found: ${diagramPath}` : "Error: No arch-data found in file");
    return text(JSON.stringify(app.handoff.elements(r.data, region), null, 2));
  }),
    tool("export_iac_json",
      "Extract an Infrastructure-as-Code handoff payload from a generated diagram's services and connections, for the official AWS IaC MCP (awslabs.aws-iac-mcp-server). This server does NOT generate IaC itself; it returns the architecture (resources + dependencies + any per-node config.iac) plus an instruction telling the agent to use the AWS IaC MCP's cdk_best_practices / search_cdk_samples_and_constructs and validate before deploy.",
      {
    diagramPath: z.string().describe("Path to the .html diagram file to extract the architecture from"),
    region: z.string().optional().default("us-east-1").describe("AWS region for the target IaC (e.g. us-east-1, sa-east-1)"),
  },
      ({ diagramPath, region }) => {
    const r = app.handoff.readArchData(diagramPath);
    if (!r.ok) return failure(r.error === "not-found" ? `Error: file not found: ${diagramPath}` : "Error: No arch-data found in file");
    const p = app.handoff.iac(r.data, region);
    if (!p.resources.length) return text("No resources found in diagram services.");
    return text(JSON.stringify({
      target: { iac_mcp: "awslabs.aws-iac-mcp-server", region },
      architecture: { name: p.name, region, resources: p.resources, dependencies: p.dependencies },
      instruction: IAC_INSTRUCTION,
    }, null, 2));
  }),
    tool("list_shapes",
      "List common AWS4 drawio shape names for the .drawio path (auto_generate_diagram/generate_diagram, field `shape`). For the interactive HTML path use service display names + resolve_icon instead.",
      { category: z.string().optional() },
      ({ category }) => text(JSON.stringify(app.catalog.shapes(category), null, 2))),
    tool("resolve_icon",
      "Resolve an AWS service display name to its icon filename. Omit `service` to list all mapped services. The generator auto-resolves icons from service names, so passing `icon` in services is optional.",
      { service: z.string().optional().describe("Service display name, e.g. 'Amazon RDS', 'AWS Lambda'") },
      ({ service }) => {
    if (!service) {
      const names = app.icons.mappedServices();
      return text(`Mapped services (${names.length}):\n${names.join("\n")}`);
    }
    const file = app.icons.resolve(service);
    return text(file
      ? `${service} -> ${file}`
      : `No icon mapping for "${service}". It will fall back to a category-colored initial. Pass an explicit icon (e.g. 'aws-icons/<name>.svg') if needed.`);
  }),
    tool("setup_icons",
      "Install the AWS Architecture Icons (once per machine) so diagrams render real service icons instead of category-colored initials. Call this when a generate/validate result reports unresolved icons. With no argument it picks up the newest Icon-package*.zip (or older Asset-Package*.zip) from ~/Downloads/~/Desktop; if none is there, it returns the download instructions to relay to the user. Icons install to ~/.aws-architecture-icons and are shared by every copy of this server.",
      {
    source: z.string().optional().describe("Path to the icon package .zip (Icon-package_<date>.zip) (or an already-extracted directory). Omit to auto-detect the newest download."),
    dest: z.string().optional().describe("Install somewhere other than the shared ~/.aws-architecture-icons cache."),
    force: z.boolean().optional().describe("Re-install even when icons are already available."),
  },
      ({ source, dest, force }) => {
    const r = app.icons.setup({ source, dest, force });
    if (r.status === "already") return text(`Icons already installed: ${r.count} file(s) in ${r.root}. Nothing to do (pass force:true to re-install).`);
    return text(r.installed
      ? `${r.output.trim()}\n\nIcon root now: ${r.root}. Re-generate the diagram to pick the icons up.`
      : `${r.output.trim()}\n\nNo icons installed yet — relay the download steps above to the user, then call setup_icons again.`);
  }),
  ];
}
