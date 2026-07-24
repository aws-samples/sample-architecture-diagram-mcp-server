// ─── build-cfn-types.mjs ───
// Build lib/cfn-types.json — a map from each diagram SERVICE display name to its
// PRIMARY CloudFormation resource type (AWS::<Ns>::<Resource>), validated against
// the LIVE catalog of deployable public resource types.
//
// This enriches every diagram node with its real IaC identity: the Studio and
// export_iac_json can then hand a node straight to the ccapi-mcp-server
// (generate_infrastructure_code / create_template) with the correct resource_type.
//
// Regenerate (needs AWS creds; read-only — only list-types):
//   AWS_PROFILE=<p> node scripts/build-cfn-types.mjs
// It caches the catalog to /tmp so you can re-run the mapping offline:
//   node scripts/build-cfn-types.mjs --from /tmp/cfn-types-all.txt
//
// Output entries:
//   "Amazon S3": { primary: "AWS::S3::Bucket", ns: "AWS::S3", types: [...] }
// Services with NO deployable type are recorded in `nonDeployable` (programs,
// CLIs, SDKs) so the agent knows to skip them rather than guessing.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── 1. Get the live catalog of deployable public resource types ──
function loadCatalog() {
  const fromArg = process.argv.indexOf('--from');
  if (fromArg >= 0 && process.argv[fromArg + 1]) {
    return readFileSync(process.argv[fromArg + 1], 'utf8').trim().split('\n').filter(Boolean);
  }
  const cache = '/tmp/cfn-types-all.txt';
  if (existsSync(cache) && !process.argv.includes('--refresh')) {
    const lines = readFileSync(cache, 'utf8').trim().split('\n').filter(Boolean);
    if (lines.length > 500) return lines; // sane cache
  }
  // Paginate list-types for both deployable provisioning modes. --query keeps
  // parsing server-side (some type descriptions carry control chars that break
  // a naive JSON.parse).
  const all = new Set();
  for (const pt of ['FULLY_MUTABLE', 'IMMUTABLE']) {
    let token = '';
    do {
      const args = ['cloudformation', 'list-types', '--type', 'RESOURCE', '--visibility', 'PUBLIC',
        '--provisioning-type', pt, '--max-results', '100', '--output', 'json'];
      if (token) args.push('--next-token', token);
      const raw = execFileSync('aws', args, { maxBuffer: 64 * 1024 * 1024 }).toString();
      for (const m of raw.matchAll(/"TypeName":\s*"(AWS::[^"]+)"/g)) all.add(m[1]);
      const t = raw.match(/"NextToken":\s*"([^"]+)"/);
      token = t ? t[1] : '';
    } while (token);
  }
  const lines = [...all].sort();
  writeFileSync(cache, lines.join('\n') + '\n');
  return lines;
}

