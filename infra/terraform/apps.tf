# ── Container Apps: an internal environment (no public IP). The bank's Application Gateway
# (WAF, TLS, its DNS names) sits in front of the API and the console; the widget reaches the API
# through the bank's edge. Created in stage 2 (deploy_apps = true). ──

resource "azurerm_container_app_environment" "amil" {
  name                               = "cae-${local.name}"
  location                           = azurerm_resource_group.amil.location
  resource_group_name                = azurerm_resource_group.amil.name
  log_analytics_workspace_id         = azurerm_log_analytics_workspace.amil.id
  infrastructure_subnet_id           = azurerm_subnet.apps.id
  infrastructure_resource_group_name = "rg-${local.name}-apps-infra"
  internal_load_balancer_enabled     = true
  zone_redundancy_enabled            = local.prod
  tags                               = local.tags

  workload_profile {
    name                  = "Consumption"
    workload_profile_type = "Consumption"
  }
}

# The environment's apps resolve inside the VNet (and the bank's hub, once linked).
resource "azurerm_private_dns_zone" "apps" {
  name                = azurerm_container_app_environment.amil.default_domain
  resource_group_name = azurerm_resource_group.amil.name
  tags                = local.tags
}

resource "azurerm_private_dns_a_record" "apps" {
  name                = "*"
  zone_name           = azurerm_private_dns_zone.apps.name
  resource_group_name = azurerm_resource_group.amil.name
  ttl                 = 300
  records             = [azurerm_container_app_environment.amil.static_ip_address]
}

resource "azurerm_private_dns_zone_virtual_network_link" "apps" {
  name                  = "link-apps"
  resource_group_name   = azurerm_resource_group.amil.name
  private_dns_zone_name = azurerm_private_dns_zone.apps.name
  virtual_network_id    = azurerm_virtual_network.amil.id
  tags                  = local.tags
}

locals {
  registry = azurerm_container_registry.amil.login_server

  # Key Vault secret -> environment variable, per workload.
  secret_env = {
    "database-url"             = "DATABASE_URL"
    "database-url-migrate"     = "DATABASE_URL"
    "redis-url"                = "REDIS_URL"
    "amil-api-keys"            = "AMIL_API_KEYS"
    "session-secret"           = "SESSION_SECRET"
    "audit-hash-secret"        = "AUDIT_HASH_SECRET"
    "anthropic-api-key"        = "ANTHROPIC_API_KEY"
    "in-country-model-api-key" = "IN_COUNTRY_API_KEY"
    "console-key-secret"       = "AMIL_CONSOLE_KEY_SECRET"
    "okta-client-secret"       = "OKTA_CLIENT_SECRET"
  }

  backend_env = merge(
    {
      NODE_ENV       = "production"
      API_PORT       = "4000"
      WIDGET_ORIGINS = join(",", var.widget_origins)
    },
    var.otel_endpoint != "" ? { OTEL_EXPORTER_OTLP_ENDPOINT = var.otel_endpoint } : {},
    var.in_country_model_url != "" ? { IN_COUNTRY_MODEL_URL = var.in_country_model_url } : {},
  )

  # Everything a secret-reading workload needs to wait for before its first revision.
  app_prerequisites = [azurerm_role_assignment.secret_access, azurerm_role_assignment.acr_pull]
}

resource "azurerm_container_app" "api" {
  count                        = var.deploy_apps ? 1 : 0
  name                         = "ca-${local.name}-api"
  container_app_environment_id = azurerm_container_app_environment.amil.id
  resource_group_name          = azurerm_resource_group.amil.name
  revision_mode                = "Single"
  workload_profile_name        = "Consumption"
  tags                         = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.svc["api"].id]
  }

  registry {
    server   = local.registry
    identity = azurerm_user_assigned_identity.svc["api"].id
  }

  dynamic "secret" {
    for_each = toset(local.secret_access.api)
    content {
      name                = secret.value
      key_vault_secret_id = local.secret_ids[secret.value].versionless_id
      identity            = azurerm_user_assigned_identity.svc["api"].id
    }
  }

  # "External" here means reachable from the VNet: the environment itself is internal.
  ingress {
    external_enabled           = true
    target_port                = 4000
    transport                  = "auto"
    allow_insecure_connections = false

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = local.prod ? 2 : 1
    max_replicas = 10

    container {
      name   = "api"
      image  = "${local.registry}/api:${var.image_tag}"
      cpu    = 1
      memory = "2Gi"

      dynamic "env" {
        for_each = local.backend_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = toset(local.secret_access.api)
        content {
          name        = local.secret_env[env.value]
          secret_name = env.value
        }
      }

      readiness_probe {
        transport = "HTTP"
        port      = 4000
        path      = "/readyz"
      }

      liveness_probe {
        transport = "HTTP"
        port      = 4000
        path      = "/healthz"
      }
    }

    http_scale_rule {
      name                = "http"
      concurrent_requests = "50"
    }
  }

  depends_on = [local.app_prerequisites]
}

