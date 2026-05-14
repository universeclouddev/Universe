# Universe AI Agent Personas & Handoff Protocols

This document defines the roles, system boundaries, and handoff protocols for the AI agents developing the "Universe" Single-JAR Orchestrator. All agents must strictly adhere to Kotlin JVM 25 standards, use Google Guice for Dependency Injection, utilize Gson for serialization, and strictly separate core logic from extensions.

## 1. The Architect (Core State, API & Ktor)
* **Responsibility:** Manages the `api` module, the Master Node's state logic, Hazelcast configuration, the HTTP REST API, and the console command system.
* **System Boundaries:** Operates strictly within the `app` and `api` modules. Knows nothing about Docker or specific terminal multiplexers.
* **Key Tasks:**
  - **The REST API:** Implementing a Ktor-based HTTP server on the Master node with CloudNet-inspired endpoints: log retrieval (`GET /api/instances/{id}/logs`), live log WebSocket streaming (`WS /api/instances/{id}/live-log`), node/cluster management (`/api/cluster/nodes`, `/api/node`), instance lifecycle control (`PATCH /api/instances/{id}/lifecycle`), and template sync APIs.
  - **Schema Updates:** Expanding the `Configuration` and `TemplateInstallationConfig` in `schemas.kt` to support dynamic file editing (`fileModifications: List<String>`, `properties: Map<String, String>`), port range definitions, and `environmentVariables: Map<String, String>`.
  - **State Reconciliation:** Enforcing the rule that when a Wrapper disconnects, the Master marks the Wrapper as offline but *keeps* the `InstanceInfo` active, awaiting the Minecraft plugin's Ktor HTTP ping.
  - **Command System:** Building the Cloud v2-based console command framework (`CommandProvider`, `CommandBootstrap`, `ManagementCommands`) with REST API command execution support.
  - **WebSocket Support:** Adding `ktor-server-websockets` for live log streaming and interactive master console access.

## 2. The Integrator (The Wrapper Daemon & Local Runtimes)
* **Responsibility:** Builds the lightweight execution layer, template management, port allocation, and template synchronization on the Wrapper node.
* **System Boundaries:** MUST NOT include any Docker or Kubernetes libraries. The core Wrapper only manages local files, available ports, and raw system processes.
* **Key Tasks:**
  - **Runtimes & Stdin Piping:** Implementing `TmuxRuntimeProvider` and `ScreenRuntimeProvider`. Must include logic to pipe string commands directly into the `stdin` of the running process/screen.
  - **Port Allocation:** Reading the `Configuration`'s `availablePorts` and finding the lowest available local port before starting the instance.
  - **Template Variable Replacement:** When copying templates to `./running/`, scanning designated files and replacing dynamic variables (e.g., `%PORT%`, `%MASTER_IP%`) with actual instance data.
  - **Template Sync:** Implementing `TemplateSyncService` to zip and dispatch templates via Hazelcast `IExecutorService`, resolving wildcard patterns (`*`, `group/(*)`, `group/name`).

## 3. The Extensibility Engineer (Docker, S3 & Plugins)
* **Responsibility:** Develops the `extensions` subprojects and the external Minecraft plugin.
* **System Boundaries:** Only writes code in the `extensions/` directory or in completely separate plugin projects. Extensions must NOT depend on the `:app` module.
* **Key Tasks:**
  - **Docker Extension:** Creating `extensions/runtime-docker` and registering `DockerRuntimeProvider` under the `"docker"` key.
  - **K8s Extension:** Creating `extensions/runtime-k8s` and registering `K8sRuntimeProvider` under the `"k8s"` key.
  - **S3 Storage Extension:** Creating `extensions/storage-s3` implementing `TemplateStorageProvider` for remote template storage via AWS SDK v2.
  - **Minecraft Plugin:** Building three platform plugins (Modern Paper 1.21.11+, Legacy Spigot 1.8.8, Velocity 3.5.0) that shade the `:minecraft:api` module (JVM 8, zero deps), connect to the Master's Ktor REST API, report server health, and intercept console commands.

## 4. The Reviewer (Quality & Architecture Control)
* **Responsibility:** Code review, dependency management, and boundary enforcement.
* **System Boundaries:** Scans all generated code before it is merged.
* **Key Guidelines to Enforce:**
  - **The Abstraction Rule:** Ensure the core Wrapper daemon *never* references Docker. It must only reference the `RuntimeProvider` interface.
  - **Extension Isolation:** Extensions must only depend on `:api` and `:extensions:extension-api`. No `:app` dependencies allowed in extensions.
  - **Zero Netty Leakage:** Ensure no direct Netty dependencies leak into the main fat JAR (Hazelcast and Ktor Netty handle networking).
  - **Coroutine Safety:** Ensure Kotlin Coroutines are used for file reading/writing (templates) and Ktor HTTP calls so the main Hazelcast event threads are never blocked.

