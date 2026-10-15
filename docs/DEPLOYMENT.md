# Deploying AMIL to a bank (Azure Qatar Central)

The runbook for a pilot bank's first AMIL environment and every release after it. AMIL runs in
the bank's own Azure subscription in **Qatar Central**. It is one tenant per subscription, and
nothing leaves the country (D-073).

> This repository's demo data is synthetic, and Doha Demo Bank is fictional. A bank deployment
> never runs the demo bank or the seed: it starts empty and is set up with the bootstrap (D-080).

## What gets deployed

```
 Bank app / bank staff
        │ https (bank DNS, bank certificates)
 ┌──────▼──────────────────────────┐
 │ Bank Application Gateway + WAF  │  bank-owned, peered with the AMIL VNet
 └──────┬───────────────┬──────────┘
        │               │
 ┌──────▼─────┐  ┌──────▼──────┐  ┌──────────┐   internal Container Apps environment
 │ api        │  │ console     │  │ worker   │   (no public IP)
 └──┬─────┬───┘  └──────┬──────┘  └──┬────┬──┘
    │     │             │ Okta OIDC  │    │
 ┌──▼──┐ ┌▼──────┐   (internet)  ┌───▼┐ ┌─▼────┐
 │ PG  │ │ Redis │               │ PG │ │Redis │   private endpoints / VNet integration
 └─────┘ └───────┘               └────┘ └──────┘
  Key Vault (HSM keys, secrets)  ·  Container Registry  ·  Log Analytics
```

The Terraform is in `infra/terraform` (see its README). The deploy workflow is
`.github/workflows/deploy-azure.yml`.

## Who does what

| Step                                                         | Owner                   |
| ------------------------------------------------------------ | ----------------------- |
| Subscription, state storage, deploy identity, runner, GitHub | Bank platform team      |
| Okta application and staff assignment                        | Bank identity team      |
| Application Gateway, WAF, DNS, certificates, VNet peering    | Bank network team       |
| Secrets, database role, bank config                          | Bank platform with AMIL |
| Releases (approve the workflow run)                          | Named approvers         |
| Pack terms, copy approval, switching packs on                | Bank product/compliance |

## 1. Prerequisites

### 1.1 Subscription and resource providers

Use a dedicated subscription in the bank's tenant. Register the providers once:

```bash
for p in Microsoft.App Microsoft.ContainerRegistry Microsoft.DBforPostgreSQL Microsoft.Cache \
         Microsoft.KeyVault Microsoft.Network Microsoft.OperationalInsights \
         Microsoft.ManagedIdentity; do
  az provider register --namespace "$p"
done
```

### 1.2 Terraform state, in Qatar Central

```bash
az group create -n rg-amil-tfstate -l qatarcentral
az storage account create -n <bankcode>amiltfstate -g rg-amil-tfstate -l qatarcentral \
  --sku Standard_ZRS --min-tls-version TLS1_2 --allow-blob-public-access false \
  --allow-shared-key-access false
az storage container create -n tfstate --account-name <bankcode>amiltfstate --auth-mode login
```

State holds the PostgreSQL admin password and the Redis key, so treat it as secret:

- private access only;
- Entra ID auth (no account keys);
- only the deploy identity and break-glass admins have access.

### 1.3 Deploy identity (GitHub OIDC, no stored secret)

1. **Register the app.** Create an Entra app registration, for example `amil-deploy-uat`.
2. **Add a federated credential:**
   - issuer: `https://token.actions.githubusercontent.com`;
   - subject: `repo:<org>/amil-ai:environment:amil-uat`.
3. **Grant it on the subscription:**
   - `Contributor`;
   - `Role Based Access Control Administrator`, with a condition that limits it to the roles
     Terraform assigns: Key Vault Administrator, Key Vault Secrets User, Key Vault Crypto
     Service Encryption User, AcrPull and AcrPush.
