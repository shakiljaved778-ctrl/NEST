# Plan-level checks with mocked providers (no Azure credentials needed): residency guards, the
# two-stage apply, and who may read which secret. Run: terraform init -backend=false && terraform test
mock_provider "azurerm" {
  mock_data "azurerm_client_config" {
    defaults = {
      tenant_id = "11111111-1111-1111-1111-111111111111"
      object_id = "22222222-2222-2222-2222-222222222222"
    }
  }
}
mock_provider "random" {}

variables {
  subscription_id    = "00000000-0000-0000-0000-000000000000"
  bank_id            = "bank_test"
  name_suffix        = "tst"
  widget_origins     = ["https://app.bank.example"]
  console_public_url = "https://console.bank.example"
  okta_issuer        = "https://bank.okta.com/oauth2/default"
  okta_client_id     = "client"
  console_key_id     = "tst-console-key"
}

run "stage_one_creates_no_apps" {
  command = plan

  assert {
    condition     = length(azurerm_container_app.api) == 0 && length(azurerm_container_app_job.ops) == 0
    error_message = "Stage 1 must not create apps or jobs before secrets are set."
  }

  assert {
    condition     = azurerm_resource_group.amil.location == "qatarcentral"
    error_message = "Everything is pinned to Qatar Central."
  }

  assert {
    condition     = azurerm_postgresql_flexible_server.amil.geo_redundant_backup_enabled == false && azurerm_postgresql_flexible_server.amil.public_network_access_enabled == false
    error_message = "Postgres backups stay in-country and the server is private."
  }

  assert {
    condition     = azurerm_redis_cache.amil.non_ssl_port_enabled == false && azurerm_redis_cache.amil.public_network_access_enabled == false
    error_message = "Redis is TLS-only and private."
  }

  assert {
    condition     = azurerm_key_vault.amil.public_network_access_enabled == false && azurerm_container_registry.amil.public_network_access_enabled == false
    error_message = "Without operator IPs, Key Vault and the registry are private-only."
  }

  assert {
    condition     = !contains(local.operator_secrets, "anthropic-api-key")
    error_message = "The hosted model key exists only when explicitly enabled."
  }
}

run "stage_two_creates_apps_and_jobs" {
  command = plan

  variables {
    deploy_apps = true
    image_tag   = "2026.10.15-abc1234"
  }

  assert {
    condition     = length(azurerm_container_app.api) == 1 && length(azurerm_container_app.worker) == 1 && length(azurerm_container_app.console) == 1
    error_message = "Stage 2 creates the api, worker and console."
  }

  assert {
    condition     = toset(keys(azurerm_container_app_job.ops)) == toset(["migrate", "bootstrap"])
    error_message = "Stage 2 creates the migrate and bootstrap jobs."
  }

  assert {
    condition     = azurerm_container_app.worker[0].template[0].max_replicas == 1
    error_message = "Exactly one worker runs the BullMQ schedules."
  }

  assert {
    condition     = azurerm_container_app_environment.amil.internal_load_balancer_enabled == true
    error_message = "The apps environment has no public endpoint."
  }
}

run "least_privilege_secrets" {
  command = plan

  assert {
    condition     = length(setintersection(toset(local.secret_access.console), toset(["database-url", "redis-url", "amil-api-keys", "database-url-migrate"]))) == 0
    error_message = "The console reads no data-store credentials or bank keys."
  }

  assert {
    condition     = toset(local.secret_access.ops) == toset(["database-url-migrate", "bank-config"])
    error_message = "The ops jobs read only the migration URL and the bank config."
  }

  assert {
    condition     = !contains(local.secret_access.api, "database-url-migrate")
    error_message = "The API never holds the schema owner's credentials."
  }
}

run "hosted_model_is_opt_in" {
  command = plan

  variables {
    hosted_model_enabled = true
  }

  assert {
    condition     = contains(local.secret_access.api, "anthropic-api-key") && !contains(local.secret_access.console, "anthropic-api-key")
    error_message = "Only the API and worker get the hosted model key, and only when enabled."
  }
}

run "rejects_other_regions" {
  command = plan

  variables {
    location = "uaenorth"
  }

  expect_failures = [var.location]
}
