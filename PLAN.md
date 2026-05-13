# Universe: AI Phased Implementation Plan

This plan outlines the sequential development phases for the Universe Orchestrator. AI Agents must complete all tasks and associated tests in a phase before moving to the next.

## ✅ Phase 1: Core State, Discovery, Ktor API & Models
**Goal:** Establish the foundational API models, the Hazelcast cluster communication, the Master's Ktor REST API, and enforce the "Instances Survive Disconnect" rule.

* **Task 1 — Schema Enhancements:**
  - Update `gg.scala.universe.schema.schemas.kt`:
    - `InstanceState` enum: `CREATING`, `ONLINE`, `OFFLINE`, `STOPPED`.
    - `InstanceInfo` data class with `id: String` (6-char alphanumeric, not UUID), `configurationName`, `wrapperNodeId`, `hostAddress`, `allocatedPort`, `state`, `lastHeartbeat`, `processPid`.
    - `Configuration` with `fileModifications: List<String>` (files to scan for variable replacement), `properties: Map<String, String>` (extension custom args), and `availablePorts: PortRange`.
    - `TemplateInstallationConfig` with `allOf`, `allInGroups`, `oneOf`, `oneInGroups`, `onTemplatePasteOverridePresentFiles`.

* **Task 2 — Abstract Runtime API:**
  - `RuntimeProvider` interface in `api` module: `start()`, `stop()`, `executeCommand()`.
  - `RuntimeRegistry` interface in `api` module: `register()`, `unregister()`, `get()`, `getAll()`.
  - `RuntimeRegistryImpl` in `app` module (Guice-managed, `ConcurrentHashMap`-backed).

* **Task 3 — Hazelcast State:**
  - `ClusterStateService` managing `IMap<String, Configuration>` ("configurations") and `IMap<String, InstanceInfo>` ("instances").
  - Helper methods: `getConfiguration()`, `getInstance()`, `getAllInstances()`, `putInstance()`.

* **Task 4 — The Ktor REST API:**
  - Ktor 3.4.3 (Netty engine) via `runtimeDownload` bundle.
  - `KtorServerService` starts only when `isMasterNode = true`.
  - Plugins: CORS, Bearer auth, Gson content negotiation, exception catcher, request logging.
  - Endpoints:
    - `GET /api/instances` — list all instances.
    - `POST /api/instances` — create instance, assign to Wrapper, dispatch deploy task.
    - `PUT /api/instances/{id}/state` — update state and heartbeat.
    - `POST /api/commands/execute` — execute console command via REST, return captured output.

* **Task 5 — Resilience:**
  - `ResilienceMembershipListener` on Master.
  - On `memberRemoved`: mark Wrapper offline, set `InstanceInfo.state = OFFLINE`, do **not** remove entries.

## ✅ Phase 2: Command Dispatch & Console Piping
**Goal:** Master sends generic "Lifecycle Orders" and "Console Commands" to Wrappers without knowing *how* the Wrapper will execute them.

* **Task 1 — Task DTOs:**
  - `DeployInstanceTask`, `StopInstanceTask`, `ExecuteCommandTask`, `TemplateSyncTask` in `api` module.
  - All tasks are Gson-serialized to JSON strings for Hazelcast `IExecutorService` dispatch.

* **Task 2 — Dispatch System:**
  - `TaskDispatcher` dispatches tasks to target Hazelcast members.
  - `UniverseCallableTask` wraps JSON payloads as `Callable<String>` for `IExecutorService`.
  - `TaskDeserializer` deserializes JSON back to concrete task classes.
  - `TaskRouter` receives tasks and routes to `TemplateManager` or `RuntimeProvider`.

## ✅ Phase 3: Port Allocation & Raw Process Management (Wrapper Core)
**Goal:** Implement the default, non-containerized execution runtimes and port bindings.

* **Task 1 — Port Allocation:**
  - `PortAllocator` scans `Configuration.availablePorts` from `min` to `max`, testing bind availability.