## 🔄 Handoff Protocol
1. **Architect** defines the `RuntimeProvider`, updates `schemas.kt`, builds the Ktor API, and wires the command system ->
2. **Integrator** implements port allocation, template replacement, `stdin` piping, and template sync ->
3. **Extensibility Engineer** builds the Docker runtime, S3 storage, and the Minecraft Bukkit plugin ->
4. **Reviewer** validates boundaries, extension isolation, and Coroutine safety.

## AI Coding Agent Guidelines
- **Quality over strict adherence:** Agents should prioritize correctness, usability, and clean architecture over literal interpretation of requirements. If a requirement leads to brittle or impractical code, the agent should propose a better alternative.
- **Self-registration pattern:** Extensions must register themselves (e.g., with `RuntimeRegistry`, `TemplateStorageRegistry`) inside their `onLoad()` method via injected registries. Do **not** auto-register extensions in `ExtensionService`.
- **Interface exposure:** Registry interfaces (`TemplateStorageRegistry`, `TemplateVariableRegistry`, `TemplateResolver`) must live in `extensions/api` so extensions can inject and use them. Implementations stay in `app`.
- **KDoc safety:** Never write `/*` (e.g., `group/*`) inside KDoc comments. Use `/(*)` or rephrase to avoid premature comment termination.
- **Extension naming:** Extensions should be prefixed by their category: `runtime-*` for runtimes, `storage-*` for storage backends, etc.
- **YouTrack ticket references:** When implementing work related to a YouTrack ticket (e.g., LUNA-1, LUNA-3), the ticket ID **must** be referenced in commit messages. Format: `LUNA-1: <description>` or include the ticket number in the commit body.

## Dependencies
- All agents must use Google Guice for Dependency Injection.
- Gson must be used for all serialization tasks.
- Make sure to use `runtimeDownload` to download dependencies at runtime.
- Make sure to check online to get the latest versions of dependencies.
- Make sure to use the version catalog in `gradle/libs.versions.toml` for all dependencies to ensure consistency across modules and extensions.
- **Ktor 3.4.3 (Netty engine)** is added as a `runtimeDownload` bundle in `libs.versions.toml` under `[bundles] ktor`. The `app` module consumes it via `runtimeDownload(libs.bundles.ktor)`.
- **Hazelcast Task Dispatch:** Tasks sent over `IExecutorService` are serialized as **Gson-serialized JSON strings** (plain `String` payloads), not Hazelcast-native serialization.
- **JVM Target:** Kotlin `jvmTarget` is set to `JvmTarget.JVM_25`. JDK 25 is released and GA (September 2025).
- **Logging:** The project uses a custom `Console` system (in `:api` module) for all user-facing CLI output. Framework internals (Hazelcast, Docker, K8s) use SLF4J/Logback. The `debug` flag in `config.json` controls both Console debug output and Logback levels.

## RuntimeProvider & RuntimeRegistry
- `RuntimeProvider` is defined in the `api` module. It is the abstraction for starting, stopping, and piping commands to an instance runtime.
- `RuntimeRegistry` is **Guice-managed and injected**. Extensions receive it via constructor/member injection and call `registry.register("key", provider)`. Do **not** use a static `object`.
- The core Wrapper daemon must **never** reference Docker directly. It only interacts with `RuntimeProvider` via the registry.

## Wrapper Architecture
- The Wrapper runs from the **same fat JAR** as the Master. It checks `UniverseMainConfiguration.isMasterNode`.
- The Wrapper does **not** start a Ktor server. It acts purely as a Hazelcast `IExecutorService` consumer.
- Guice modules bind regardless of node type. Unused Master-only services may bind to `null` or no-op implementations.
- **The Master also acts as a Wrapper.** When `isMasterNode = true`, the node starts the Ktor REST API **and** consumes `IExecutorService` tasks. It can host instances locally just like any other Wrapper node.
- **Instance IDs** are 6-character alphanumeric strings generated from `UUID.randomUUID()`, not full UUIDs.

## Command System Architecture
- Console commands are built on **Cloud v2** (`org.incendo.cloud`).
- `CommandProvider` is the abstraction; `CommandProviderImpl` wraps a `CommandManager<CommandSource>`.
- `CommandBootstrap` starts a daemon thread reading from `System.in` and dispatches to `CommandProvider.execute()`.
- `ManagementCommands` provides cluster, instance, config, template, extension, and system commands.
- The Ktor REST API exposes `POST /api/commands/execute` accepting `{ "command": "..." }` and returning captured output.
- `ConsoleCommandSource` implements `CommandSource` using the `Console` system for styled output.

