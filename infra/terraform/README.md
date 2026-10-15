# AMIL on Azure Qatar Central

Terraform for one bank's AMIL tenant in its own Azure subscription, pinned to `qatarcentral`
(D-073). It is a starting point for the bank's platform team: review networking, IAM, backups and
monitoring against the bank's own standards before use. The full runbook is
[`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md).

## What it creates

| Area     | Resources                                                                                                                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Network  | A VNet with three subnets (Container Apps, PostgreSQL, private endpoints) and private DNS zones. Nothing has a public IP.                                                                                |
| Keys     | Key Vault Premium (RBAC, purge protection, private endpoint) with two HSM keys: the PII envelope key (D-066) and the PostgreSQL CMEK.                                                                    |
| Data     | PostgreSQL 16 Flexible Server: VNet-integrated, TLS 1.2+, CMEK, 35-day backups kept in Qatar (no geo-redundant copy), zone-redundant HA in prod. Azure Cache for Redis: TLS only, private, `noeviction`. |
| Images   | Container Registry Premium: private endpoint, no admin user, no anonymous pull.                                                                                                                          |
| Services | An internal Container Apps environment: `api`, `worker` (one always-on replica) and `console`, plus the `migrate` and `bootstrap` jobs from the ops image (D-079, D-080).                                |
| Identity | One user-assigned identity per workload. Each reads only the secrets it needs; no workload can use the PII key.                                                                                          |

The bank's Application Gateway (WAF, TLS certificates, DNS names) sits in front of the API and the
console. It is bank-owned and not created here. The fictional demo bank is never deployed.

## Secrets

Terraform writes only the values it derives from resources it creates: `database-url-migrate`,
`redis-url` and the break-glass `postgres-admin-password`. Every other secret starts as the
placeholder `set-me`, and an operator sets its value with `az keyvault secret set`, so its value
never enters Terraform state. The `secrets_to_populate` output lists them.

| Secret                     | Read by       | Value                                                          |
| -------------------------- | ------------- | -------------------------------------------------------------- |
| `database-url`             | api, worker   | `amil_app` connection string (`infra/sql/amil_app_role.sql`)   |
| `amil-api-keys`            | api, worker   | `bankKeyId:secret:bank_id,consoleKeyId:secret:bank_id:console` |
| `session-secret`           | api, worker   | 48+ random bytes, base64                                       |
| `audit-hash-secret`        | api, worker   | 48+ random bytes, base64. Never change it once events exist    |
| `console-key-secret`       | console       | the console key's secret (the same one in `amil-api-keys`)     |
| `okta-client-secret`       | console       | from the Okta app                                              |
| `bank-config`              | bootstrap job | the bank config JSON (`infra/bank-config.example.json`)        |
| `anthropic-api-key`        | api, worker   | only with `hosted_model_enabled = true`                        |
| `in-country-model-api-key` | api, worker   | only with `in_country_model_url` set                           |

## Two-stage first apply

1. `deploy_apps = false`: networking, keys, data stores, registry and placeholder secrets.
2. Set the secrets, create the `amil_app` role, then `deploy_apps = true`. The deploy workflow
   pushes the images, runs migrations (and the bootstrap, on request), then rolls out the apps.

## Tests

`terraform test` runs plan-level checks with mocked providers and no Azure credentials. They
cover:

- residency guards;
- that stage 1 creates no apps;
- private-only data stores;
- which workload may read which secret.

CI runs `fmt`, `validate` and `test`.

## Not included

- The bank's Application Gateway, WAF, DNS and certificates; VNet peering to the bank's hub.
- Alerting rules and dashboards (logs go to the Log Analytics workspace; point `otel_endpoint` at
  the bank's collector for traces).
- An in-country model endpoint for `model_mode = in_country`.
- mTLS between the bank and AMIL (optional for pilots, D-078; the Application Gateway can require
  client certificates when a bank asks for it).
