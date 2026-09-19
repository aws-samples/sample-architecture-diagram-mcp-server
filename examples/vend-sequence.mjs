// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
//
// Example: DATAPREV "bolha" account-vend flow (AFT + Control Tower + seed +
// account-customizations) rendered with the animated sequence-diagram generator.
// Run: node examples/vend-sequence.mjs [outputPath]
import { generateSequenceHtml } from "../lib/sequence-generator.js";
import { writeFileSync } from "fs";

const out = process.argv[2] || "/tmp/vend-sequence.html";

// Order matters for the aggregation boxes below (groups span contiguous columns):
// the actor sits outside, then the AWS/AFT control plane, then the on-prem bootstrap.
const participants = [
  { id: "dev", label: "SA/Dev", actor: true },
  { id: "cc",  label: "CodeCommit", sub: "aft-account-request", icon: "Arch_AWS-CodeBuild_48.png" },
  { id: "ddb", label: "DynamoDB", sub: "aft-request", service: "Amazon DynamoDB", stereotype: "entity" },
  { id: "ct",  label: "Control Tower", service: "AWS Control Tower", stereotype: "control" },
  { id: "new", label: "Conta nova", sub: "OU Plataforma…", icon: "Arch_AWS-Cloud-Control-API_48.png" },
  { id: "ssm", label: "SSM", sub: "custom-fields", service: "AWS Systems Manager" },
  { id: "sfn", label: "SFN", sub: "prov-customizations", service: "AWS Step Functions", stereotype: "control" },
  { id: "l",   label: "Lambda seed", sub: "aft-seed-vault-rhbk", service: "AWS Lambda", stereotype: "control" },
  { id: "sm",  label: "Secrets Manager", service: "AWS Secrets Manager", stereotype: "boundary" },
  { id: "cb",  label: "CodeBuild", sub: "account-cust.", service: "AWS CodeBuild" },
  { id: "va",  label: "Vault", icon: "tech-icons/vault.svg", stereotype: "external" },
  { id: "kc",  label: "RHBK", sub: "Keycloak", icon: "tech-icons/keycloak.svg", stereotype: "external" },
  { id: "gl",  label: "GitLab", icon: "tech-icons/gitlab.svg", stereotype: "external" },
  { id: "zbx", label: "Zabbix", icon: "tech-icons/zabbix.svg", stereotype: "external" },
];

const groups = [
  { label: "AWS · AFT / Control Tower", participants: ["cc","ddb","ct","new","ssm","sfn","l","sm","cb"], tone: "info" },
  { label: "Bootstrap on-prem (RHBK/Vault/GitLab/Zabbix)", participants: ["va","kc","gl","zbx"], tone: "warn" },
];