// ── 2. Curated overrides where the primary resource isn't auto-derivable ──
// (name→namespace is fuzzy, and the "root" resource isn't always guessable).
// service display name → full CFN type.
const OVERRIDES = {
  'Amazon Simple Storage Service': 'AWS::S3::Bucket',
  'Amazon S3': 'AWS::S3::Bucket',
  'AWS Lambda': 'AWS::Lambda::Function',
  'Amazon DynamoDB': 'AWS::DynamoDB::Table',
  'Amazon RDS': 'AWS::RDS::DBInstance',
  'Amazon Aurora': 'AWS::RDS::DBCluster',
  'Amazon EC2': 'AWS::EC2::Instance',
  'Amazon Virtual Private Cloud': 'AWS::EC2::VPC',
  'Amazon VPC': 'AWS::EC2::VPC',
  'Amazon Simple Queue Service': 'AWS::SQS::Queue',
  'Amazon SQS': 'AWS::SQS::Queue',
  'Amazon Simple Notification Service': 'AWS::SNS::Topic',
  'Amazon SNS': 'AWS::SNS::Topic',
  'Amazon API Gateway': 'AWS::ApiGateway::RestApi',
  'API Gateway': 'AWS::ApiGateway::RestApi',
  'Amazon ECS': 'AWS::ECS::Service',
  'Amazon Elastic Container Service': 'AWS::ECS::Service',
  'Amazon EKS': 'AWS::EKS::Cluster',
  'Amazon Elastic Kubernetes Service': 'AWS::EKS::Cluster',
  'Amazon ElastiCache': 'AWS::ElastiCache::CacheCluster',
  'Amazon OpenSearch Service': 'AWS::OpenSearchService::Domain',
  'Amazon Redshift': 'AWS::Redshift::Cluster',
  'Amazon Kinesis': 'AWS::Kinesis::Stream',
  'Amazon Kinesis Data Streams': 'AWS::Kinesis::Stream',
  'AWS Step Functions': 'AWS::StepFunctions::StateMachine',
  'Amazon EventBridge': 'AWS::Events::Rule',
  'Amazon CloudWatch': 'AWS::CloudWatch::Alarm',
  'Amazon CloudFront': 'AWS::CloudFront::Distribution',
  'Amazon Route 53': 'AWS::Route53::HostedZone',
  'AWS Secrets Manager': 'AWS::SecretsManager::Secret',
  'AWS Key Management Service': 'AWS::KMS::Key',
  'AWS KMS': 'AWS::KMS::Key',
  'AWS Identity and Access Management': 'AWS::IAM::Role',
  'AWS IAM': 'AWS::IAM::Role',
  'Amazon Cognito': 'AWS::Cognito::UserPool',
  'AWS Glue': 'AWS::Glue::Job',
  'Amazon Athena': 'AWS::Athena::WorkGroup',
  'Amazon SageMaker': 'AWS::SageMaker::Endpoint',
  'Amazon SageMaker AI': 'AWS::SageMaker::Endpoint',
  'Amazon MSK': 'AWS::MSK::Cluster',
  'Amazon Managed Streaming for Apache Kafka': 'AWS::MSK::Cluster',
  'Amazon EFS': 'AWS::EFS::FileSystem',
  'Amazon Elastic File System': 'AWS::EFS::FileSystem',
  'Amazon EMR': 'AWS::EMR::Cluster',
  'AWS Fargate': 'AWS::ECS::Service',
  'Elastic Load Balancing': 'AWS::ElasticLoadBalancingV2::LoadBalancer',
  'Application Load Balancer': 'AWS::ElasticLoadBalancingV2::LoadBalancer',
  // ── Curated recoveries (display name ≠ CFN namespace; all verified against the
  //    live catalog). Names the fuzzy matcher missed but that DO have a type. ──
  'AWS B2B Data Interchange': 'AWS::B2BI::Transformer',
  'AWS Cloud Map': 'AWS::ServiceDiscovery::Service',
  'AWS Cloud WAN': 'AWS::NetworkManager::CoreNetwork',
  'AWS Elemental MediaConnect': 'AWS::MediaConnect::Flow',
  'AWS Elemental MediaPackage': 'AWS::MediaPackageV2::Channel',
  'AWS Elemental MediaTailor': 'AWS::MediaTailor::PlaybackConfiguration',
  'AWS Express Workflows': 'AWS::StepFunctions::StateMachine',
  'AWS Fault Injection Service': 'AWS::FIS::ExperimentTemplate',
  'AWS Firewall Manager': 'AWS::FMS::Policy',
  'AWS HealthOmics': 'AWS::Omics::Workflow',
  'AWS Mainframe Modernization': 'AWS::M2::Application',
  'AWS Parallel Computing Service': 'AWS::PCS::Cluster',
  'AWS Private Certificate Authority': 'AWS::ACMPCA::CertificateAuthority',
  'AWS PrivateLink': 'AWS::EC2::VPCEndpoint',
  'AWS Resource Access Manager': 'AWS::RAM::ResourceShare',
  'AWS Site to Site VPN': 'AWS::EC2::VPNConnection',
  'AWS Site-to-Site VPN': 'AWS::EC2::VPNConnection',
  'AWS Thinkbox Deadline': 'AWS::Deadline::Farm',
  'AWS Transit Gateway': 'AWS::EC2::TransitGateway',
  'AWS Verified Access': 'AWS::EC2::VerifiedAccessInstance',
  'Amazon Application Recovery Controller': 'AWS::Route53RecoveryControl::Cluster',
  'Amazon Data Firehose': 'AWS::KinesisFirehose::DeliveryStream',
  'Amazon EBS': 'AWS::EC2::Volume',
  'Amazon Elastic Block Store': 'AWS::EC2::Volume',
  'Amazon Elastic Container Registry': 'AWS::ECR::Repository',
  'Amazon Elastic VMware Service': 'AWS::EVS::Environment',
  'Amazon Interactive Video Service': 'AWS::IVS::Channel',
  'Amazon Keyspaces': 'AWS::Cassandra::Keyspace',
  'Amazon Lookout for Vision': 'AWS::LookoutVision::Project',
  'Amazon MQ': 'AWS::AmazonMQ::Broker',
  'Amazon Managed Grafana': 'AWS::Grafana::Workspace',
  'Amazon Managed Service for Apache Flink': 'AWS::KinesisAnalyticsV2::Application',
  'Amazon Managed Service for Prometheus': 'AWS::APS::Workspace',
  'Amazon Managed Workflows for Apache Airflow': 'AWS::MWAA::Environment',
  'Amazon Simple Email Service': 'AWS::SES::ConfigurationSet',
  'Amazon Quick Suite': 'AWS::QuickSight::Dashboard',
  'Amazon Quantum Ledger Database': 'AWS::QLDB::Stream',
  'EventBridge': 'AWS::Events::Rule',
  'ELB': 'AWS::ElasticLoadBalancing::LoadBalancer',
  'NAT Gateway': 'AWS::EC2::NatGateway',
  'Oracle Database at AWS': 'AWS::ODB::CloudVmCluster',
  'Amazon EMR Serverless': 'AWS::EMRServerless::Application',
  // Bedrock: the fuzzy picker chose Flow; Agent is the canonical primary.
  'Amazon Bedrock': 'AWS::Bedrock::Agent',
  // Last verified recoveries.
  'AWS Application Migration Service': 'AWS::EC2::Instance',
  'AWS End User Messaging': 'AWS::SMSVOICE::PhoneNumber',
  'Amazon Monitron': 'AWS::IoT::Thing',
  // From the 113-agent curation pass (only those with a genuine root resource in
  // the LIVE public Cloud Control catalog; agents' other picks were rejected
  // here because the specific resource type isn't public — e.g. Client VPN,
  // MediaLive::Channel, FSx::FileCache, EFA — mapping those would be wrong).
  'AWS Cost Explorer': 'AWS::CE::CostCategory',
  'Amazon DocumentDB': 'AWS::DocDB::GlobalCluster',
  'AWS Database Migration Service': 'AWS::DMS::ReplicationConfig',
};

