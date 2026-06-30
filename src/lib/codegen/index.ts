// ArcFlow does NOT generate IaC itself. It emits a structured architecture spec
// plus an instruction for the agent to hand off to the official AWS IaC MCP
// (awslabs.aws-iac-mcp-server), which produces and validates real, deployable code.

function svcName(s: any): string {
  if (typeof s.service === "string") return s.service;
  return s.service?.en || s.service?.pt || s.id;
}

/**
 * Build the handoff payload: the architecture as the agent needs to see it
 * (resources + dependencies + per-service config), with an explicit instruction
 * to use the AWS IaC MCP rather than re-implementing generation.
 */
export function generateIacHandoff(services: any[], connections: any[], title: string, region: string): string {
  const resources = (services || [])
    .filter(s => !s.external && s.id !== "users")
    .map(s => ({
      id: s.id,
      service: svcName(s),
      category: s.category || "general",
      config: s.config?.iac || {},
    }));

  const dependencies = (connections || [])
    .filter(c => {
      const ext = new Set((services || []).filter(s => s.external || s.id === "users").map(s => s.id));
      return !ext.has(c.source) && !ext.has(c.target);
    })
    .map(c => ({ from: c.source, to: c.target, ...(c.label ? { via: typeof c.label === "string" ? c.label : (c.label.en || c.label.pt) } : {}) }));

  return JSON.stringify({
    instruction:
      "Generate production-ready IaC for this architecture using the AWS IaC MCP server " +
      "(awslabs.aws-iac-mcp-server). Do NOT hand-write resources from scratch. Recommended flow: " +
      "1) call cdk_best_practices (or search_cdk_samples_and_constructs) to get correct constructs and patterns for each resource; " +
      "2) wire resources using the 'dependencies' list (VPC, security groups, IAM, and connections between services); " +
      "3) fill required properties not present in 'config' (e.g. credentials, networking) following best practices; " +
      "4) validate the result with validate_cloudformation_template / check_cloudformation_template_compliance before deploy.",
    target: { iac_mcp: "awslabs.aws-iac-mcp-server", region },
    architecture: { name: title, region, resources, dependencies },
  }, null, 2);
}

// ---- Calculator handoff (pricing) — unchanged, also an MCP payload ----

export function generateCalculatorPayload(services: any[], title: string, region: string): string {
  const items = services
    .filter(s => s.config?.pricing)
    .map(s => ({
      service: svcName(s),
      calculatorKey: s.calculatorKey || svcName(s),
      description: s.config?.label || svcName(s),
      config: { region, ...s.config.pricing },
    }));
  return JSON.stringify({
    tool: "aws-calculator-mcp",
    steps: [
      { call: "create_estimate", args: { name: title } },
      ...items.map(i => ({ call: "add_service", args: { service: i.calculatorKey, group: title, config: i.config, description: i.description } })),
      { call: "export_estimate" },
    ],
  }, null, 2);
}
