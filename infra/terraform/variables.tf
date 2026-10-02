variable "project_id" {
  description = "The bank's dedicated GCP project for AMIL (one tenant per project)."
  type        = string
}

variable "region" {
  description = "In-country region. me-central1 is Doha; every resource is pinned to it (data residency)."
  type        = string
  default     = "me-central1"
}

variable "bank_id" {
  description = "AMIL bank id (e.g. bank_ddb). Used in names and labels."
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

variable "image_tag" {
  description = "Container image tag for api, worker and console (built by CI and pushed to Artifact Registry)."
  type        = string
}

variable "model_mode" {
  description = "Model gateway mode: redacted (default), in_country, or off. Set per bank."
  type        = string
  default     = "redacted"

  validation {
    condition     = contains(["redacted", "in_country", "off"], var.model_mode)
    error_message = "model_mode must be redacted, in_country or off."
  }
}

variable "widget_origins" {
  description = "The bank app origins allowed to call widget endpoints (CORS)."
  type        = list(string)
}

variable "db_tier" {
  description = "Cloud SQL machine tier."
  type        = string
  default     = "db-custom-2-7680"
}

variable "enable_demo_bank" {
  description = "Deploy the fictional Doha Demo Bank app (sales demos only; never in a bank's production)."
  type        = bool
  default     = false
}
