// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// ─── App-shell presets ───
// `odb-app` reproduces the cost-calculator app's LOOK (sidebar with brand,
// language switch, navigation with value badges and a pinned summary card;
// pages of form cards, a result panel, a section band and service cards; an
// architecture page) from the app-shell components alone. It carries NO pricing
// logic: every number is a formula over the spec's `data`, and the example data
// below is generic and illustrative (round placeholder rates), only there so a
// preview renders something. A real calculator brings its own data/metrics.

const usd = (value, extra = {}) => ({ value, format: { style: "currency", currency: "USD", compact: true, ...extra } });
const ref = (k) => ({ ref: k });
const mul = (...args) => ({ op: "mul", args });
const sum = (...args) => ({ op: "sum", args });

export const ODB_APP_EXAMPLE = {
  data: {
    tier: "dedicated",
    licensing: "included",
    dbServers: 2,
    storageServers: 3,
    computeUnits: 64,
    computeCapacity: 1520,
    backupTarget: "managed",
    backupGB: 5000,
    channel: "direct",
    region: "region-a",
    hoursPerMonth: 730,
    // Illustrative placeholder rates (USD) — NOT real prices.
    rateDbServerHour: 6.3,
    rateStorageServerHour: 5.5,
    rateComputeUnitHour: 0.34,
    rateBackupGBMonth: 0.03,
    discountPct: 20,
    rateEgressMonth: 75,
    rateLatticeMonth: 0.35,
  },
  metrics: {
    dbServersMonth: mul(ref("dbServers"), ref("rateDbServerHour"), ref("hoursPerMonth")),
    storageServersMonth: mul(ref("storageServers"), ref("rateStorageServerHour"), ref("hoursPerMonth")),
    computeMonth: mul(ref("computeUnits"), ref("rateComputeUnitHour"), ref("hoursPerMonth")),
    backupMonth: mul(ref("backupGB"), ref("rateBackupGBMonth")),
    subtotal: sum(ref("dbServersMonth"), ref("storageServersMonth"), ref("computeMonth"), ref("backupMonth")),
    discount: mul(sum(ref("storageServersMonth"), ref("computeMonth")), { op: "div", args: [ref("discountPct"), 100] }),
    platformMonth: { op: "sub", args: [ref("subtotal"), ref("discount")] },
    servicesMonth: sum(ref("rateEgressMonth"), ref("rateLatticeMonth")),
    totalMonth: sum(ref("platformMonth"), ref("servicesMonth")),
    totalYear: mul(ref("totalMonth"), 12),
    platformYear: mul(ref("platformMonth"), 12),
    servicesYear: mul(ref("servicesMonth"), 12),
  },
};

