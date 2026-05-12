# Universe Docker Runtime Extension

This extension allows Universe to spawn instances as **Docker containers** instead of local processes.

## Docker Compose Setup

If Universe itself runs inside Docker Compose (which is the recommended deployment), the extension needs access to the **host's Docker daemon** to create sibling containers.

### Required docker-compose.yml changes

```yaml
universe:
  image: git.lunarlabs.dev/scala/universe:latest
  volumes:
    - ./data:/data
    # REQUIRED: Allow Universe to control Docker on the host
    - /var/run/docker.sock:/var/run/docker.sock
  restart: unless-stopped
```

**Why `/var/run/docker.sock`?**

The Docker daemon listens on a Unix socket at `/var/run/docker.sock`. By mounting this socket into the Universe container, the extension can send Docker API commands to the **host's Docker daemon**. This is called "Docker-out-of-Docker" (not Docker-in-Docker) — containers created by Universe will be siblings to the Universe container itself, not nested inside it.

### hostDataPath — The Bind Mount Fix

When Universe runs inside Docker, template working directories live inside the container filesystem (e.g., `/data/running/<instance-id>/`). However, when the Docker extension creates a **new container** and tries to bind-mount this directory, the Docker daemon resolves the path on the **host filesystem** — not inside the Universe container.

This means `/data/running/abc123` inside the Universe container does not exist on the host, so the spawned container gets an empty or missing mount.

**Solution:** Set `hostDataPath` in `./extensions/docker/config.json` to the host-side path that corresponds to your `./data` volume mount.

**Example:**

Your `docker-compose.yml` mounts `./data:/data` and lives at `/opt/universe/docker-compose.yml`:

```yaml
volumes:
  - ./data:/data
```

Then set in `./extensions/docker/config.json`:

```json
{
  "hostDataPath": "/opt/universe/data"
}
```

Now when Universe creates a container and bind-mounts the working directory, the Docker daemon sees the correct host path and the spawned container gets the actual files.

### Full Example Config

```json
{
  "factoryName": "docker",
  "hostDataPath": "/opt/universe/data",
  "network": "host",
  "javaImage": {
    "repository": "azul-zulu",
    "tag": "25-jdk-alpine"
  },
  "volumes": [],
  "exposedPorts": [],
  "autoRemove": false,
  "stopTimeout": 10
}
```

### Security Note

Mounting `/var/run/docker.sock` grants the Universe container full control over the host's Docker daemon. Only do this in trusted environments.
