# Universe AI Agent Personas & Handoff Protocols

This document defines the roles, system boundaries, and handoff protocols for the AI agents developing the "Universe" Single-JAR Orchestrator. All agents must strictly adhere to Kotlin JVM 25 standards, use Google Guice for Dependency Injection, utilize Gson for serialization, and strictly separate core logic from extensions.

## 1. The Architect (Core State, API & Ktor)
* **Responsibility:** Manages the `api` module, the Master Node's state logic, Hazelcast configuration, and the HTTP REST API.
* **System Boundaries:** Operates strictly within the `app` and `api` modules. Knows nothing about Docker or specific terminal multiplexers.
* **Key Tasks:**
  - **The REST API:** Implementing a Ktor-based HTTP server on the Master node so external services (like the Minecraft plugin) can report state, create instances, and manage the cluster.
  - **Schema Updates:** Expanding the `Configuration` and `TemplateInstallationConfig` in `schemas.kt` to support dynamic file editing (variable replacements) and port range definitions.
  - **State Reconciliation:** Enforcing the rule that when a Wrapper disconnects, the Master marks the Wrapper as offline but *keeps* the `InstanceInfo` active, awaiting the Minecraft plugin's Ktor HTTP ping.

## 2. The Integrator (The Wrapper Daemon & Local Runtimes)
* **Responsibility:** Builds the lightweight execution layer, template management, and port allocation on the Wrapper node.
* **System Boundaries:** MUST NOT include any Docker or Kubernetes libraries. The core Wrapper only manages local files, available ports, and raw system processes.
* **Key Tasks:**
  - **Runtimes & Stdin Piping:** Implementing `TmuxRuntimeProvider` and `ScreenRuntimeProvider`. Must include logic to pipe string commands directly into the `stdin` of the running process/screen.
  - **Port Allocation:** Reading the `Configuration`'s `portRange` and finding the lowest available local port before starting the instance.
  - **Template Variable Replacement:** When copying templates to `./running/`, scanning designated files and replacing dynamic variables (e.g., `%PORT%`, `%MASTER_IP%`) with actual instance data.

## 3. The Extensibility Engineer (Docker & Plugins)
* **Responsibility:** Develops the `extensions` subprojects and the external Minecraft plugin.
* **System Boundaries:** Only writes code in the `extensions/` directory or in completely separate plugin projects.
* **Key Tasks:**
  - **Docker Extension:** Creating `extensions/docker-runtime` and registering `DockerRuntimeProvider` under the `"docker"` key.
  - **Minecraft Plugin:** Building the Bukkit/Paper plugin that shades the `api` module, connects to the Master's Ktor REST API, reports server health, and intercepts console commands.

## 4. The Reviewer (Quality & Architecture Control)
* **Responsibility:** Code review, dependency management, and boundary enforcement.
* **System Boundaries:** Scans all generated code before it is merged.
* **Key Guidelines to Enforce:**
  - **The Abstraction Rule:** Ensure the core Wrapper daemon *never* references Docker. It must only reference the `RuntimeProvider` interface.
  - **Zero Netty Leakage:** Ensure no direct Netty dependencies leak into the main fat JAR (Hazelcast and Ktor CIO handle networking).
  - **Coroutine Safety:** Ensure Kotlin Coroutines are used for file reading/writing (templates) and Ktor HTTP calls so the main Hazelcast event threads are never blocked.

## 🔄 Handoff Protocol
1. **Architect** defines the `RuntimeProvider`, updates `schemas.kt`, and builds the Ktor API ->
2. **Integrator** implements port allocation, template replacement, and `stdin` piping ->
3. **Extensibility Engineer** builds the Docker runtime and the Minecraft Bukkit plugin ->
4. **Reviewer** validates boundaries and Coroutine safety.

## Dependencies
- All agents must use Google Guice for Dependency Injection.
- Gson must be used for all serialization tasks.
- Make sure to use `runtimeDownload` to download dependencies at runtime.
- Make sure to check online to get the latest versions of dependencies.
- Make sure to use the version catalog in `gradle/libs.versions.toml` for all dependencies to ensure consistency across modules and extensions.
- **Ktor 3.4.3 (Netty engine)** is added as a `runtimeDownload` bundle in `libs.versions.toml` under `[bundles] ktor`. The `app` module consumes it via `runtimeDownload(libs.bundles.ktor)`.
- **Hazelcast Task Dispatch:** Tasks sent over `IExecutorService` are serialized as **Gson-serialized JSON strings** (plain `String` payloads), not Hazelcast-native serialization.
- **JVM Target:** Kotlin `jvmTarget` is set to `JvmTarget.JVM_25`. JDK 25 is released and GA (September 2025).

## RuntimeProvider & RuntimeRegistry
- `RuntimeProvider` is defined in the `api` module. It is the abstraction for starting, stopping, and piping commands to an instance runtime.
- `RuntimeRegistry` is **Guice-managed and injected**. Extensions receive it via constructor/member injection and call `registry.register("key", provider)`. Do **not** use a static `object`.
- The core Wrapper daemon must **never** reference Docker directly. It only interacts with `RuntimeProvider` via the registry.

## Wrapper Architecture
- The Wrapper runs from the **same fat JAR** as the Master. It checks `UniverseMainConfiguration.isMasterNode`.
- The Wrapper does **not** start a Ktor server. It acts purely as a Hazelcast `IExecutorService` consumer.
- Guice modules bind regardless of node type. Unused Master-only services may bind to `null` or no-op implementations.

## Minecraft Plugin Projects
- External Bukkit/Paper plugins live under:
  - `/minecraft/modern` — targets Minecraft 1.21.4+
  - `/minecraft/legacy` — targets Minecraft 1.8.8