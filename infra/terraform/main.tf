# AMIL single-tenant deployment skeleton (D-071). One bank per project; everything in-country.
# This is a starting point for a bank's platform team, not a turnkey production stack: review
# networking, IAM, backups and monitoring against the bank's own standards.

locals {
  name   = "amil-${var.environment}"
  labels = { app = "amil", bank = replace(var.bank_id, "_", "-"), environment = var.environment }
  image  = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.amil.repository_id}"
  # Secrets are created here; their values are added out of band (never in Terraform state).
  secrets = [
    "amil-api-keys",         # AMIL_API_KEYS (bank and console keys, D-067)
    "session-secret",        # SESSION_SECRET
    "audit-hash-secret",     # AUDIT_HASH_SECRET
    "pii-wrapped-data-keys", # data keys wrapped by the KMS key below (D-066)
    "anthropic-api-key",     # only when model_mode = redacted with a hosted model
    "in-country-model-api-key",
  ]
}

resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudkms.googleapis.com",
    "artifactregistry.googleapis.com",
    "vpcaccess.googleapis.com",
    "servicenetworking.googleapis.com",
    "compute.googleapis.com",
  ])
  service            = each.value
  disable_on_destroy = false
}

# ── Network: private only. Postgres and Redis have no public IPs. ──

resource "google_compute_network" "amil" {
  name                    = local.name
  auto_create_subnetworks = false
  depends_on              = [google_project_service.apis]
}

resource "google_compute_subnetwork" "amil" {
  name                     = local.name
  network                  = google_compute_network.amil.id
  region                   = var.region
  ip_cidr_range            = "10.10.0.0/24"
  private_ip_google_access = true
}

resource "google_compute_global_address" "private_services" {
  name          = "${local.name}-private-services"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 20
  network       = google_compute_network.amil.id
}

resource "google_service_networking_connection" "private_services" {
  network                 = google_compute_network.amil.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_services.name]
}

resource "google_vpc_access_connector" "amil" {
  name          = "amil-${var.environment}"
  region        = var.region
  network       = google_compute_network.amil.name
  ip_cidr_range = "10.10.8.0/28"
  depends_on    = [google_project_service.apis]
}

# ── Keys: the PII envelope key and the database CMEK, both in-country, rotated yearly. ──

resource "google_kms_key_ring" "amil" {
  name       = local.name
  location   = var.region
  depends_on = [google_project_service.apis]
}

resource "google_kms_crypto_key" "pii" {
  name            = "pii-envelope"
  key_ring        = google_kms_key_ring.amil.id
  purpose         = "ENCRYPT_DECRYPT"
  rotation_period = "31536000s"
  labels          = local.labels

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_kms_crypto_key" "database" {
  name            = "database-cmek"
  key_ring        = google_kms_key_ring.amil.id
  purpose         = "ENCRYPT_DECRYPT"
  rotation_period = "31536000s"
  labels          = local.labels

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_project_service_identity" "sql" {
  provider = google-beta
  project  = var.project_id
  service  = "sqladmin.googleapis.com"
}

resource "google_kms_crypto_key_iam_member" "sql_cmek" {
  crypto_key_id = google_kms_crypto_key.database.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${google_project_service_identity.sql.email}"
}

# ── Data stores ──

resource "google_sql_database_instance" "amil" {
  name                = local.name
  database_version    = "POSTGRES_16"
  region              = var.region
  encryption_key_name = google_kms_crypto_key.database.id
  deletion_protection = true
  depends_on          = [google_service_networking_connection.private_services, google_kms_crypto_key_iam_member.sql_cmek]

  settings {
    tier              = var.db_tier
    availability_type = var.environment == "prod" ? "REGIONAL" : "ZONAL"
    user_labels       = local.labels

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.amil.id
      ssl_mode        = "ENCRYPTED_ONLY"
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      location                       = var.region
      backup_retention_settings {
        retained_backups = 30
      }
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = "1000"
    }
  }
}

resource "google_sql_database" "amil" {
  name     = "amil"
  instance = google_sql_database_instance.amil.name
}

resource "google_redis_instance" "amil" {
  name                    = local.name
  region                  = var.region
  tier                    = var.environment == "prod" ? "STANDARD_HA" : "BASIC"
  memory_size_gb          = 1
  redis_version           = "REDIS_7_2"
  authorized_network      = google_compute_network.amil.id
  connect_mode            = "PRIVATE_SERVICE_ACCESS"
  auth_enabled            = true
  transit_encryption_mode = "SERVER_AUTHENTICATION"
  labels                  = local.labels
  depends_on              = [google_service_networking_connection.private_services]
}

# ── Images and secrets ──

resource "google_artifact_registry_repository" "amil" {
  location      = var.region
  repository_id = "amil"
  format        = "DOCKER"
  labels        = local.labels
  depends_on    = [google_project_service.apis]
}

resource "google_secret_manager_secret" "secret" {
  for_each  = toset(local.secrets)
  secret_id = "${local.name}-${each.value}"
  labels    = local.labels

  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }
  depends_on = [google_project_service.apis]
}

# ── Service accounts: one per service, least privilege. ──