4. **Grant it on the state container:** `Storage Blob Data Contributor`.

Do the same for prod, with its own app registration and subject.

### 1.4 A runner inside the network

Key Vault and the registry are private. The workflow needs a self-hosted runner that can reach
them: a VM in a peered VNet, with Docker, the Azure CLI, `jq` and outbound access to GitHub.
Set the repository variable `AMIL_DEPLOY_RUNNER` to its label.

For a first trial only, you can use `ubuntu-latest` instead and list its egress ranges in
`operator_ip_ranges`. This opens the Key Vault and registry data planes to those ranges.

### 1.5 GitHub environments

Create the environments `amil-uat` and `amil-prod`, each with required reviewers. For prod, also
restrict deployments to `main`.

Variables (no secrets):

| Variable                  | Value                                                |
| ------------------------- | ---------------------------------------------------- |
| `AZURE_CLIENT_ID`         | the deploy app's client id                           |
| `AZURE_TENANT_ID`         | the bank's tenant id                                 |
| `AZURE_SUBSCRIPTION_ID`   | the AMIL subscription                                |
| `TFSTATE_RESOURCE_GROUP`  | `rg-amil-tfstate`                                    |
| `TFSTATE_STORAGE_ACCOUNT` | `<bankcode>amiltfstate`                              |
| `TFSTATE_CONTAINER`       | `tfstate`                                            |
| `TFVARS`                  | the environment's `terraform.tfvars` (example below) |

```hcl
subscription_id    = "<subscription id>"
bank_id            = "bank_<code>"
environment        = "uat"
name_suffix        = "<code>"
widget_origins     = ["https://app.uat.<bank-domain>"]
console_public_url = "https://amil-console.uat.<bank-domain>"
okta_issuer        = "https://<bank>.okta.com/oauth2/default"
okta_client_id     = "<from 1.6>"
console_key_id     = "<code>-console-key"
deploy_apps        = false
```

### 1.6 Okta (console sign-in, D-077)

1. **Create the app.** In Okta Admin, go to **Applications → Create App Integration → OIDC → Web
   Application**.
2. **Configure it:**
   - **Grant type:** Authorization Code only.
   - **Client authentication:** Client secret. Also turn on **Require PKCE as additional
     verification**.
   - **Sign-in redirect URI:** `https://amil-console.<env>.<bank-domain>/auth/okta/callback`.
   - **Assignments:** the group of staff who use AMIL.
3. **Issuer.** Use the authorization server you use for internal apps (for example
   `https://<bank>.okta.com/oauth2/default`). Make sure it issues `email` and `email_verified`.
4. **Record the values:**
   - the client id goes in `TFVARS`;
   - the client secret goes in Key Vault as `okta-client-secret` (step 3).

Okta proves who someone is; AMIL decides what they may do:

- The roles (admin, product, compliance, Sharia, viewer) stay in AMIL.
- A person can sign in only if their email is an active AMIL console user. The bootstrap sets
  the first ones; after that, admins manage the console's **Staff** page (D-081).
- When Okta is configured, the demo staff picker is off.

The console needs outbound HTTPS to the Okta domain. If egress goes through the bank's firewall,
allow it there.

### 1.7 Application Gateway (bank-owned)

Peer the AMIL VNet with the bank's hub, and link the AMIL private DNS zones (or forward to them).

Then route:

| Bank host name                                        | Backend (output)                | Notes                                                                          |
| ----------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| `amil.<env>.<bank-domain>` (API, widget calls)        | `api_fqdn` via `apps_static_ip` | Health probe `/readyz`; WAF on (OWASP CRS); TLS 1.2+; request body limit 64 KB |
| `amil-console.<env>.<bank-domain>` (staff, bank-only) | `console_fqdn`                  | Reachable from the bank's staff network only; health probe `/login`            |

For both routes, override the host header with the backend FQDN.