export const ODB_APP_PRESET = {
  name: "odb-app",
  extends: "default",
  description: "App shell in the cost-calculator style: sidebar (brand, language, navigation with value badges, pinned summary card) and pages (estimate with form cards + result panel + service cards, architecture, configuration). Numbers are formulas over spec.data / spec.metrics; the example data is generic.",
  shell: "app",
  app: {
    sidebar: [
      { component: "sidebar.brand", props: { title: "Cost Calculator", subtitle: { en: "Database platform — estimate", pt: "Plataforma de banco de dados — estimativa" }, icon: "chart" } },
      "sidebar.language",
      { component: "sidebar.nav", props: { title: { en: "Navigation", pt: "Navegação" } } },
      { component: "sidebar.summary", props: {
        eyebrow: { en: "Consolidated total / month", pt: "Total consolidado / mês" },
        value: usd(ref("totalMonth")),
        context: { value: ref("region"), format: { prefix: "Region " } },
        select: { bind: "region", label: { en: "Region", pt: "Região" }, options: [{ value: "region-a", label: "Region A" }, { value: "region-b", label: "Region B" }] },
        unit: "USD",
        rows: [
          { label: { en: "Database platform", pt: "Plataforma de banco" }, value: usd(ref("platformMonth")), tone: "orange" },
          { label: { en: "AWS services", pt: "Serviços AWS" }, value: usd(ref("servicesMonth"), { compact: false }), tone: "orange" },
        ],
        totals: [
          { label: { en: "Total / month", pt: "Total / mês" }, value: usd(ref("totalMonth")) },
          { label: { en: "Annual", pt: "Anual" }, value: usd(ref("totalYear")), tone: "blue" },
        ],
        footer: [
          { icon: "pin", label: { en: "Region", pt: "Região" }, value: ref("region") },
          { icon: "clock", label: { en: "Hours/mo", pt: "Horas/mês" }, value: ref("hoursPerMonth") },
        ],
      } },
    ],
    startPage: "estimate",
    pages: [
      {
        id: "estimate", icon: "database", label: { en: "Database platform", pt: "Plataforma de banco" },
        badge: usd(ref("platformMonth"), { suffix: "/mo" }),
        components: [
          { component: "page.header", props: { eyebrow: { en: "Database platform — cost estimate", pt: "Plataforma de banco — estimativa de custo" }, icon: "database", title: { en: "Managed database platform", pt: "Plataforma de banco gerenciada" }, subtitle: { en: "Platform cost + AWS services (separate), each with its own subtotal", pt: "Custo da plataforma + serviços AWS (separados), cada um com seu subtotal" } } },
          { component: "page.grid", props: { columns: 3, items: [
            { component: "page.form", props: { title: { en: "Infrastructure", pt: "Infraestrutura" }, icon: "server", info: { en: "Dedicated servers or a shared tier.", pt: "Servidores dedicados ou camada compartilhada." }, fields: [
              { kind: "segmented", bind: "tier", options: [{ value: "dedicated", label: { en: "Dedicated", pt: "Dedicado" } }, { value: "shared", label: { en: "Shared", pt: "Compartilhado" } }] },
              { kind: "number", bind: "dbServers", label: { en: "Database servers", pt: "Servidores de banco" }, info: { en: "Minimum 2.", pt: "Mínimo 2." }, min: 2, max: 32 },
              { kind: "number", bind: "storageServers", label: { en: "Storage servers", pt: "Servidores de storage" }, min: 3, max: 64 },
              { kind: "meter", label: { en: "Infrastructure utilization", pt: "Utilização da infraestrutura" }, caption: { en: "Compute allocated / capacity", pt: "Compute alocado / capacidade" }, value: ref("computeUnits"), max: ref("computeCapacity"), legend: { en: "of capacity", pt: "da capacidade" } },
            ] } },
            { component: "page.form", props: { title: { en: "Compute (cluster)", pt: "Compute (cluster)" }, icon: "cpu", info: { en: "Units allocated to the cluster.", pt: "Unidades alocadas ao cluster." }, fields: [
              { kind: "segmented", bind: "licensing", options: [{ value: "included", label: { en: "License included", pt: "Licença incluída" } }, { value: "byol", label: "BYOL" }] },
              { kind: "number", bind: "computeUnits", label: { en: "Compute units in the cluster", pt: "Unidades de compute no cluster" }, min: 0, max: 2000, step: 2 },
            ] } },
            { component: "page.result", props: {
              title: { en: "Database platform — result", pt: "Plataforma de banco — resultado" },
              kpis: [
                { label: { en: "Monthly (USD)", pt: "Mensal (USD)" }, value: usd(ref("platformMonth")) },
                { label: { en: "Annual (USD)", pt: "Anual (USD)" }, value: usd(ref("platformYear")) },
                { label: { en: "Before discount", pt: "Antes do desconto" }, value: usd(ref("subtotal")) },
                { label: { en: "With discount (USD/mo)", pt: "Com desconto (USD/mês)" }, value: usd(ref("platformMonth")), tone: "purple" },
              ],
              rows: [
                { label: { en: "Database servers", pt: "Servidores de banco" }, value: usd(ref("dbServersMonth")) },
                { label: { en: "Storage servers", pt: "Servidores de storage" }, value: usd(ref("storageServersMonth")) },
                { label: "Compute", chip: "LI", value: usd(ref("computeMonth")) },
                { label: { en: "Managed backup", pt: "Backup gerenciado" }, sub: { en: "5 TB", pt: "5 TB" }, value: usd(ref("backupMonth"), { compact: false }) },
              ],
              subtotal: { label: "SUBTOTAL", value: usd(ref("subtotal")) },
              adjustments: [{ label: { en: "Marketplace discount (20% on storage + compute)", pt: "Desconto Marketplace (20% em storage + compute)" }, value: usd({ op: "mul", args: [ref("discount"), -1] }), tone: "purple" }],
              total: { label: "TOTAL", value: usd(ref("platformMonth")) },
              callout: { text: { en: "Network and the AWS services (KMS, Route 53, Secrets, CloudWatch) are AWS cost and are listed in the AWS services section below, not in this total.", pt: "Rede e serviços AWS (KMS, Route 53, Secrets, CloudWatch) são custo AWS e estão na seção Serviços AWS abaixo, fora deste total." } },
            } },
            { component: "page.form", props: { title: { en: "Managed backup", pt: "Backup gerenciado" }, icon: "backup", fields: [
              { kind: "segmented", bind: "backupTarget", label: { en: "Backup destination", pt: "Destino do backup" }, options: [{ value: "managed", label: { en: "Managed recovery", pt: "Recovery gerenciado" }, sub: "US$ 0.03/GB" }, { value: "s3", label: "Amazon S3", sub: "US$ 0.05/GB" }, { value: "object", label: { en: "Object storage", pt: "Object storage" }, sub: "US$ 0.03/GB" }] },
              { kind: "number", bind: "backupGB", label: { en: "Backup volume (GB)", pt: "Volume de backup (GB)" }, min: 0, step: 100 },
            ] } },
            { component: "page.form", props: { title: { en: "Purchase channel (markup)", pt: "Canal de compra (markup)" }, icon: "swap", tone: "purple", fields: [
              { kind: "select", bind: "channel", label: { en: "Channel / reseller", pt: "Canal / revenda" }, options: [{ value: "direct", label: { en: "Direct purchase (no reseller) — ×1.00", pt: "Compra direta (sem revenda) — ×1,00" } }, { value: "partner", label: { en: "Partner — ×1.10", pt: "Parceiro — ×1,10" } }] },
              { kind: "note", text: { en: "Direct purchase: no markup, the TOTAL above is what you pay.", pt: "Compra direta: sem markup, o TOTAL acima é o que se paga." } },
            ] } },
          ] } },
          { component: "page.section", props: { icon: "cloud", title: { en: "AWS Services (AWS cost, separate)", pt: "Serviços AWS (custo AWS, separado)" }, about: { en: "Services billed by AWS next to the platform.", pt: "Serviços cobrados pela AWS ao lado da plataforma." }, aboutLabel: { en: "About", pt: "Sobre" }, eyebrow: { en: "ALWAYS PRESENT (AWS COST)", pt: "SEMPRE PRESENTES (CUSTO AWS)" } } },
          { component: "page.grid", props: { columns: 3, items: [
            { component: "page.services", props: { columns: 1, items: [
              { title: { en: "Data transfer (network)", pt: "Transferência de dados (rede)" }, service: "AWS Direct Connect", tag: "EGRESS · AWS COST", value: usd(ref("rateEgressMonth"), { compact: false }), text: { en: "Outbound traffic from the platform to other AZs or Regions.", pt: "Tráfego de saída da plataforma para outras AZs ou Regiões." } },
            ] } },
            { component: "page.services", props: { columns: 1, items: [
              { title: "Amazon VPC Lattice", service: "Amazon VPC Lattice", tag: { en: "MANAGED INTEGRATION · AWS COST", pt: "INTEGRAÇÃO GERENCIADA · CUSTO AWS" }, value: usd(ref("rateLatticeMonth"), { compact: false }), text: { en: "Managed connectivity from the platform network to AWS services.", pt: "Conectividade gerenciada da rede da plataforma aos serviços AWS." } },
            ] } },
            { component: "page.result", props: {
              title: { en: "AWS services — result", pt: "Serviços AWS — resultado" }, icon: "cloud", tone: "orange",
              kpis: [
                { label: { en: "Monthly (USD)", pt: "Mensal (USD)" }, value: usd(ref("servicesMonth"), { compact: false }) },
                { label: { en: "Annual (USD)", pt: "Anual (USD)" }, value: usd(ref("servicesYear")) },
              ],
              total: { label: "TOTAL", value: usd(ref("servicesMonth"), { compact: false }) },
            } },
          ] } },
        ],
      },
      { id: "architecture", icon: "architecture", label: { en: "Architecture", pt: "Arquitetura" }, components: [
        { component: "page.architecture", props: { title: { en: "Interactive architecture", pt: "Arquitetura interativa" } } },
      ] },
      { id: "configuration", icon: "settings", label: { en: "Configuration", pt: "Configuração" }, components: [
        { component: "page.header", props: { icon: "settings", title: { en: "Configuration", pt: "Configuração" }, subtitle: { en: "Rates and assumptions the formulas read (example values).", pt: "Tarifas e premissas lidas pelas fórmulas (valores de exemplo)." } } },
        { component: "page.grid", props: { columns: 2, items: [
          { component: "page.form", props: { title: { en: "Rates (USD)", pt: "Tarifas (USD)" }, icon: "chart", fields: [
            { kind: "number", bind: "rateDbServerHour", label: { en: "Database server / hour", pt: "Servidor de banco / hora" }, min: 0, step: 0.01 },
            { kind: "number", bind: "rateStorageServerHour", label: { en: "Storage server / hour", pt: "Servidor de storage / hora" }, min: 0, step: 0.01 },
            { kind: "number", bind: "rateComputeUnitHour", label: { en: "Compute unit / hour", pt: "Unidade de compute / hora" }, min: 0, step: 0.01 },
            { kind: "number", bind: "rateBackupGBMonth", label: { en: "Backup GB / month", pt: "GB de backup / mês" }, min: 0, step: 0.001 },
          ] } },
          { component: "page.form", props: { title: { en: "Assumptions", pt: "Premissas" }, icon: "clock", fields: [
            { kind: "number", bind: "hoursPerMonth", label: { en: "Hours per month", pt: "Horas por mês" }, min: 1, max: 744 },
            { kind: "number", bind: "discountPct", label: { en: "Marketplace discount (%)", pt: "Desconto Marketplace (%)" }, min: 0, max: 100 },
            { kind: "note", text: { en: "Example values only — replace them with the rates of your estimate.", pt: "Valores apenas de exemplo — substitua pelas tarifas da sua estimativa." } },
          ] } },
        ] } },
      ] },
    ],
    example: ODB_APP_EXAMPLE,
  },
};