resource "google_service_account" "svc" {
  for_each     = toset(["api", "worker", "console", "migrate"])
  account_id   = "amil-${var.environment}-${each.value}"
  display_name = "AMIL ${each.value} (${var.environment})"
}

locals {
  # Which secrets each service may read. The console never sees PII keys or the model key.
  secret_access = {
    api     = ["database-url", "redis-url", "amil-api-keys", "session-secret", "audit-hash-secret", "anthropic-api-key", "in-country-model-api-key"]
    worker  = ["database-url", "redis-url", "amil-api-keys", "session-secret", "audit-hash-secret", "anthropic-api-key", "in-country-model-api-key"]
    console = []
    migrate = ["database-url"]
  }
  secret_bindings = flatten([
    for svc, list in local.secret_access : [for s in list : { svc = svc, secret = s }]
  ])
}

resource "google_secret_manager_secret_iam_member" "access" {
  for_each  = { for b in local.secret_bindings : "${b.svc}/${b.secret}" => b }
  secret_id = google_secret_manager_secret.secret[each.value.secret].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.svc[each.value.svc].email}"
}

resource "google_project_iam_member" "sql_client" {
  for_each = toset(["api", "worker", "migrate"])
  project  = var.project_id
  role     = "roles/cloudsql.client"
  member   = "serviceAccount:${google_service_account.svc[each.value].email}"
}

# ── Services (Cloud Run). The API and console are internal: the bank's load balancer and
# identity-aware proxy sit in front; the widget reaches the API through the bank's edge. ──

locals {
  # Connection strings hold credentials, so they come from Secret Manager too.
  common_env = {
    NODE_ENV       = "production"
    WIDGET_ORIGINS = join(",", var.widget_origins)
  }
  secret_env = {
    DATABASE_URL      = "database-url"
    REDIS_URL         = "redis-url"
    AMIL_API_KEYS     = "amil-api-keys"
    SESSION_SECRET    = "session-secret"
    AUDIT_HASH_SECRET = "audit-hash-secret"
  }
}

resource "google_cloud_run_v2_service" "api" {
  name     = "${local.name}-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
  labels   = local.labels

  template {
    service_account = google_service_account.svc["api"].email
    scaling {
      min_instance_count = var.environment == "prod" ? 2 : 1
      max_instance_count = 20
    }
    vpc_access {
      connector = google_vpc_access_connector.amil.id
      egress    = "PRIVATE_RANGES_ONLY"
    }
    containers {
      image = "${local.image}/api:${var.image_tag}"
      ports {
        container_port = 4000
      }
      dynamic "env" {
        for_each = local.common_env
        content {
          name  = env.key
          value = env.value
        }
      }
      dynamic "env" {
        for_each = local.secret_env
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.secret[env.value].secret_id
              version = "latest"
            }
          }
        }
      }
      startup_probe {
        http_get {
          path = "/readyz"
        }
      }
      liveness_probe {
        http_get {
          path = "/healthz"
        }
      }
    }
  }
}

resource "google_cloud_run_v2_service" "worker" {
  name     = "${local.name}-worker"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_ONLY"
  labels   = local.labels

  template {
    service_account = google_service_account.svc["worker"].email
    scaling {
      min_instance_count = 1
      max_instance_count = 1
    }
    vpc_access {
      connector = google_vpc_access_connector.amil.id
      egress    = "PRIVATE_RANGES_ONLY"
    }
    containers {
      image   = "${local.image}/api:${var.image_tag}"
      command = ["node", "dist/worker.js"]
      resources {
        cpu_idle = false # BullMQ schedules need an always-on CPU
      }
      dynamic "env" {
        for_each = local.common_env
        content {
          name  = env.key
          value = env.value
        }
      }
      dynamic "env" {
        for_each = local.secret_env
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.secret[env.value].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }
}

resource "google_cloud_run_v2_service" "console" {
  name     = "${local.name}-console"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
  labels   = local.labels

  template {
    service_account = google_service_account.svc["console"].email
    vpc_access {
      connector = google_vpc_access_connector.amil.id
      egress    = "PRIVATE_RANGES_ONLY"
    }
    containers {
      image = "${local.image}/console:${var.image_tag}"
      ports {
        container_port = 3001
      }
      env {
        name  = "AMIL_API_URL"
        value = google_cloud_run_v2_service.api.uri
      }
      # AMIL_CONSOLE_KEY_ID / AMIL_CONSOLE_KEY_SECRET: add a console-purpose key (D-067) as a
      # separate secret; the bank's SSO (identity-aware proxy) replaces the demo staff picker.
    }
  }
}

# Migrations run as a job before each release: `gcloud run jobs execute amil-<env>-migrate`.
resource "google_cloud_run_v2_job" "migrate" {
  name     = "${local.name}-migrate"
  location = var.region
  labels   = local.labels

  template {
    template {
      service_account = google_service_account.svc["migrate"].email
      vpc_access {
        connector = google_vpc_access_connector.amil.id
        egress    = "PRIVATE_RANGES_ONLY"
      }
      containers {
        image   = "${local.image}/api:${var.image_tag}"
        command = ["pnpm", "db:migrate"]
        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.secret["database-url"].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }
}
