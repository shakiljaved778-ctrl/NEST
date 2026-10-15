output "resource_group" {
  description = "Resource group holding the AMIL tenant."
  value       = azurerm_resource_group.amil.name
}

output "registry" {
  description = "Container registry login server; the deploy workflow pushes api, console and ops here."
  value       = azurerm_container_registry.amil.login_server
}

output "key_vault" {
  description = "Key Vault name (secrets and keys)."
  value       = azurerm_key_vault.amil.name
}

output "secrets_to_populate" {
  description = "Secrets to set out of band (az keyvault secret set) before stage 2; they start as placeholders."
  value       = sort(local.operator_secrets)
}

output "pii_key_id" {
  description = "Key that wraps the PII data keys (envelope encryption, D-066). No AMIL workload can use it."
  value       = azurerm_key_vault_key.pii.versionless_id
}

output "postgres_fqdn" {
  description = "Private FQDN of PostgreSQL (create the amil_app role here, docs/DEPLOYMENT.md)."
  value       = azurerm_postgresql_flexible_server.amil.fqdn
}

output "apps_static_ip" {
  description = "Private IP of the Container Apps environment: the bank's Application Gateway backend."
  value       = azurerm_container_app_environment.amil.static_ip_address
}

output "api_fqdn" {
  description = "Internal FQDN of the API (Application Gateway backend host)."
  value       = var.deploy_apps ? azurerm_container_app.api[0].ingress[0].fqdn : null
}

output "console_fqdn" {
  description = "Internal FQDN of the console (Application Gateway backend host)."
  value       = var.deploy_apps ? azurerm_container_app.console[0].ingress[0].fqdn : null
}

output "jobs" {
  description = "One-off jobs: az containerapp job start -g <resource_group> -n <name>."
  value       = { for k, j in azurerm_container_app_job.ops : k => j.name }
}