// The canonical "root" resource name for a namespace, when several exist. Tried
// (case-insensitive) against a namespace's resources before falling back.
const PREFERRED_ROOTS = [
  'Cluster', 'Instance', 'Function', 'Table', 'Bucket', 'Queue', 'Topic',
  'Domain', 'Distribution', 'Service', 'Application', 'Environment', 'Pipeline',
  'Project', 'Stream', 'DeliveryStream', 'StateMachine', 'Workgroup', 'WorkGroup',
  'Endpoint', 'Repository', 'Database', 'Graph', 'Fleet', 'Broker', 'Workspace',
  'Api', 'RestApi', 'Group', 'Rule', 'Key', 'Secret', 'Role', 'UserPool', 'Job',
];

// normalize a display name → a namespace-comparison token
const norm = (s) => s.replace(/^(Amazon|AWS)\s+/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();

function build() {
  const catalog = loadCatalog();
  const serviceIcons = JSON.parse(readFileSync(join(ROOT, 'lib', 'service-icons.json'), 'utf8'));
  const serviceNames = Object.keys(serviceIcons);

  // Index catalog by namespace: "S3" -> ["AWS::S3::Bucket", ...]
  const byNs = {};
  for (const t of catalog) {
    const ns = t.split('::')[1];
    (byNs[ns] ??= []).push(t);
  }
  const nsTokens = Object.keys(byNs).map(ns => ({ ns, token: ns.toLowerCase() }));

  const map = {};
  const nonDeployable = [];

  for (const name of serviceNames) {
    // 1) explicit override wins (and must exist in the live catalog)
    if (OVERRIDES[name] && catalog.includes(OVERRIDES[name])) {
      const ns = OVERRIDES[name].split('::').slice(0, 2).join('::');
      map[name] = { primary: OVERRIDES[name], ns, types: byNs[OVERRIDES[name].split('::')[1]] || [] };
      continue;
    }
    // 2) auto-match display name → namespace
    const n = norm(name);
    const hit = nsTokens.find(x => x.token === n)
      || nsTokens.find(x => n.startsWith(x.token) || x.token.startsWith(n));
    if (!hit) { nonDeployable.push(name); continue; }
    const types = byNs[hit.ns];
    const resources = types.map(t => t.split('::')[2]);
    // 3) pick the primary resource: a preferred root if present, else the
    //    shortest name (roots tend to be shortest: Bucket vs BucketPolicy).
    let primaryRes = PREFERRED_ROOTS.find(r => resources.some(x => x.toLowerCase() === r.toLowerCase()));
    if (primaryRes) primaryRes = resources.find(x => x.toLowerCase() === primaryRes.toLowerCase());
    else primaryRes = [...resources].sort((a, b) => a.length - b.length)[0];
    map[name] = { primary: `AWS::${hit.ns}::${primaryRes}`, ns: `AWS::${hit.ns}`, types };
  }

  const out = {
    _generated: 'scripts/build-cfn-types.mjs — do not edit by hand',
    _catalogSize: catalog.length,
    _mapped: Object.keys(map).length,
    _nonDeployable: nonDeployable.length,
    services: map,
    nonDeployable,
  };
  writeFileSync(join(ROOT, 'lib', 'cfn-types.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`Catalog: ${catalog.length} deployable types across ${Object.keys(byNs).length} namespaces.`);
  console.log(`Mapped ${Object.keys(map).length}/${serviceNames.length} service names to a primary CFN type.`);
  console.log(`Non-deployable (no CFN resource): ${nonDeployable.length}.`);
  console.log('Wrote lib/cfn-types.json');
}

build();