const events = [
  { kind:"message", id:"m1", from:"dev", to:"cc", label:"push account-request-<produto>.tf",
    title:"Push na account-request", flow:"SA/Dev → CodeCommit",
    desc:"O módulo grava 1 item na tabela `aft-request`; **`custom_fields` vira string JSON**.",
    proof:"`modules/aft-account-request/ddb.tf` · `account-request-plataforma-internalizacao.tf:10-57`" },
  { kind:"message", id:"m2", from:"cc", to:"ddb", label:"grava item (custom_fields = STRING JSON)",
    title:"CodeCommit → DynamoDB", flow:"pipeline ct-aft-account-request",
    proof:"`ddb.tf` → `custom_fields = { S = jsonencode(var.custom_fields) }`" },
  { kind:"message", id:"m3", from:"ddb", to:"ct", label:"dispara vend (AccountName, OU, email)",
    title:"DynamoDB → Control Tower", flow:"Account Factory" },
  { kind:"message", id:"m4", from:"ct", to:"new", create:true, label:"cria conta (~30-40 min)",
    title:"Control Tower cria a conta", flow:"irreversível · ~30-40 min", badge:"sync",
    desc:"Mensagem **«create»** UML: a conta nova é instanciada aqui — a lifeline dela só começa neste passo." },
  { kind:"message", id:"m5", from:"ct", to:"ssm", label:"publica custom_fields.<k> como SSM Param",
    title:"AFT publica custom-fields no SSM", flow:"/aft/account-request/custom-fields/*",
    proof:"`data.tf:4-8` · consumo em `network.tf:29-32`" },
  { kind:"note", id:"n1", over:["sfn","zbx"], badge:"phase", label:"PROVISIONING-CUSTOMIZATIONS (antes das account-customizations)",
    title:"Fase: provisioning-customizations", desc:"Roda ANTES das account-customizations." },
  { kind:"message", id:"m6", from:"ct", to:"sfn", arrow:"async", label:"StartAt SeedVaultRhbk", badge:"async",
    title:"Control Tower → SFN", flow:"aft-account-provisioning-customizations (assíncrono)",
    proof:"`customizations.asl.json` → `StartAt: SeedVaultRhbk`, `Catch States.ALL → SeedFailed`" },
  { kind:"message", id:"m7", from:"sfn", to:"l", label:"invoke (evento CamelCase, account.id)",
    title:"SFN → Lambda seed", proof:"`Resource: …:function:aft-seed-vault-rhbk`, Retry 6x" },
  { kind:"message", id:"m8", from:"l", to:"sm", label:"get_secret_value → VAULT/RHBK/GITLAB/ZABBIX",
    title:"Carrega segredos de bootstrap", proof:"`handler.py:29-47`" },
  { kind:"message", id:"m9", from:"l", to:"l", label:"produto_meta_from_event() · OU≠Plataforma ⇒ no-op",
    title:"Extrai e DERIVA a identidade", desc:"ARNs previstos por convenção; **as roles físicas só nascem no fim**.",
    proof:"`seed.py:177-214`" },
  { kind:"message", id:"m10", from:"l", to:"kc", label:"GATE assert_fornecedor_active(integrador)", badge:"gate",
    title:"GATE de fornecedor no RHBK", flow:"onboarding-no-RHBK-primeiro",
    desc:"Reprova o vend se `fornecedor-<integrador>` não existir ou `status != active`.", proof:"`seed.py:141-163`" },
  { kind:"message", id:"m11", from:"kc", to:"l", style:"dashed", label:"reprova ⇒ erro", badge:"fail",
    title:"[alt] fornecedor ausente / inativo", flow:"ramo de falha" },
  { kind:"message", id:"m12", from:"l", to:"sfn", style:"dashed", label:"SeedFailed (Fail) — aborta vend", badge:"fail",
    title:"[alt] SeedFailed", proof:"estado `SeedFailed` (Type Fail) em `customizations.asl.json`" },
  { kind:"message", id:"m13", from:"l", to:"va", label:"PUT secret + policy -ro + k8s-auth role", badge:"keyless",
    title:"[else] Vault — identidade do produto", flow:"só metadados + ARNs", proof:"`seed.py:219-287`" },
  { kind:"message", id:"m14", from:"l", to:"kc", label:"upsert grupo fornecedor-<integrador>",
    title:"RHBK — vínculo fornecedor↔conta", proof:"`seed.py:300-398`" },
  { kind:"message", id:"m15", from:"l", to:"gl", label:"cria repo privado VAZIO produtos/<produto>",
    title:"GitLab — repo vazio do produto", proof:"`seed.py:451-490` (`initialize_with_readme:false`)" },
  { kind:"message", id:"m16", from:"l", to:"zbx", label:"host produto-<produto> + macro AssumeRole",
    title:"Zabbix — host CloudWatch", proof:"`seed.py:516-579`" },
  { kind:"message", id:"m17", from:"l", to:"sfn", style:"dashed", label:"OK (idempotente)",
    title:"[else] seed concluído", flow:"os 4 alvos são idempotentes" },
  { kind:"note", id:"n2", over:["sfn","cb"], badge:"phase", label:"ACCOUNT-CUSTOMIZATIONS (depois; na conta vendada)",
    title:"Fase: account-customizations", desc:"CodeBuild na conta alvo. Prova: `api_helpers/*.sh` (no-op)." },
  { kind:"message", id:"m18", from:"sfn", to:"cb", label:"dispara customization PlataformaInternalizacao",
    title:"SFN → CodeBuild", flow:"account_customizations_name" },
  { kind:"message", id:"m19", from:"cb", to:"ssm", label:"lê custom-fields (integrador + rede)",
    title:"CodeBuild lê SSM", proof:"`data.tf:10-13` · `network.tf:29-35`" },
  { kind:"message", id:"m20", from:"cb", to:"new", label:"apply boundary (region lock + anti-escalação)",
    title:"Permissions boundary", proof:"`boundary.tf:5-95`" },
  { kind:"message", id:"m21", from:"cb", to:"new", label:"cria roles integrador/auditor/zabbix-ro (+SAML)",
    title:"Roles + SAML provider", proof:"`roles.tf:10-247` · `saml.auto.tfvars`" },
  { kind:"message", id:"m22", from:"cb", to:"new", label:"spoke VPC (sem IGW/NAT) + TGW + rotas + Resolver + PHZ",
    title:"Rede do spoke conectada ao hub", proof:"`network.tf:53-146`" },
  { kind:"message", id:"m23", from:"cb", to:"dev", arrow:"reply", label:"conta pronta (boundary + roles + rede + bootstrap)",
    title:"Vend concluído — retorno ao solicitante", flow:"CodeBuild → SA/Dev",
    desc:"Reply UML fechando o fluxo: a conta está provisionada e customizada (permissions boundary, roles/SAML, rede do spoke) e o bootstrap on-prem já rodou. O solicitante é notificado do fim do vend." },
];

const fragments = [
  { kind:"alt", label:"fornecedor inválido", startId:"m11", endId:"m17",
    dividers:[{ beforeId:"m13", label:"[else] fornecedor active" }] },
];

const html = generateSequenceHtml({
  title: "Vend de conta — OU PlataformaInternalizacao",
  subtitle: "Ambiente Bolha DATAPREV · AFT + Control Tower + seed (Vault/RHBK/GitLab/Zabbix) + account-customizations",
  participants, events, fragments, groups,
});
writeFileSync(out, html, "utf-8");
console.log("wrote", out, "-", html.length, "bytes");
