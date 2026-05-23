# Prometheus Metrics Extension

Exports Universe metrics in Prometheus text format via the `/api/metrics` endpoint.

## When to Use This

- You use Prometheus for monitoring and alerting
- You want to scrape JVM, system, and custom Universe metrics
- You need metrics in Grafana dashboards

## Configuration

No configuration file needed. The extension starts automatically and binds to `/api/metrics`.

## Metrics Available

The extension registers a `PrometheusMeterRegistry` with the following built-in JVM/system meters:

- **JVM Memory** — heap usage, non-heap usage, GC pools
- **JVM GC** — collection counts and times
- **JVM Threads** — live, daemon, peak thread counts
- **CPU** — system and process CPU usage
- **Uptime** — JVM uptime in seconds

Universe core records custom metrics:

| Metric | Type | Tags |
|--------|------|------|
| `universe.instances` | Gauge | `state=online/offline/stopped` |
| `universe.nodes` | Gauge | — |
| `universe.configs` | Gauge | — |
| `universe.node.ram` | Gauge | `node_id=...` |
| `universe.node.cpu` | Gauge | `node_id=...` |

## Scraping

Configure your Prometheus `scrape_configs`:

```yaml
scrape_configs:
  - job_name: 'universe'
    static_configs:
      - targets: ['localhost:7000']
    metrics_path: '/api/metrics'
```

## Multiple Providers

Only one metrics provider can be active at a time. If you load both Prometheus and InfluxDB extensions, the last one loaded wins. Unload one via `extension unload` if needed.

## Architecture

- Implements `MetricsProvider` from `:extensions:extension-api`
- Uses Micrometer 1.16.0 `PrometheusMeterRegistry`
- The core app exposes `/api/metrics` and delegates to the active provider's `scrape()` method
