# Universe: AI Phased Implementation Plan

This plan outlines the sequential development phases for the Universe Orchestrator. AI Agents must complete all tasks and associated tests in a phase before moving to the next.

## Phase 1: Core State, Discovery, Ktor API & Models
**Goal:** Establish the foundational API models, the Hazelcast cluster communication, the Master's Ktor REST API, and enforce the "Instances Survive Disconnect" rule.

* **Task 1 — Schema Enhancements:**
  - Update `gg.scala.universe.schema.schemas.kt`:
    - Add `fileModifications: Map<String, String>` to `Configuration` for dynamic template editing.
    - Add `InstanceState` enum: `CREATING`, `ONLINE`, `OFFLINE`, `STOPPED`.
    - Add `InstanceInfo` data class:
      ```kotlin
      data class InstanceInfo(
          val id: UUID,
          val configurationName: String,
          val wrapperNodeId: String,
          val hostAddress: String,
          val allocatedPort: Int,
          val state: InstanceState,
          val lastHeartbeat: Long,
          val processPid: Long?
      )
      ```
  - Ensure `portRange` is present on `Configuration`.

* **Task 2 — Abstract Runtime API:**
  - Create `RuntimeProvider` interface in `api` module:
    ```kotlin
    interface RuntimeProvider {
        fun start(instanceId: UUID, workingDir: Path, port: Int, command: String): ProcessHandle
        fun stop(instanceId: UUID)
        fun executeCommand(instanceId: UUID, command: String)
    }
    ```
  - Create `RuntimeRegistry` interface in `api` module:
    ```kotlin
    interface RuntimeRegistry {
        fun register(key: String, provider: RuntimeProvider)
        fun unregister(key: String)
        fun get(key: String): RuntimeProvider?
        fun getAll(): Map<String, RuntimeProvider>
    }
    ```
  - Implement `RuntimeRegistry` as a Guice-managed singleton in `app` module (backed by a `ConcurrentHashMap`).

* **Task 3 — Hazelcast State:**
  - Create `ClusterStateService` in `app` module.
  - Manage two `IMap`s:
    - `"configurations"` — `Map<String, Configuration>` (key = configuration name).
    - `"instances"` — `Map<UUID, InstanceInfo>` (key = instance ID).
  - Provide helper methods: `getConfiguration(name)`, `getInstance(id)`, `getAllInstances()`, `putInstance(info)`, etc.

* **Task 4 — The Ktor REST API:**
  - Add Ktor 3.4.3 (Netty engine) to `gradle/libs.versions.toml` as a `runtimeDownload` bundle `[bundles] ktor`.
  - Consume the bundle in `app/build.gradle.kts` via `runtimeDownload(libs.bundles.ktor)`.
  - Initialize Ktor Server **only on the Master node** (check `UniverseMainConfiguration.isMasterNode`).
  - Use the Sigma REST reference for module structure:
    - `GsonConverter` implementing `ContentConverter` for Gson serialization.
    - `configureSerialization()` — installs `ContentNegotiation` with `GsonConverter`.
    - `configureSecurity()` — Bearer auth with `public` realm (API key optional for `/public` routes).
    - `configureCors()` — allow GET, PUT, DELETE, Authorization header.
    - `configureLoggingMessages()` — log incoming requests via PrettyLog.
    - `configureExceptionCatcher()` — catch all exceptions, return 500 with error JSON.
  - Expose endpoints:
    - `GET /api/instances` — returns all `InstanceInfo` entries.
    - `POST /api/instances` — accepts a configuration name, creates a new `InstanceInfo` with `CREATING` state, assigns it to an available Wrapper, and dispatches a `DeployInstanceTask` via `IExecutorService`.
    - `PUT /api/instances/{id}/state` — accepts `{ state: "ONLINE" | "OFFLINE" }` and heartbeat timestamp. Updates the `InstanceInfo` in Hazelcast.

* **Task 5 — Resilience:**
  - Implement Hazelcast `MembershipListener` on the Master.
  - On `memberRemoved`:
    - Identify the disconnected Wrapper by its node ID (Hazelcast member UUID mapped to `nodeId`).
    - Mark the Wrapper as offline.
    - **DO NOT remove** the associated `InstanceInfo` entries from the `"instances"` map.
    - Set `InstanceInfo.state = OFFLINE` for all instances running on that Wrapper.
  - Await Ktor pings from the Minecraft plugin to restore `state = ONLINE` when the instance comes back or is restarted on a new Wrapper.

## Phase 2: Command Dispatch & Console Piping
**Goal:** Master sends generic "Lifecycle Orders" and "Console Commands" to Wrappers without knowing *how* the Wrapper will execute them.
* **Tasks:**
  1. Define `DeployInstanceTask`, `StopInstanceTask`, and `ExecuteCommandTask` (implementing Hazelcast serialization).
  2. Implement the dispatcher on the Master using Hazelcast's `IExecutorService`.
  3. On the Wrapper, route `ExecuteCommandTask` to the instance's active `RuntimeProvider.executeCommand()` method.

## Phase 3: Port Allocation & Raw Process Management (Wrapper Core)
**Goal:** Implement the default, non-containerized execution runtimes and port bindings.
* **Tasks:**
  1. **Port Allocation:** Before starting an instance, the Wrapper reads `Configuration.availablePorts`. It tests local ports starting from `min` to `max`. It locks the lowest available port and updates the Master's `InstanceInfo`.
  2. **Runtime Providers:** Create `TmuxRuntimeProvider` and `ScreenRuntimeProvider` in the `app` module.
  3. **Stdin Piping:** Implement `executeCommand()` in the Tmux/Screen providers to pipe string commands directly into the terminal multiplexer's standard input.

## Phase 4: Local Template Synchronization & Dynamic Editing
**Goal:** The Wrapper resolves, copies, and dynamically modifies files required to run the instance.
* **Tasks:**
  1. Create the `TemplateManager`. Default behavior resolves templates from `./templates/<group>/<name>`.
  2. Parse the `TemplateInstallationConfig` and copy files to `./running/<instance-id>`.
  3. **Variable Replacement Engine:** After copying, read the files specified in the configuration's file modification rules. Search for strings like `%PORT%`, `%MASTER_IP%`, `%INSTANCE_ID%`, and replace them with the actual allocated values. Write the files back to disk.

## Phase 5: The Docker Extension Implementation
**Goal:** Provide Docker support seamlessly without polluting the core codebase.
* **Tasks:**
  1. Create `extensions/docker-runtime`. Add the `docker-java` dependency strictly here.
  2. Implement `DockerRuntimeProvider`. For `start()`, use Docker API to mount the `./running/<instance-id>` folder and bind the allocated port. For `executeCommand()`, attach to the container's `stdin`.
  3. Register `"docker"` in the `RuntimeRegistry` during extension load.

## Phase 6: The Minecraft Integration Plugin (External)
**Goal:** Build the Bukkit/Paper plugin that connects the instance to the Master.
* **Tasks:**
  1. Create a separate plugin project (or an extension that compiles to a Bukkit JAR). Shade the Universe `api` module.
  2. **State Reporting:** On `onEnable()`, the plugin hits the Master's Ktor REST API to report `ONLINE`. Setup a repeating task for heartbeat pings.
  3. **Command Interception:** Hook into the Ktor API (or listen for a specific payload) to execute commands via `Bukkit.dispatchCommand(Bukkit.getConsoleSender(), command)` instead of relying strictly on `stdin` piping.