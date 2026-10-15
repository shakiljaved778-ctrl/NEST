# ── PostgreSQL 16: private (VNet-integrated), TLS only, CMEK, backups kept in Qatar Central. ──

resource "azurerm_postgresql_flexible_server" "amil" {
  name                          = "psql-${local.unique}"
  location                      = azurerm_resource_group.amil.location
  resource_group_name           = azurerm_resource_group.amil.name
  version                       = "16"
  sku_name                      = var.postgres_sku
  storage_mb                    = var.postgres_storage_mb
  auto_grow_enabled             = true
  backup_retention_days         = 35
  geo_redundant_backup_enabled  = false # backups must not leave the country
  delegated_subnet_id           = azurerm_subnet.postgres.id
  private_dns_zone_id           = azurerm_private_dns_zone.zone["postgres"].id
  public_network_access_enabled = false
  administrator_login           = "amiladmin"
  administrator_password        = random_password.postgres_admin.result
  zone                          = "1"
  tags                          = local.tags

  dynamic "high_availability" {
    for_each = local.prod ? [1] : []
    content {
      mode = "ZoneRedundant"
    }
  }

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.svc["postgres"].id]
  }

  customer_managed_key {
    key_vault_key_id                  = azurerm_key_vault_key.postgres.id
    primary_user_assigned_identity_id = azurerm_user_assigned_identity.svc["postgres"].id
  }

  # Fridays 01:00 UTC (04:00 in Doha), the quietest hour for a Qatari retail bank.
  maintenance_window {
    day_of_week  = 5
    start_hour   = 1
    start_minute = 0
  }

  depends_on = [
    azurerm_private_dns_zone_virtual_network_link.zone,
    azurerm_role_assignment.postgres_cmek,
  ]

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [zone, high_availability[0].standby_availability_zone]
  }
}

resource "azurerm_postgresql_flexible_server_database" "amil" {
  name      = "amil"
  server_id = azurerm_postgresql_flexible_server.amil.id
  charset   = "UTF8"
  collation = "en_US.utf8"

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_postgresql_flexible_server_configuration" "settings" {
  for_each = {
    require_secure_transport   = "on"
    ssl_min_protocol_version   = "TLSv1.2"
    log_min_duration_statement = "1000"
  }
  name      = each.key
  server_id = azurerm_postgresql_flexible_server.amil.id
  value     = each.value
}

# ── Redis (BullMQ schedules, rate-limit counters, replay store): TLS only, private. ──
# Microsoft is moving Azure Cache for Redis customers to Azure Managed Redis; switch once it is
# offered in Qatar Central. The app only needs a rediss:// URL.

resource "azurerm_redis_cache" "amil" {
  name                          = "redis-${local.unique}"
  location                      = azurerm_resource_group.amil.location
  resource_group_name           = azurerm_resource_group.amil.name
  sku_name                      = local.prod ? "Premium" : "Standard"
  family                        = local.prod ? "P" : "C"
  capacity                      = 1
  redis_version                 = "6"
  non_ssl_port_enabled          = false
  minimum_tls_version           = "1.2"
  public_network_access_enabled = false
  zones                         = local.prod ? ["1", "2", "3"] : null
  tags                          = local.tags

  redis_configuration {
    maxmemory_policy = "noeviction" # BullMQ must never lose a job key
  }
}

resource "azurerm_private_endpoint" "redis" {
  name                = "pe-${local.name}-redis"
  location            = azurerm_resource_group.amil.location
  resource_group_name = azurerm_resource_group.amil.name
  subnet_id           = azurerm_subnet.endpoints.id
  tags                = local.tags

  private_service_connection {
    name                           = "redis"
    private_connection_resource_id = azurerm_redis_cache.amil.id
    subresource_names              = ["redisCache"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "redis"
    private_dns_zone_ids = [azurerm_private_dns_zone.zone["redis"].id]
  }
}

# ── Container registry: Premium for private endpoints; no admin user, no anonymous pull. ──

resource "azurerm_container_registry" "amil" {
  name                          = "cr${local.unique}"
  location                      = azurerm_resource_group.amil.location
  resource_group_name           = azurerm_resource_group.amil.name
  sku                           = "Premium"
  admin_enabled                 = false
  anonymous_pull_enabled        = false
  public_network_access_enabled = length(var.operator_ip_ranges) > 0
  network_rule_bypass_option    = "AzureServices"
  zone_redundancy_enabled       = local.prod
  tags                          = local.tags

  network_rule_set {
    default_action = "Deny"

    ip_rule = [for cidr in var.operator_ip_ranges : { action = "Allow", ip_range = cidr }]
  }
}

resource "azurerm_private_endpoint" "registry" {
  name                = "pe-${local.name}-registry"
  location            = azurerm_resource_group.amil.location
  resource_group_name = azurerm_resource_group.amil.name
  subnet_id           = azurerm_subnet.endpoints.id
  tags                = local.tags

  private_service_connection {
    name                           = "registry"
    private_connection_resource_id = azurerm_container_registry.amil.id
    subresource_names              = ["registry"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "registry"
    private_dns_zone_ids = [azurerm_private_dns_zone.zone["registry"].id]
  }
}

resource "azurerm_role_assignment" "acr_pull" {
  for_each             = toset(["api", "worker", "console", "ops"])
  scope                = azurerm_container_registry.amil.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.svc[each.value].principal_id
}

# The deploy workflow (the same principal that runs Terraform) pushes images.
resource "azurerm_role_assignment" "deployer_acr_push" {
  scope                = azurerm_container_registry.amil.id
  role_definition_name = "AcrPush"
  principal_id         = data.azurerm_client_config.current.object_id
}