* **Task 2 — Runtime Providers:**
  - `TmuxRuntimeProvider` and `ScreenRuntimeProvider` in `app` module.
  - `start()` spawns tmux/screen session with working directory and command.
  - `executeCommand()` pipes commands to session stdin.
  - `stop()` terminates the session.

## ✅ Phase 4: Local Template Synchronization & Dynamic Editing
**Goal:** The Wrapper resolves, copies, and dynamically modifies files required to run the instance.

* **Task 1 — Template Manager:**
  - `TemplateManager` resolves `./templates/<group>/<name>/`.
  - Copies to `./running/<instance-id>/` following `TemplateInstallationConfig` paste order.

* **Task 2 — Variable Replacement:**
  - Scans files listed in `Configuration.fileModifications`.
  - Replaces variables (`%PORT%`, `%MASTER_IP%`, `%INSTANCE_ID%`, etc.) with actual values.
  - `TemplateVariableProvider` interface allows extensions to contribute variables.
  - `TemplateVariableRegistry` manages providers.

## ✅ Phase 5: Extensions (Docker, S3, Template Sync)
**Goal:** Provide Docker support, remote template storage, and cross-node template sync without polluting the core codebase.

* **Task 1 — Docker Runtime Extension:**
  - `extensions/runtime-docker` with `docker-java` dependency.
  - `DockerRuntimeProvider` manages containers, port bindings, volume mounts, and exec commands.
  - `DockerConfig` and `DockerConfigLoader` for `./extensions/docker/config.json`.

* **Task 2 — Template Sync Service:**
  - `TemplateSyncService` zips templates and dispatches via Hazelcast `IExecutorService`.
  - `TemplateResolver` interface (in `extensions/api`) resolves wildcards: `*`, `group/(*)`, `group/name`.
  - `TemplateSyncCommand` provides `template sync <pattern> <node>` console command.

* **Task 3 — S3 Storage Extension:**
  - `extensions/storage-s3` with AWS SDK v2 S3 dependency.
  - `S3TemplateStorage` implements `TemplateStorageProvider` for upload, download, and list operations.
  - `S3Commands` provides `s3 upload <pattern>` and `s3 download <pattern>` console commands.
  - **Zero `:app` dependency** — only depends on `:api` and `:extensions:extension-api`.

## ✅ Phase 5.5: Command System
**Goal:** Full console command framework with REST API integration.

* **Task 1 — Cloud v2 Integration:**
  - `DefaultCommandManager` implements `CommandManager<CommandSource>`.
  - `CommandProviderImpl` wraps the manager for execution, registration, and suggestions.
  - `CommandBootstrap` starts console input thread reading `System.in`.

* **Task 2 — Management Commands:**
  - `ManagementCommands` with cluster, instance, config, template, extension, and system commands.
  - `instance create <config>`, `instance stop <id>`, `instance execute <id> <cmd>`.
  - `config list`, `config reload`.
  - `template list`, `template sync <pattern> <node>`.
  - `extension list`, `extension reload`.
  - `cluster status`, `cluster nodes`.

* **Task 3 — REST API Command Execution:**
  - `POST /api/commands/execute` accepts `{ "command": "..." }`.
  - Returns `{ "command": "...", "output": ["..."] }`.

## ✅ Phase 6: The Minecraft Integration Plugin (External)
**Goal:** Build the Bukkit/Paper/Velocity plugins that connect game servers to the Master.

* **Task 1 — Plugin API Module:**
  - Created `:minecraft:api` (JVM 8, zero dependencies) with `Universe`, `UniverseAPI`, `InstanceManager`, `ConfigurationManager`, `TemplateManager`.
  - Data classes with Java Builder patterns: `InstanceInfo`, `Configuration`, `Template`, `PortRange`, `InstanceState`.
  - All async operations use `CompletableFuture<Optional<T>>` for Java ergonomics.