**mTLS (optional).** It is not required for pilots (D-078). If the bank wants it in addition to
HMAC, the Application Gateway can require client certificates on the API listener for the bank
backend's calls. The widget's browser calls then need a separate listener without client
certificates.

## 2. Stage 1: infrastructure

Run **Deploy (Azure Qatar Central)** with:

- environment: `uat`;
- `plan_only` on first, to review the plan; then off, to apply.

With `deploy_apps = false`, it creates the network, Key Vault with its keys, PostgreSQL, Redis,
the registry, the apps environment and placeholder secrets. There are no images yet, so it skips
the build.

If the first apply fails with `403` on a key or secret, the role assignment has not applied yet.
Run it again.

## 3. Secrets

From the runner (or a host with access), set every secret in the `secrets_to_populate` output:

```bash
kv=kv-amiluat<code>
new() { openssl rand -base64 48 | tr -d '\n'; }

bank_secret=$(new); console_secret=$(new)
az keyvault secret set --vault-name $kv -n amil-api-keys \
  --value "<code>-bank-key:${bank_secret}:bank_<code>,<code>-console-key:${console_secret}:bank_<code>:console"
az keyvault secret set --vault-name $kv -n console-key-secret --value "$console_secret"
az keyvault secret set --vault-name $kv -n session-secret --value "$(new)"
az keyvault secret set --vault-name $kv -n audit-hash-secret --value "$(new)"
az keyvault secret set --vault-name $kv -n okta-client-secret --value "<from Okta>"
az keyvault secret set --vault-name $kv -n bank-config --file bank-config.json
```

- **The bank key** (`<code>-bank-key` and `bank_secret`) goes to the bank's backend team for
  request signing (INTEGRATION_GUIDE.md). Share it through the bank's secret store, never by
  email.
- **`audit-hash-secret` must never change** once events exist: it keys every customer reference
  in the audit trail. Back it up with the bank's key escrow.
- **`bank-config`** comes from `infra/bank-config.example.json`, edited for the bank. It holds:
  - the bank's names, locales and brand;
  - its deep-link scheme;
  - severity thresholds;
  - the model mode (`off`, `in_country` or `redacted`);
  - the packs to install;
  - the first console users, with at least one compliance officer;
  - optionally, the fee schedule.

  Validate it locally first with `pnpm db:bootstrap` against a scratch database.

## 4. The application's database role

The API and worker connect as `amil_app`, which can read and write rows but run no DDL. The
schema owner, `amiladmin`, is used only by the migrate job.

From the runner, create the role once:

```bash
admin_pw=$(az keyvault secret show --vault-name $kv -n postgres-admin-password --query value -o tsv)
app_pw=$(openssl rand -hex 32)
PGPASSWORD=$admin_pw psql "host=<postgres_fqdn> dbname=amil user=amiladmin sslmode=require" \
  -v app_password="$app_pw" -f infra/sql/amil_app_role.sql
az keyvault secret set --vault-name $kv -n database-url \
  --value "postgresql://amil_app:${app_pw}@<postgres_fqdn>:5432/amil?schema=public&sslmode=require"
```

Default privileges cover the tables that migrations create later, so this can run before the
first migration.

## 5. Stage 2: first release

1. Set `deploy_apps = true` in `TFVARS`.
2. Run the workflow with `bootstrap` on.

The run then:

1. builds the `api`, `console` and `ops` images and pushes them, tagged with the commit;
2. plans, and writes a summary;
3. updates the jobs to the new image and runs **migrate** (D-079);
4. runs **bootstrap** (D-080), which adds:
   - the bank;
   - its console users;
   - every chosen pack, **switched off**;
   - the shipped copy, **in review**;
   - proactive schedules and fees.

   It adds no customer data;

5. applies the rest, creating the api, worker and console.

Check:

- `https://amil.uat.<bank-domain>/readyz` answers `200`, with PostgreSQL and Redis `ok`.
- The console's **Sign in with Okta** works for a bootstrapped user.

