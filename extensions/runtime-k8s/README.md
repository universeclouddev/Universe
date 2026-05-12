# Universe Kubernetes Runtime Extension

This extension allows Universe to spawn instances as **Kubernetes Pods** instead of local processes or Docker containers.

## Quick Links

- **[SETUP.md](SETUP.md)** — Docker Compose setup, kubeconfig mounting, cluster-specific notes (Docker Desktop, minikube, EKS/GKE/AKS, kind/k3d)
- **[CLOUD.md](CLOUD.md)** — Cloud deployment modes: shared PVC, automatic S3 template init containers, baked images, ConfigMaps
- **[SCHEMA.md](SCHEMA.md)** — Full configuration schema for `./extensions/k8s/config.json`
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** — Common errors and fixes

## Two Operating Modes

| | Local Mode | Cloud Mode |
|---|---|---|
| **When** | minikube, Docker Desktop, kind (same machine) | EKS, GKE, AKS (separate nodes) |
| **`hostDataPath`** | Set (e.g., `/opt/universe/data`) | `null` or omitted |
| **Volume type** | `hostPath` — mounts host filesystem | `emptyDir` — fresh empty directory |
| **Templates** | Universe copies them locally, pod sees them via `hostPath` | Use **S3 init containers** (auto) or **shared PVC** |

## Minimal Config

```json
{
  "factoryName": "kube",
  "namespace": "default",
  "image": "azul-zulu:25-jdk-alpine",
  "hostDataPath": "/opt/universe/data",
  "timeoutSeconds": 30
}
```

For cloud mode, see [CLOUD.md](CLOUD.md) for one-command deployment with S3 templates.

## End-User Experience (Cloud + S3)

1. Enable the **S3 storage extension** — configure `./extensions/s3/config.json` with your bucket/region
2. Enable the **K8s runtime extension** — no extra S3 config needed
3. Set `hostDataPath: null` (or omit it) in `./extensions/k8s/config.json`
4. Create instances with templates stored in S3
5. The K8s extension **auto-generates init containers** that download templates before the main container starts

Zero manual init container scripting required.
