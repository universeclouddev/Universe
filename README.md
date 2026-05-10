# Universe

A single-JAR orchestrator for deploying and managing application instances across a cluster of nodes. Originally inspired by Minecraft cloud systems (CloudNet, SimpleCloud), Universe is designed as a general-purpose instance orchestrator with a clean extension API.

## Features

- **Master/Wrapper Cluster** — One Master node exposes a REST API; any number of Wrapper nodes execute instances via Hazelcast task dispatch.
- **Template-Based Deployment** — Instances are created from templates (file trees) with dynamic variable replacement.
- **Pluggable Runtimes** — Built-in `screen` and `tmux` runtimes; Docker support via extension.
- **Remote Template Storage** — S3-backed template storage extension for centralized template management.
- **Console & REST Commands** — Full command system accessible via console or HTTP API.
- **Single Fat JAR** — Master and Wrapper run from the same JAR; node type is determined by configuration.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Master Node                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Ktor REST  │  │   Hazelcast │  │   Console Commands  │ │
│  │    API      │  │   IMap/Exec │  │   (Cloud v2)        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│         │                │                    │             │
│         ▼                ▼                    ▼             │
│  POST /api/instances  DeployInstanceTask   instance create │
│  PUT /api/instances   StopInstanceTask     instance stop   │
│  POST /api/commands   TemplateSyncTask     template sync   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Hazelcast Cluster
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Wrapper Node(s)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │ TaskRouter  │  │  Template   │  │  RuntimeProvider     │ │
│  │ (IExecutor) │  │   Manager   │  │ (screen/tmux/docker) │ │
│  └─────────────┘  └─────────────┘  └──────────────────────┘ │
│         │                │                    │             │
│         ▼                ▼                    ▼             │
│   Receive Tasks    Copy Templates      Start Processes      │
│   Route Actions    Replace Variables   Pipe Stdin           │
└─────────────────────────────────────────────────────────────┘
```

## Building

Requires **JDK 25+** and Gradle 9.5+.

```bash
./gradlew build
```

Artifacts are copied to `.built/` after build.

### Modules

| Module | Purpose |
|--------|---------|
| `api` | Shared data classes, task DTOs, runtime interfaces, command abstractions |
| `app` | Core orchestrator logic: Hazelcast, Ktor API, template management, commands |
| `loader` | Bootstrap classloader that downloads runtime deps and launches `app` |
| `extensions/extension-api` | Extension-facing interfaces (`Extension`, `TemplateStorageProvider`, etc.) |
| `extensions/runtime-docker` | Docker container runtime provider |
| `extensions/storage-s3` | AWS S3 template storage backend |
| `extensions/example` | Reference extension implementation |

## Running

### Standalone JAR

The `loader` module produces a fat JAR with all dependencies embedded or downloaded at runtime.

```bash
java -jar .built/universe-loader-0.0.1.jar
```

On first run, the following files/directories are created:
- `./config.json` — Node identity and cluster configuration
- `./configuration/` — Instance configuration files (`.json`)
- `./templates/` — Template storage (`<group>/<name>/`)
- `./running/` — Active instance working directories
- `./extensions/` — Extension JARs and configs

### Configuration

**`./config.json`** (main node config):
```json
{
  "address": "127.0.0.1",
  "port": 6000,
  "apiPort": 7000,
  "nodeId": "node-1",
  "clusterName": "universe-cluster",
  "isMasterNode": true,
  "masterAddress": "127.0.0.1",
  "masterPort": 6000,
  "masterApiPort": 7000
}
```

**`./configuration/default.json`** (instance config):
```json
{
  "name": "default",
  "runtime": "screen",
  "command": "java -jar server.jar",
  "static": false,
  "instanceGroups": [],
  "nodes": ["node-1"],
  "hostAddress": "127.0.0.1",
  "availablePorts": { "min": 25565, "max": 25570 },
  "minimumServiceCount": 1,
  "environmentVariables": {},
  "templateInstallationConfig": {
    "allOf": [{ "name": "base", "group": "server", "storage": "local", "priority": 0 }],
    "allInGroups": [],
    "oneOf": [],
    "oneInGroups": [],
    "onTemplatePasteOverridePresentFiles": false
  },
  "fileModifications": ["server.properties"],
  "properties": {}
}
```

### Docker Compose

Create a `docker-compose.yml`:

```yaml
services:
  universe-master:
    image: git.lunarlabs.dev/scala/universe:latest
    container_name: universe-master
    stdin_open: true
    tty: true
    ports:
      - "7000:7000"   # REST API
      - "6000:6000"   # Hazelcast
    volumes:
      - ./data:/data

  # You can also add a wrapper, but the master should be able to run instances on its own
  universe-wrapper:
    image: git.lunarlabs.dev/scala/universe:latest
    depends_on:
      - universe-master
    volumes:
      - ./wrapper-data:/data