## Template System Architecture
- `TemplateManager` resolves templates from `./templates/<group>/<name>/`, copies them to `./running/<instance-id>/`, and applies variable replacements.
- `TemplateVariableProvider` allows extensions to contribute custom variables (e.g., `%PORT%`, `%INSTANCE_ID%`).
- `DefaultTemplateVariableProvider` is bound as an eager singleton in `MainGuiceModule` and provides built-in variables: `%PORT%`, `%INSTANCE_ID%`, `%MASTER_IP%`, `%MASTER_ADDRESS%`, `%MASTER_PORT%`, `%MASTER_API_PORT%`, `%NODE_ID%`, `%HOST_ADDRESS%`, `%CONFIGURATION_NAME%`.
- `TemplateSyncService` zips templates and dispatches them to other cluster nodes via Hazelcast `IExecutorService`.
- `TemplateResolver` interface (in `extensions/api`) exposes `resolveTemplates(pattern: String)` for wildcard resolution.
- `TemplateStorageProvider` abstraction allows remote backends (e.g., S3) to store and retrieve template zips.

## Configuration Files
- `./config.json` — Main node configuration (`UniverseMainConfiguration`)
- `./configuration/<name>.json` — Instance configurations (`Configuration`)
- `./extensions/<ext>/config.json` — Extension-specific configs

## Minecraft Plugin Projects
- External plugins live under:
  - `/minecraft/modern` — targets Paper 1.21.4+
  - `/minecraft/legacy` — targets Spigot 1.8.8
  - `/minecraft/velocity` — targets Velocity 3.5.0
- `:minecraft:api` is a **JVM 8 compatible, zero-dependency** module for plugin developers. It is NOT relocated in shadow JARs so dependent plugins can find classes at runtime.

## Reference Libraries & Inspirations

### Console (Custom ANSI Logging)
- **Location:** `:api` module — `gg.scala.universe.console.Console` object and `log()` compatibility shim
- **Description:** Custom ANSI-styled console output system replacing PrettyLog. Provides tree-arrow prefixes (`→`, `✓`, `⚠`, `✗`), status badges, table formatting, and debug-gated output.
- **Usage in Universe:** All user-facing CLI logging uses `gg.scala.universe.console.log()` with `LogLevel` enum values (`INFO`, `SUCCESS`, `WARNING`, `ERROR`, `DEBUG`, `NETWORK`). Framework internals (Hazelcast, Docker, K8s) use SLF4J/Logback.
- **Key API:** `Console.info()`, `Console.success()`, `Console.warn()`, `Console.error()`, `Console.debug()`, `Console.network()`, `Console.badge()`, `Console.row()`, `Console.headerRow()`, `Console.kv()`, `Console.label()`.
- **Debug Mode:** `Console.setDebug(enabled)` gates `Console.debug()` output. The same flag controls Logback root/app logger levels via `configureLogbackLevels()`.

### Cloud Command Framework (Incendo)
- **Repository:** https://github.com/Incendo/cloud
- **Documentation:** https://cloud.incendo.org
- **Description:** JVM command dispatcher & framework supporting builder and annotation-based command definitions. Cloud v2 is the current major version.
- **Usage in Universe:** Console command handling is built on Cloud v2 (`org.incendo.cloud`). The project includes `cloud-core`, `cloud-annotations`, `cloud-kotlin-coroutines-annotations`, and `cloud-kotlin-extensions` in the `cloudCommands` bundle.
- **Key API:** `CommandManager<CommandSource>`, `@Command` annotations, `ExecutionCoordinator`, `CommandRegistrationHandler`.
- **Current Status:** `DefaultCommandManager.kt` implements `CommandManager<CommandSource>` and is fully wired into `CommandBootstrap`. `ManagementCommands` and `TemplateSyncCommand` provide the primary command set.

### CloudNet
- **Repository:** https://github.com/CloudNetService/CloudNet
- **Description:** A modern application that dynamically delivers Minecraft-oriented software. The primary architectural inspiration for Universe.
- **Inspiration Points:**
  - Master/Wrapper node architecture with cluster communication
  - Template-based instance deployment
  - Console command system structure (the `.java` command files in `/commands` are adapted from CloudNet)
  - `driver`/`node`/`wrapper` module separation patterns

### SimpleCloud
- **Organization:** https://github.com/simplecloudapp
- **Description:** Another Minecraft cloud orchestrator providing inspiration for the Universe project.
- **Inspiration Points:**
  - Controller / droplet architecture
  - Plugin ecosystem design
  - Server group and instance management patterns
