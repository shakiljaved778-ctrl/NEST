# AMIL on GCP: single-tenant skeleton

A starting point for a bank's platform team (D-071), not a turnkey production stack. Review
networking, IAM, backups and monitoring against the bank's own standards before use.

## What it creates

Everything is in one project per bank, pinned to one in-country region (default `me-central1`,
Doha):

| Area     | Resources                                                                                                                                             |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Network  | Private VPC, private service access, a serverless VPC connector. No public database or Redis.                                                         |
| Keys     | Cloud KMS key ring with the PII envelope key (D-066) and the database CMEK, rotated yearly.                                                           |
| Data     | Cloud SQL PostgreSQL 16 (private IP, TLS only, CMEK, PITR backups kept in-region); Memorystore Redis 7 (AUTH, TLS).                                   |
| Secrets  | Secret Manager secrets with in-region replication. Values are added out of band, never in state.                                                      |
| Services | Cloud Run: `api` and `console` (internal ingress, behind the bank's load balancer and IAP), `worker` (always-on CPU for BullMQ), and a `migrate` job. |
| Identity | One service account per service; each reads only the secrets it needs (the console reads none).                                                       |

The fictional demo bank is not deployed (`enable_demo_bank` is reserved for sales demos).

## Use

```bash
cp terraform.tfvars.example terraform.tfvars    # then edit
terraform init                                 # configure the gcs backend in versions.tf first
terraform plan
terraform apply
# Fill the secrets listed in the `secrets_to_populate` output, then:
gcloud run jobs execute amil-<env>-migrate --region me-central1
```

Images are built by CI from the repository's Dockerfiles and pushed to the created Artifact
Registry repository as `api:<tag>` and `console:<tag>`.

## Not included

- The bank's load balancer, WAF, DNS, certificates and identity-aware proxy (bank-owned).
- Monitoring, alerting and log sinks (point `OTEL_EXPORTER_OTLP_ENDPOINT` at the bank's collector).
- An in-country model endpoint for `model_mode = "in_country"`.
