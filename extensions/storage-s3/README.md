# S3 Storage Extension

Stores and retrieves Universe templates from AWS S3 (or S3-compatible backends like MinIO, Wasabi, DigitalOcean Spaces).

## When to Use This

- You run multiple Universe nodes and want a single source of truth for templates
- You use the K8s runtime extension in cloud mode (it auto-downloads S3 templates into init containers)
- You want backup/versioning for your templates via S3 lifecycle policies

## Configuration

Create `./extensions/s3/config.json`:

```json
{
  "bucket": "universe-templates",
  "region": "us-east-1",
  "endpoint": null,
  "accessKey": "AKIA...",
  "secretKey": "...",
  "prefix": "templates/"
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `bucket` | `"universe-templates"` | S3 bucket name |
| `region` | `"us-east-1"` | AWS region (or `us-east-1` for MinIO) |
| `endpoint` | `null` | Custom endpoint for S3-compatible services (e.g. `http://minio:9000`) |
| `accessKey` | `null` | AWS access key (or MinIO access key) |
| `secretKey` | `null` | AWS secret key (or MinIO secret key) |
| `prefix` | `"templates/"` | Key prefix for all template objects |

## Commands

```bash
s3 upload server/base      # zip and upload ./templates/server/base to S3
s3 download server/base    # download from S3 and extract to ./templates/server/base
```

## K8s Integration

When the K8s extension runs in cloud mode (`hostDataPath: null`), it reads this config to generate init containers that download templates before the main container starts. No manual setup needed — just enable both extensions.

## Template Key Format

Templates are stored as zip files under:

```
{prefix}{group}/{name}.zip
```

Example: `templates/server/base.zip`

## MinIO Example

```json
{
  "bucket": "universe",
  "region": "us-east-1",
  "endpoint": "http://minio.internal:9000",
  "accessKey": "minioadmin",
  "secretKey": "minioadmin",
  "prefix": "templates/"
}
```
