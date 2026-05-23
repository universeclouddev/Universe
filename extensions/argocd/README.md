# ArgoCD Extension

Exports Universe configurations and instances as Kubernetes manifests for ArgoCD to track.

## When to Use This

- You use ArgoCD for GitOps-driven Kubernetes deployments
- You want ArgoCD to detect drift between desired and actual state
- You need a bridge between Universe's runtime management and ArgoCD's declarative model

## What It Does

Every 60 seconds, the extension writes to `./argocd-manifests/`:

- **ConfigMaps** — one per Universe configuration (as JSON)
- **Deployments** — one per active instance (with env vars and ports)
- **kustomization.yaml** — references all generated manifests

You commit this directory to a Git repository tracked by ArgoCD. ArgoCD applies the manifests, giving you drift detection and sync history.

## Architecture

Universe manages the **runtime lifecycle** (start, stop, scale). ArgoCD manages the **desired state** (which configurations exist, how many instances). The extension bridges the two by continuously exporting current state to YAML.

## Configuration

No config file. The extension is controlled by presence/absence of the JAR in `./extensions/`.

## Output Format

### ConfigMap (per configuration)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: universe-config-lobby
  namespace: universe
  labels:
    app.kubernetes.io/part-of: universe
    universe.scala.gg/configuration: "lobby"
data:
  configuration.json: |
    { ... full Configuration JSON ... }
```

### Deployment (per instance)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: universe-instance-a1b2c3
  namespace: universe
  labels:
    universe.scala.gg/instance-id: "a1b2c3"
    universe.scala.gg/configuration: "lobby"
spec:
  replicas: 1
  selector:
    matchLabels:
      universe.scala.gg/instance-id: "a1b2c3"
  template:
    metadata:
      labels:
        universe.scala.gg/instance-id: "a1b2c3"
    spec:
      containers:
      - name: server
        image: universe-minecraft:latest
        env:
        - name: UNIVERSE_INSTANCE_ID
          value: "a1b2c3"
        ports:
        - containerPort: 25565
```

### Kustomization

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - config-lobby.yaml
  - instance-a1b2c3.yaml
commonLabels:
  app.kubernetes.io/managed-by: argocd
```

## ArgoCD Application

Create an ArgoCD Application pointing at your Git repo:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: universe-state
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/universe-argocd.git
    targetRevision: main
    path: argocd-manifests
  destination:
    server: https://kubernetes.default.svc
    namespace: universe
  syncPolicy:
    automated:
      prune: true
      selfHeal: false  # Let Universe handle runtime changes
```

## Important Notes

- **ArgoCD does not replace the K8s runtime extension.** ArgoCD tracks state; Universe starts/stops pods.
- Set `selfHeal: false` so ArgoCD doesn't fight Universe over instance counts.
- The generated manifests use placeholder images. Override via Kustomize patches or the K8s runtime's `CUSTOM_IMAGE` env var.

## Standalone Extension

This extension is completely optional. If you don't use ArgoCD, simply don't install it. It has no dependencies on the K8s runtime or any other extension.
