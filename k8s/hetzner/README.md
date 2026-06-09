# Projection — Hetzner terrain (`hetzner-early`)

Hetzner k3s deployment for projection.finance, parallel to AWS prod (untouched).
Reuses projection's existing Traefik Ingress + cert-manager pattern (already
present in `k8s/production`), just on the earlywave terrain domain and GHCR.

Cluster infra (cert-manager, Traefik, namespaces) lives in `hetzner-infra`;
Postgres in `db-infra`. Projection has no Redis.

## Terrain domain (DNS A -> 94.130.161.157)

```
www.projection.finance
```

## Files

| File | Purpose |
|------|---------|
| `kustomization.yaml` | overlay: base + ingress + namespace, GHCR image, drops GCP pull secret |
| `ingress.yaml` | Traefik Ingress + cert-manager TLS on the terrain domain |
| `namespace.yaml` | projectionv2 |

The 5 CronJobs (radar-liquidations/positions, subscription-check,
wallet-health, yields-refresh) and the http-redirect sidecar come from
`../base` unchanged.

## Workflow

`.github/workflows/deploy-projection-hetzner-early.yaml` (manual): builds the
Next.js image to `ghcr.io/xsmrzx/projection/projection-web`, then
`kustomize edit set image` + apply the `k8s/hetzner` overlay.

## TODO before first run

- Secret `projection-web-secret` in `projectionv2` with `DATABASE_URL` pointing
  at the in-cluster CNPG. NOTE: the projection DB name is only in the GitHub
  secret today — confirm/create the database in CNPG (db-infra) before data
  migration.
- The CronJobs hit `http://projection-web/api/cron/*` with `x-cron-secret`;
  ensure `CRON_SECRET` matches between the deployment env and the cronjobs.
