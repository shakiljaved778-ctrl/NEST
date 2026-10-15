# AMIL on Azure Qatar Central (D-073): one bank per subscription, everything in-country, every
# data store private. A starting point for the bank's platform team: review networking, IAM,
# backups and monitoring against the bank's own standards before use.

locals {
  name = "amil-${var.environment}"
  # Globally unique names (no dashes for Key Vault-safe and registry-safe forms).
  unique = "amil${var.environment}${var.name_suffix}"
  prod   = var.environment == "prod"
  tags = merge(var.tags, {
    app         = "amil"
    bank        = var.bank_id
    environment = var.environment
    residency   = "qatar"
  })
}

data "azurerm_client_config" "current" {}

resource "azurerm_resource_group" "amil" {
  name     = "rg-${local.name}"
  location = var.location
  tags     = local.tags
}

resource "azurerm_log_analytics_workspace" "amil" {
  name                = "log-${local.name}"
  location            = azurerm_resource_group.amil.location
  resource_group_name = azurerm_resource_group.amil.name
  sku                 = "PerGB2018"
  retention_in_days   = 90
  tags                = local.tags
}

# ── Network: three subnets. Apps (Container Apps), Postgres (delegated), private endpoints. ──

resource "azurerm_virtual_network" "amil" {
  name                = "vnet-${local.name}"
  location            = azurerm_resource_group.amil.location
  resource_group_name = azurerm_resource_group.amil.name
  address_space       = [var.vnet_cidr]
  tags                = local.tags
}

resource "azurerm_subnet" "apps" {
  name                 = "snet-apps"
  resource_group_name  = azurerm_resource_group.amil.name
  virtual_network_name = azurerm_virtual_network.amil.name
  address_prefixes     = [cidrsubnet(var.vnet_cidr, 7, 0)] # /23

  delegation {
    name = "container-apps"
    service_delegation {
      name    = "Microsoft.App/environments"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "postgres" {
  name                 = "snet-postgres"
  resource_group_name  = azurerm_resource_group.amil.name
  virtual_network_name = azurerm_virtual_network.amil.name
  address_prefixes     = [cidrsubnet(var.vnet_cidr, 8, 2)] # /24

  delegation {
    name = "postgres"
    service_delegation {
      name    = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "endpoints" {
  name                 = "snet-endpoints"
  resource_group_name  = azurerm_resource_group.amil.name
  virtual_network_name = azurerm_virtual_network.amil.name
  address_prefixes     = [cidrsubnet(var.vnet_cidr, 8, 3)] # /24
}

# Private DNS for Postgres and the private endpoints, linked to the VNet. When the bank peers
# this VNet with its hub, link these zones to the hub's DNS too (or forward to them).
locals {
  private_dns_zones = {
    postgres = "${local.name}.private.postgres.database.azure.com"
    vault    = "privatelink.vaultcore.azure.net"
    redis    = "privatelink.redis.cache.windows.net"
    registry = "privatelink.azurecr.io"
  }
}

resource "azurerm_private_dns_zone" "zone" {
  for_each            = local.private_dns_zones
  name                = each.value
  resource_group_name = azurerm_resource_group.amil.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "zone" {
  for_each              = local.private_dns_zones
  name                  = "link-${each.key}"
  resource_group_name   = azurerm_resource_group.amil.name
  private_dns_zone_name = azurerm_private_dns_zone.zone[each.key].name
  virtual_network_id    = azurerm_virtual_network.amil.id
  registration_enabled  = false
  tags                  = local.tags
}