## 6. Before any customer sees AMIL

In the console:

1. **Pack terms (four eyes, D-074).** For each pack, product proposes the bank's real terms (for
   example the programme point value, the ibra policy, deposit break penalties) and compliance
   approves them.
2. **Copy (non-negotiable 8).** Compliance reviews the imported copy, and the Sharia reviewer
   reviews the Islamic copy.
3. **Switch packs on (D-075).** Compliance turns on each pack that is ready.
4. **Bank integration.** The bank's app team follows INTEGRATION_GUIDE.md: request signing,
   consent, sessions, the widget and deep links. The go-live checklist is at its end.

### The data feed

After the bootstrap, AMIL has no customers or products. Until the bank's data reaches AMIL's
store, checks answer `404 not_found` for the unknown customer. The widget then fires
`amil-unavailable`, and the bank's own flow continues unchanged.

Feeding that store is a separate workstream for each bank:

- **Sources:** product events (INTEGRATION_GUIDE.md §8) or a read-only replica.
- **Mapping:** each bank's core data is mapped to AMIL's schema.
- **PII:** encrypted with data keys wrapped by `pii_key_id` (D-066). The feed's identity is the
  only one granted that key.

Plan it with the bank's data team before the pilot date.

## 7. Releases

1. Merge to `main`, with CI green.
2. Run the workflow with `plan_only` on, and review the summary.
3. Run it again to apply. Approvers approve each run.

Migrations run before the new revisions and must be additive: expand first, and remove old
columns or tables in a later release. That way the running revision keeps working while they
run.

**Rollback.** Run the workflow from the previous commit (the images are still in the registry).
A migration is never rolled back. Fix forward.

## 8. Operations

| Task                       | How                                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rotate the bank's HMAC key | Add the new key next to the old one in `amil-api-keys`, restart the api, let the bank switch, then remove the old key                                                                                  |
| Rotate other secrets       | `az keyvault secret set`, then `az containerapp revision restart` for the apps that read it. Never rotate `audit-hash-secret`                                                                          |
| Turn a pack off now        | Console kill switch: product, compliance or admin, with a reason. Turning it back on is compliance only (D-075)                                                                                        |
| Verify the audit chain     | Console **Audit → Verify hash chain**, or from the runner: `docker run --rm -e DATABASE_URL=<database-url-migrate> <registry>/ops:<tag> node_modules/.bin/tsx src/scripts/verify-audit.ts bank_<code>` |
| Restore the database       | Point-in-time restore (35 days) to a new server in Qatar Central, then update `database-url` and `database-url-migrate`                                                                                |
| Logs and traces            | Log Analytics (`ContainerAppConsoleLogs_CL`). Logs carry no customer references, figures or text (D-070); traces go to `otel_endpoint`                                                                 |

## 9. Troubleshooting

| Symptom                                                   | Cause and fix                                                                                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| The app revision fails with `Invalid environment`         | A secret is still `set-me`. Check every secret in `secrets_to_populate`                                                                     |
| The image pull fails                                      | The runner pushed to the wrong registry, or AcrPull has not applied yet. Restart the revision                                               |
| Migrate fails with `permission denied for schema public`  | The `amil` database is not owned by the admin's group. As `amiladmin`: `GRANT CREATE ON SCHEMA public TO amiladmin;` (or ask Azure support) |
| Okta sign-in returns "not set up as an AMIL console user" | The email is not an active console user of this bank. An admin adds or reactivates it on the console's **Staff** page                       |
| Okta sign-in fails right away                             | Check that the redirect URI exactly matches `CONSOLE_PUBLIC_URL` + `/auth/okta/callback`, and that egress to Okta is allowed                |
| Checks return `kind: none`, or `404` for every customer   | `none`: packs are still off, or their copy is not approved. `404`: the data feed has not loaded that customer yet (section 6)               |
