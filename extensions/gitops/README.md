# GitOps Extension

Syncs Universe templates and configurations from a Git repository.

## When to Use This

- You want version control for your templates and configurations
- You need automated rollouts when Git changes
- You run a CI/CD pipeline that pushes to a repo

## How It Works

1. On startup: clones the repo (or opens existing clone)
2. Every `intervalMs`: pulls updates from the remote
3. After each pull: copies `templates/` and `configuration/` from the cloned repo to the local Universe directories

## Configuration

Create `./extensions/gitops/config.json`:

```json
{
  "url": "https://github.com/your-org/universe-config.git",
  "branch": "main",
  "targetPath": "./git-sync",
  "intervalMs": 300000,
  "enabled": true,
  "username": "",
  "password": "",
  "sshKeyPath": ""
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `url` | `""` | Git repository URL (HTTPS or SSH) |
| `branch` | `"main"` | Branch to track |
| `targetPath` | `"./git-sync"` | Local directory for the cloned repo |
| `intervalMs` | `300000` | Pull interval in milliseconds (default: 5 minutes) |
| `enabled` | `false` | Whether syncing is active |
| `username` | `""` | HTTP basic auth username (for private HTTPS repos) |
| `password` | `""` | HTTP basic auth password or personal access token |
| `sshKeyPath` | `""` | Path to SSH private key (for `git@` URLs) |

## Repository Structure

Your Git repo should have this layout:

```
universe-config/
  templates/
    server/
      base/
        server.properties
        plugins/
    lobby/
      default/
        server.properties
  configuration/
    lobby.json
    minigames.json
```

## HTTPS with PAT Example

```json
{
  "url": "https://github.com/your-org/universe-config.git",
  "username": "your-username",
  "password": "ghp_xxxxxxxxxxxxxxxxxxxx",
  "enabled": true
}
```

## SSH Example

```json
{
  "url": "git@github.com:your-org/universe-config.git",
  "sshKeyPath": "./.ssh/id_rsa",
  "enabled": true
}
```

## Manual Sync

The extension syncs automatically on its interval. To force a sync immediately:

```bash
extension reload gitops
```

Or restart Universe.

## Conflicts

GitOps **overwrites** local files. If you edit templates locally, those changes will be lost on the next pull. Make all changes in the Git repository.

## Architecture

- Uses JGit 7.6.0 for pure-Java Git operations (no native `git` binary needed)
- `UsernamePasswordCredentialsProvider` for HTTPS auth
- `SshTransportConfigCallback` for SSH key auth
- Single-threaded scheduled executor for background pulls
