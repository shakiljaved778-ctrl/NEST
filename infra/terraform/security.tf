# ── Identities: one per workload, least privilege. ──

resource "azurerm_user_assigned_identity" "svc" {
  for_each            = toset(["api", "worker", "console", "ops", "postgres"])
  name                = "id-${local.name}-${each.value}"
  location            = azurerm_resource_group.amil.location
  resource_group_name = azurerm_resource_group.amil.name
  tags                = local.tags
}

# ── Key Vault (RBAC, purge protection, private endpoint). HSM-backed keys need premium. ──

resource "azurerm_key_vault" "amil" {
  name                          = "kv-${local.unique}"
  location                      = azurerm_resource_group.amil.location
  resource_group_name           = azurerm_resource_group.amil.name
  tenant_id                     = data.azurerm_client_config.current.tenant_id
  sku_name                      = "premium"
  rbac_authorization_enabled    = true
  purge_protection_enabled      = true
  soft_delete_retention_days    = 90
  public_network_access_enabled = length(var.operator_ip_ranges) > 0
  tags                          = local.tags

  network_acls {
    default_action = "Deny"
    bypass         = "AzureServices"
    ip_rules       = var.operator_ip_ranges
  }
}

resource "azurerm_private_endpoint" "vault" {
  name                = "pe-${local.name}-vault"
  location            = azurerm_resource_group.amil.location
  resource_group_name = azurerm_resource_group.amil.name
  subnet_id           = azurerm_subnet.endpoints.id
  tags                = local.tags

  private_service_connection {
    name                           = "vault"
    private_connection_resource_id = azurerm_key_vault.amil.id
    subresource_names              = ["vault"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "vault"
    private_dns_zone_ids = [azurerm_private_dns_zone.zone["vault"].id]
  }
}

# Whoever runs Terraform manages keys and secrets (data plane). Role assignments can take a few
# minutes to apply: if the first apply fails with 403 on a key or secret, run it again.
resource "azurerm_role_assignment" "deployer_vault" {
  scope                = azurerm_key_vault.amil.id
  role_definition_name = "Key Vault Administrator"
  principal_id         = data.azurerm_client_config.current.object_id
}

# ── Keys: the PII envelope key (D-066) and the database CMEK. In-country, HSM-backed. ──

resource "azurerm_key_vault_key" "pii" {
  name         = "pii-envelope"
  key_vault_id = azurerm_key_vault.amil.id
  key_type     = "RSA-HSM"
  key_size     = 3072
  key_opts     = ["wrapKey", "unwrapKey"]
  tags         = local.tags
  depends_on   = [azurerm_role_assignment.deployer_vault]

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_key_vault_key" "postgres" {
  name         = "postgres-cmek"
  key_vault_id = azurerm_key_vault.amil.id
  key_type     = "RSA-HSM"
  key_size     = 3072
  key_opts     = ["wrapKey", "unwrapKey"]
  tags         = local.tags
  depends_on   = [azurerm_role_assignment.deployer_vault]

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_role_assignment" "postgres_cmek" {
  scope                = azurerm_key_vault_key.postgres.resource_versionless_id
  role_definition_name = "Key Vault Crypto Service Encryption User"
  principal_id         = azurerm_user_assigned_identity.svc["postgres"].principal_id
}

# ── Secrets. Terraform writes only what it derives from resources it creates (connection
# strings, the break-glass admin password). Everything the bank issues or must share (HMAC keys,
# session and audit-hash secrets, the Okta client secret, model keys, the bank config) starts as
# a placeholder and is set out of band, so its value never enters Terraform state. ──

locals {
  operator_secrets = concat(
    [
      "database-url",       # DATABASE_URL for the API and worker (the least-privilege amil_app role)
      "amil-api-keys",      # AMIL_API_KEYS: the bank key and the console key (D-067)
      "session-secret",     # SESSION_SECRET
      "audit-hash-secret",  # AUDIT_HASH_SECRET: never change it once events exist
      "console-key-secret", # AMIL_CONSOLE_KEY_SECRET (the console key's secret)
      "okta-client-secret", # OKTA_CLIENT_SECRET (D-077)
      "bank-config",        # the bootstrap config (infra/bank-config.example.json, D-080)
    ],
    var.hosted_model_enabled ? ["anthropic-api-key"] : [],
    var.in_country_model_url != "" ? ["in-country-model-api-key"] : [],
  )

  # Which secrets each workload may read. The console never sees data-store credentials,
  # model keys or the PII key; no AMIL workload can use the PII key at all (D-066).
  model_secrets = concat(
    var.hosted_model_enabled ? ["anthropic-api-key"] : [],
    var.in_country_model_url != "" ? ["in-country-model-api-key"] : [],
  )
  backend_secrets = concat(
    ["database-url", "redis-url", "amil-api-keys", "session-secret", "audit-hash-secret"],
    local.model_secrets,
  )
  secret_access = {
    api     = local.backend_secrets
    worker  = local.backend_secrets
    console = ["console-key-secret", "okta-client-secret"]
    ops     = ["database-url-migrate", "bank-config"]
  }
  secret_bindings = flatten([
    for svc, names in local.secret_access : [for s in names : { svc = svc, secret = s }]
  ])
}

resource "azurerm_key_vault_secret" "operator" {
  for_each     = toset(local.operator_secrets)
  name         = each.value
  value        = "set-me"
  key_vault_id = azurerm_key_vault.amil.id
  content_type = "operator-managed"
  tags         = local.tags
  depends_on   = [azurerm_role_assignment.deployer_vault]

  lifecycle {
    ignore_changes = [value, content_type, tags]
  }
}

resource "random_password" "postgres_admin" {
  length  = 40
  special = false # URL-safe in connection strings
}

resource "azurerm_key_vault_secret" "derived" {
  for_each = {
    "postgres-admin-password" = random_password.postgres_admin.result
    # Migrations run as the server admin, which owns the schema; the apps use amil_app.
    "database-url-migrate" = "postgresql://${azurerm_postgresql_flexible_server.amil.administrator_login}:${random_password.postgres_admin.result}@${azurerm_postgresql_flexible_server.amil.fqdn}:5432/amil?schema=public&sslmode=require"
    "redis-url"            = "rediss://:${azurerm_redis_cache.amil.primary_access_key}@${azurerm_redis_cache.amil.hostname}:${azurerm_redis_cache.amil.ssl_port}"
  }
  name         = each.key
  value        = each.value
  key_vault_id = azurerm_key_vault.amil.id
  content_type = "terraform-managed"
  tags         = local.tags
  depends_on   = [azurerm_role_assignment.deployer_vault]
}

locals {
  secret_ids = merge(
    { for k, s in azurerm_key_vault_secret.operator : k => s },
    { for k, s in azurerm_key_vault_secret.derived : k => s },
  )
}

resource "azurerm_role_assignment" "secret_access" {
  for_each             = { for b in local.secret_bindings : "${b.svc}/${b.secret}" => b }
  scope                = local.secret_ids[each.value.secret].resource_versionless_id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.svc[each.value.svc].principal_id
}
