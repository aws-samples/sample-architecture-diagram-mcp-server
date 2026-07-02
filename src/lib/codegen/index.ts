// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// This MCP does NOT generate IaC itself. It emits a structured architecture spec
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
export function generateIacHandoff(services: any[], connections: any[], title: string, region: string, opts: { adr?: any[]; wellArchitected?: Record<string, string> | null } = {}): string {
  const txt = (v: any) => typeof v === "string" ? v : (v?.en || v?.pt || undefined);
  const resources = (services || [])
    .filter(s => !s.external && s.id !== "users")
    .map(s => ({
      id: s.id,
      service: svcName(s),
      category: s.category || "general",
      ...(txt(s.role) ? { role: txt(s.role) } : {}),
      config: s.config?.iac || {},
    }));

  const dependencies = (connections || [])
    .filter(c => {
      const ext = new Set((services || []).filter(s => s.external || s.id === "users").map(s => s.id));
      return !ext.has(c.source) && !ext.has(c.target);
    })
    .map(c => ({ from: c.source, to: c.target, ...(c.type ? { type: c.type } : {}), ...(txt(c.label) ? { via: txt(c.label) } : {}) }));

  const rationale: any = {};
  if (opts.adr?.length) rationale.decisions = opts.adr;
  if (opts.wellArchitected && Object.values(opts.wellArchitected).some(Boolean)) rationale.wellArchitected = opts.wellArchitected;

  return JSON.stringify({
    instruction:
      "Generate production-ready IaC for this architecture using the AWS IaC MCP server " +
      "(awslabs.aws-iac-mcp-server). Do NOT hand-write resources from scratch. Recommended flow: " +
      "1) call cdk_best_practices (or search_cdk_samples_and_constructs) to get correct constructs and patterns for each resource; " +
      "2) wire resources using the 'dependencies' list (connection 'type' tells you the relationship: network/iam/event/data); " +
      "3) honor the 'rationale' (ADR decisions + Well-Architected intent) — e.g. if cost-optimization calls for pay-per-request, reflect it; " +
      "4) fill required properties not present in 'config' (e.g. credentials, networking) following best practices; " +
      "5) validate with validate_cloudformation_template / check_cloudformation_template_compliance before deploy.",
    target: { iac_mcp: "awslabs.aws-iac-mcp-server", region },
    architecture: { name: title, region, resources, dependencies, ...(Object.keys(rationale).length ? { rationale } : {}) },
  }, null, 2);
}

// ---- Pricing handoff — payload for the AWS Pricing MCP (awslabs aws-pricing-mcp-server) ----

// Price List service_code seed from a display name (codes differ from console names,
// so the agent resolves the exact code via get_pricing_service_codes).
function priceListFilter(serviceName: string): string {
  return serviceName.replace(/^(Amazon|AWS)\s+/i, "").replace(/[^A-Za-z0-9]+/g, "");
}

export function generatePricingPayload(services: any[], title: string, region: string): string {
  const items = services
    .filter(s => s.config?.pricing)
    .map(s => ({
      service: svcName(s),
      serviceCodeFilter: priceListFilter(svcName(s)),
      description: s.config?.label || svcName(s),
      config: s.config.pricing,
    }));
  return JSON.stringify({
    tool: "awslabs.aws-pricing-mcp-server",
    name: title,
    region,
    instruction:
      "Estimate cost with the AWS Pricing MCP. For each service: " +
      "1) get_pricing_service_codes(filter=serviceCodeFilter) to resolve the exact service_code; " +
      "2) get_pricing_service_attributes(service_code) to discover filterable Fields; " +
      "3) get_pricing(service_code, region, filters) mapping this entry's config values to those Fields. " +
      "The Price List API requires AWS credentials configured in the pricing MCP.",
    services: items,
  }, null, 2);
}
