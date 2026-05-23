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

**Note on networking:** The K8s extension exposes the allocated port via `hostPort` on the Pod spec, making the Minecraft server reachable from outside the cluster on the node's IP address. Ensure your firewall/security groups allow traffic to the allocated port range.

For cloud mode, see [CLOUD.md](CLOUD.md) for one-command deployment with S3 templates.

## Per-Instance Services

By default, the K8s extension creates a **headless Service** per pod for in-cluster DNS resolution. This is controlled by the `service` config block:

```json
{
  "service": {
    "enabled": true,
    "type": "ClusterIP",
    "clusterIP": "None",
    "labels": {},
    "annotations": {},
    "ownerReference": true,
    "cleanupOrphans": true
  }
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `enabled` | `true` | Whether to create a Service alongside each Pod |
| `type` | `"ClusterIP"` | Service type. Use `NodePort` or `LoadBalancer` for external access |
| `clusterIP` | `"None"` | `"None"` = headless (DNS only). `null` = auto-assign virtual IP |
| `labels` | `{}` | Extra labels merged into Service metadata |
| `annotations` | `{}` | Extra annotations (e.g. for external-dns or cloud LB config) |
| `ownerReference` | `true` | Service is auto-deleted when the Pod is deleted |
| `cleanupOrphans` | `true` | On startup, delete Services whose Pods no longer exist |

### Headless service (default)

Each instance gets a DNS name:
```
universe-<instanceId>.<namespace>.svc.cluster.local
```

This is used by the Velocity proxy for in-cluster pod-to-pod connectivity.

### Disable services

If you use Tailscale or host networking instead:
```json
{ "service": { "enabled": false } }
```

### NodePort for external access

```json
{
  "service": {
    "enabled": true,
    "type": "NodePort",
    "clusterIP": null
  }
}
```

## End-User Experience (Cloud + S3)

1. Enable the **S3 storage extension** — configure `./extensions/s3/config.json` with your bucket/region
2. Enable the **K8s runtime extension** — no extra S3 config needed
3. Set `hostDataPath: null` (or omit it) in `./extensions/k8s/config.json`
4. Create instances with templates stored in S3
5. The K8s extension **auto-generates init containers** that download templates before the main container starts

Zero manual init container scripting required.

## Per-Instance Image Override

You can override the container image for a specific instance by setting the `CUSTOM_IMAGE` environment variable in the configuration's `environmentVariables`:

```json
{
  "name": "my-server",
  "runtime": "kube",
  "environmentVariables": {
    "CUSTOM_IMAGE": "myregistry.com/custom-java:21",
    "UNIVERSE_INSTANCE_ID": "%INSTANCE_ID%"
  }
}
```

When present, `CUSTOM_IMAGE` takes precedence over the `image` configured in `./extensions/k8s/config.json`.
