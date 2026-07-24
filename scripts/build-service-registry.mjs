// ─── build-service-registry.mjs ───
// Unify the per-service metadata the MCP knows into ONE registry keyed by the
// service DISPLAY NAME (the same key diagrams, cost items and IaC all use):
//
//   "Amazon EC2": {
//     icon: "Arch_Amazon-EC2_48.png",       // from service-icons.json
//     cfn: "AWS::EC2::Instance",             // primary CFN type (cfn-types.json)
//     cfnTypes: ["AWS::EC2::Instance", …],   // all deployable types for the ns
//   }
//
// The calculator KEY is intentionally NOT cached here — it's resolved at runtime
// via search_services against the live calculator.aws manifest (a static map goes
// stale). This registry is the join key across the diagram / cost / IaC surfaces
// and feeds the CostCalculatorApp's service cards (icon + "what it is" in IaC).
//
// Run:  node scripts/build-service-registry.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB = join(__dirname, "..", "lib");

const icons = JSON.parse(readFileSync(join(LIB, "service-icons.json"), "utf8"));
let cfn = {};
try {
  cfn = JSON.parse(readFileSync(join(LIB, "cfn-types.json"), "utf8")).services || {};
} catch {
  console.warn("cfn-types.json not found — registry will have icons only.");
}

const registry = {};
// Primary-type overrides where cfn-types.json picked a non-canonical resource
// (its auto-picker chose the shortest/first type for the namespace). Keep small
// and only for services that actually surface in estimates.
const PRIMARY_FIX = {
  'Amazon FSx for Lustre': 'AWS::FSx::FileSystem',
  'Amazon FSx': 'AWS::FSx::FileSystem',
  'Amazon FSx for NetApp ONTAP': 'AWS::FSx::FileSystem',
  'Amazon FSx for OpenZFS': 'AWS::FSx::FileSystem',
};

for (const [name, icon] of Object.entries(icons)) {
  const c = cfn[name];
  const primary = PRIMARY_FIX[name] || (c && c.primary);
  registry[name] = {
    icon,
    ...(c ? { cfn: primary, ns: c.ns, cfnTypes: c.types } : (primary ? { cfn: primary } : {})),
  };
}

const out = {
  _generated: "scripts/build-service-registry.mjs — do not edit by hand",
  _count: Object.keys(registry).length,
  _withCfn: Object.values(registry).filter(r => r.cfn).length,
  services: registry,
};
writeFileSync(join(LIB, "service-registry.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote lib/service-registry.json — ${out._count} services (${out._withCfn} with a CFN type).`);
