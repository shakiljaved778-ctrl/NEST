variable "subscription_id" {
  description = "The bank's Azure subscription for AMIL (one tenant per subscription)."
  type        = string
}

variable "location" {
  description = "In-country region. Every resource is pinned to Qatar Central (data residency, non-negotiable 6)."
  type        = string
  default     = "qatarcentral"

  validation {
    condition     = var.location == "qatarcentral"
    error_message = "AMIL data stays in Qatar: location must be qatarcentral."
  }
}

variable "bank_id" {
  description = "AMIL bank id (e.g. bank_ddb). Used in names and tags."
  type        = string
}

variable "environment" {
  description = "uat or prod."
  type        = string
  default     = "uat"

  validation {
    condition     = contains(["uat", "prod"], var.environment)
    error_message = "environment must be uat or prod."
  }
}

variable "name_suffix" {
  description = "Short suffix that makes the globally unique names (Key Vault, registry, Redis, Postgres) unique, e.g. the bank's short code."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]{2,8}$", var.name_suffix))
    error_message = "name_suffix must be 2-8 lowercase letters or digits."
  }
}

variable "deploy_apps" {
  description = "Stage 2 of the first apply: create the container apps and jobs. Leave false until images are pushed and the secrets are filled (docs/DEPLOYMENT.md)."
  type        = bool
  default     = false
}

variable "image_tag" {
  description = "Tag of the api, console and ops images in the registry (built by the deploy workflow)."
  type        = string
  default     = "unset"
}

variable "widget_origins" {
  description = "The bank app origins allowed to call widget endpoints (CORS)."
  type        = list(string)
}

variable "console_public_url" {
  description = "The console's public https URL at the bank's edge (Okta redirects to <url>/auth/okta/callback)."
  type        = string
}

variable "okta_issuer" {
  description = "Okta authorization server issuer, e.g. https://bank.okta.com/oauth2/default (D-077)."
  type        = string
}

variable "okta_client_id" {
  description = "Client id of the console's Okta OIDC web app."
  type        = string
}

variable "console_key_id" {
  description = "Key id of the console-purpose HMAC key (D-067); its secret is the console-key-secret secret, and the same key appears in amil-api-keys."
  type        = string
}

variable "hosted_model_enabled" {
  description = "Give the API the hosted model key (anthropic-api-key secret). Only for model_mode = redacted, where a de-identified fact template leaves the country; the default keeps every model call in-country or off."
  type        = bool
  default     = false
}

variable "in_country_model_url" {
  description = "URL of the bank's in-country model endpoint for model_mode = in_country (empty for none)."
  type        = string
  default     = ""
}

variable "otel_endpoint" {
  description = "OTLP endpoint of the bank's collector for traces (empty turns tracing off, D-070)."
  type        = string
  default     = ""
}

variable "operator_ip_ranges" {
  description = "Public CIDRs allowed to reach the Key Vault and registry data planes (deploy runners, operators). Empty keeps both private-only; then run Terraform and the deploy workflow from inside the VNet."
  type        = list(string)
  default     = []
}

variable "vnet_cidr" {
  description = "Address space of the AMIL VNet. Must not overlap the bank's networks it peers with."
  type        = string
  default     = "10.20.0.0/16"
}

variable "postgres_sku" {
  description = "PostgreSQL Flexible Server SKU."
  type        = string
  default     = "GP_Standard_D2ds_v5"
}

variable "postgres_storage_mb" {
  description = "PostgreSQL storage in MB."
  type        = number
  default     = 65536
}

variable "tags" {
  description = "Extra tags the bank requires (cost centre, owner, data classification)."
  type        = map(string)
  default     = {}
}