* **Task 2 — Modern Paper Plugin (`minecraft-modern`):**
  - Targets Paper 1.21.4+, uses MiniMessage for chat formatting.
  - Implements `UniverseAPI` with `java.net.http.HttpClient` (Java 11+).
  - Commands: `/universe info`, `/universe players`, `/universe tps`.
  - Heartbeat reports `players`, `maxPlayers`, `tps`.

* **Task 3 — Legacy Spigot Plugin (`minecraft-legacy`):**
  - Targets Spigot 1.8.8, uses legacy `&` color codes.
  - Implements `UniverseAPI` with `HttpURLConnection` (Java 8 compatible).
  - Same `/universe` command set adapted for legacy Bukkit API.

* **Task 4 — Velocity Proxy Plugin (`minecraft-velocity`):**
  - Targets Velocity 3.5.0, uses MiniMessage via same `CC.kt` pattern.
  - Polls instances from Master REST API and auto-registers them as Velocity servers.
  - Commands: `/universe info`, `/universe send <player> <server>`.

* **Task 5 — Shared Patterns:**
  - All plugins implement `UniverseAPI` and register via `Universe.register(this)` / `Universe.unregister()`.
  - Retry logic with exponential backoff (3 retries, 1s/2s/3s) on all HTTP clients.
  - `:minecraft:api` is declared as `implementation` (shaded but **not relocated**) so dependent plugins can use API classes at runtime.

## ✅ Phase 7: REST API Expansion (CloudNet-Inspired)
**Goal:** Expand the Ktor REST API with logs, streaming, cluster management, and lifecycle control.

* **Task 1 — Log Endpoints:**
  - `GET /api/instances/{id}/logs?lines=100` reads from `stdout.log`/`stderr.log`.
  - `WS /api/instances/{id}/live-log` WebSocket streams new log lines in real-time (500ms tail polling).

* **Task 2 — Node & Cluster Routes:**
  - `GET /api/ping` — health check.
  - `GET /api/node` — node info with version, resources, uptime, system stats.
  - `GET /api/node/config` — node configuration.
  - `POST /api/node/reload` — configuration reload trigger.
  - `GET /api/cluster/nodes` — list all cluster nodes with resource usage.
  - `GET /api/cluster/nodes/{id}` — node details with assigned instances.
  - `POST /api/cluster/nodes/{id}/command` — remote command execution.

* **Task 3 — Instance Lifecycle:**
  - `PATCH /api/instances/{id}/lifecycle?target=start|stop|restart` — unified lifecycle control.
  - `DELETE /api/instances/{id}` — stop and remove instance.
  - `POST /api/instances/{id}/execute` — send command to instance stdin.

* **Task 4 — Console WebSocket:**
  - `WS /api/console` — interactive console access over WebSocket (master only).
  - Bidirectional: client sends commands, server streams output lines.

* **Task 5 — Template & Configuration Routes:**
  - `GET /api/templates`, `GET /api/templates/{group}/{name}` — template listing.
  - `POST /api/templates/sync` — trigger template sync with wildcard pattern.
  - `GET /api/configurations`, `GET /api/configurations/{name}`, `PUT /api/configurations/{name}`, `DELETE /api/configurations/{name}` — full CRUD.

* **Task 6 — Route Refactoring:**
  - Split monolithic `InstanceRoutes.kt` into 6 focused route files:
    - `CommandRoutes.kt`, `InstanceRoutes.kt`, `ConfigurationRoutes.kt`, `ClusterRoutes.kt`, `NodeRoutes.kt`, `TemplateRoutes.kt`.

## ⬜ Phase 8: Future Enhancements
* Template editing API (`POST /api/templates/{group}/{name}/files/{path}`).
* Instance log archival to S3 or remote storage.
* Metrics endpoint (`GET /api/metrics`) with Prometheus format.
* Role-based API authentication (beyond bearer token passthrough).
* Remote console command execution via Hazelcast `IExecutorService`.
* Configuration hot-reload without restart.