# Proactive packs on BullMQ schedules: exactly one always-on replica.
resource "azurerm_container_app" "worker" {
  count                        = var.deploy_apps ? 1 : 0
  name                         = "ca-${local.name}-worker"
  container_app_environment_id = azurerm_container_app_environment.amil.id
  resource_group_name          = azurerm_resource_group.amil.name
  revision_mode                = "Single"
  workload_profile_name        = "Consumption"
  tags                         = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.svc["worker"].id]
  }

  registry {
    server   = local.registry
    identity = azurerm_user_assigned_identity.svc["worker"].id
  }

  dynamic "secret" {
    for_each = toset(local.secret_access.worker)
    content {
      name                = secret.value
      key_vault_secret_id = local.secret_ids[secret.value].versionless_id
      identity            = azurerm_user_assigned_identity.svc["worker"].id
    }
  }

  template {
    min_replicas = 1
    max_replicas = 1

    container {
      name    = "worker"
      image   = "${local.registry}/api:${var.image_tag}"
      command = ["node", "dist/worker.js"]
      cpu     = 0.5
      memory  = "1Gi"

      dynamic "env" {
        for_each = local.backend_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = toset(local.secret_access.worker)
        content {
          name        = local.secret_env[env.value]
          secret_name = env.value
        }
      }
    }
  }

  depends_on = [local.app_prerequisites]
}

# The bank console: Okta sign-in (D-077); reads no data-store credentials.
resource "azurerm_container_app" "console" {
  count                        = var.deploy_apps ? 1 : 0
  name                         = "ca-${local.name}-console"
  container_app_environment_id = azurerm_container_app_environment.amil.id
  resource_group_name          = azurerm_resource_group.amil.name
  revision_mode                = "Single"
  workload_profile_name        = "Consumption"
  tags                         = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.svc["console"].id]
  }

  registry {
    server   = local.registry
    identity = azurerm_user_assigned_identity.svc["console"].id
  }

  dynamic "secret" {
    for_each = toset(local.secret_access.console)
    content {
      name                = secret.value
      key_vault_secret_id = local.secret_ids[secret.value].versionless_id
      identity            = azurerm_user_assigned_identity.svc["console"].id
    }
  }

  ingress {
    external_enabled           = true
    target_port                = 3001
    transport                  = "auto"
    allow_insecure_connections = false

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 1
    max_replicas = 3

    container {
      name   = "console"
      image  = "${local.registry}/console:${var.image_tag}"
      cpu    = 0.5
      memory = "1Gi"

      dynamic "env" {
        for_each = {
          NODE_ENV            = "production"
          AMIL_API_URL        = "https://${azurerm_container_app.api[0].ingress[0].fqdn}"
          AMIL_CONSOLE_KEY_ID = var.console_key_id
          OKTA_ISSUER         = var.okta_issuer
          OKTA_CLIENT_ID      = var.okta_client_id
          CONSOLE_PUBLIC_URL  = var.console_public_url
        }
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = toset(local.secret_access.console)
        content {
          name        = local.secret_env[env.value]
          secret_name = env.value
        }
      }

      readiness_probe {
        transport = "HTTP"
        port      = 3001
        path      = "/login"
      }
    }
  }

  depends_on = [local.app_prerequisites]
}

# ── One-off jobs from the ops image (D-079): migrations before each release, and the bank
# bootstrap (D-080) once. Start with `az containerapp job start`. ──

resource "azurerm_container_app_job" "ops" {
  for_each = var.deploy_apps ? {
    migrate   = null
    bootstrap = ["node_modules/.bin/tsx", "src/scripts/bootstrap-bank.ts", "/config/bank-config"]
  } : {}
  name                         = "caj-${local.name}-${each.key}"
  location                     = azurerm_resource_group.amil.location
  resource_group_name          = azurerm_resource_group.amil.name
  container_app_environment_id = azurerm_container_app_environment.amil.id
  workload_profile_name        = "Consumption"
  replica_timeout_in_seconds   = 1800
  replica_retry_limit          = 0
  tags                         = local.tags

  manual_trigger_config {
    parallelism              = 1
    replica_completion_count = 1
  }

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.svc["ops"].id]
  }

  registry {
    server   = local.registry
    identity = azurerm_user_assigned_identity.svc["ops"].id
  }

  dynamic "secret" {
    for_each = toset(local.secret_access.ops)
    content {
      name                = secret.value
      key_vault_secret_id = local.secret_ids[secret.value].versionless_id
      identity            = azurerm_user_assigned_identity.svc["ops"].id
    }
  }

  template {
    container {
      name    = each.key
      image   = "${local.registry}/ops:${var.image_tag}"
      command = each.value
      cpu     = 0.5
      memory  = "1Gi"

      env {
        name        = "DATABASE_URL"
        secret_name = "database-url-migrate"
      }

      volume_mounts {
        name = "config"
        path = "/config"
      }
    }

    # The job's secrets as files; the bootstrap reads /config/bank-config.
    volume {
      name         = "config"
      storage_type = "Secret"
    }
  }

  depends_on = [local.app_prerequisites]
}