```

**Important:** The Wrapper's `config.json` must set `isMasterNode: false` and point to the Master's Hazelcast address:
```json
{
  "isMasterNode": false,
  "masterAddress": "universe-master", // In this case, the Docker Compose service name, it could also be the Master's IP if running separately
  "masterPort": 6000,
  "masterApiPort": 7000
}
```

Run:
```bash
docker compose up -d
```

### Running Commands in Docker Compose

**Option 1: Interactive attach**
```bash
docker attach universe-master
# Then type commands directly
cluster status
instance list
stop
```

**Option 2: REST API (recommended)**
```bash
# Get all instances
curl http://localhost:7000/api/instances

# Create an instance
curl -X POST http://localhost:7000/api/instances \
  -H "Content-Type: application/json" \
  -d '{"configurationName": "default"}'

# Execute a console command via REST
curl -X POST http://localhost:7000/api/commands/execute \
  -H "Content-Type: application/json" \
  -d '{"command": "cluster status"}'
```

## Console Commands

All commands work both in the console and via `POST /api/commands/execute`.

| Command | Description |
|---------|-------------|
| `cluster status` | Show cluster members and local node info |
| `cluster nodes` | List all connected nodes |
| `instance list` | List all instances with state, host, port |
| `instance create <config>` | Create a new instance from a configuration |
| `instance stop <id>` | Stop an instance by ID |
| `instance info <id>` | Show full instance details |
| `instance execute <id> <cmd>` | Send a command to an instance's stdin |
| `config list` | List all loaded configurations |
| `config reload` | Reload configurations from `./configuration/` |
| `template list` | List local templates (group/name) |
| `template sync <pattern> <node>` | Sync template(s) to another cluster node |
| `extension list` | Show installed and loaded extensions |
| `extension reload` | Trigger `onReload()` on all extensions |
| `help` | Show all available commands |
| `stop` / `exit` | Graceful shutdown |

## REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/instances` | List all instances |
| `POST` | `/api/instances` | Create instance from configuration |
| `PUT` | `/api/instances/{id}/state` | Update instance state and heartbeat |
| `POST` | `/api/commands/execute` | Execute console command, return output |

## Templates

Templates live in `./templates/<group>/<name>/`.

```
templates/
  global/
    server/
      server.properties
      plugins/
  lobby/
    default/
      server.properties
      world/
```

When an instance is created, `TemplateManager`:
1. Resolves templates from `TemplateInstallationConfig`
2. Copies them to `./running/<instance-id>/` in priority order
3. Scans files listed in `Configuration.fileModifications`
4. Replaces variables: `%PORT%`, `%INSTANCE_ID%`, `%MASTER_IP%`, etc.

**Template sync between nodes:**
```bash
template sync server/base node-2
template sync server/* node-2     # sync all in group
template sync * node-2            # sync all templates
```

## Extensions

Extensions are self-registering JARs placed in `./extensions/`.

**Built-in extensions:**
- `runtime-docker` — Docker container runtime
- `storage-s3` — AWS S3 template storage

**Extension structure:**
```kotlin
class MyExtension : Extension {
    override fun id() = "my-extension"
    override fun version() = "1.0.0"

    @Inject lateinit var registry: RuntimeRegistry

    override fun onLoad() {
        registry.register("my-runtime", MyRuntimeProvider())
    }
}
```

**S3 commands:**
```bash
s3 upload server/base      # upload template to S3
s3 download server/base    # download template from S3
```

## Development

### Adding a new runtime extension

1. Create `extensions/runtime-myprovider/`
2. Implement `RuntimeProvider` from `:api`
3. Implement `Extension` from `:extensions:extension-api`
4. Register provider in `onLoad()` via injected `RuntimeRegistry`
5. Add to `settings.gradle.kts`

### Adding a new storage extension

1. Create `extensions/storage-mybackend/`
2. Implement `TemplateStorageProvider` from `:extensions:extension-api`
3. Register in `onLoad()` via injected `TemplateStorageRegistry`

### Key rules
- Built-In extensions depend on `:api` and `:extensions:extension-api` by default
- Never depend on `:app` from an extension
- Use `runtimeDownload` for external dependencies
- Register via injected registries in `onLoad()`, not statically

## License

See [LICENSE](LICENSE) and [COPYRIGHT.txt](COPYRIGHT.txt).
