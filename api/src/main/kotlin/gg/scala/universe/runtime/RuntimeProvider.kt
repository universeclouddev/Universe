package gg.scala.universe.runtime

import gg.scala.universe.schema.TemplateInstallationConfig
import java.nio.file.Path

/**
 * Abstraction for starting, stopping, and piping commands to an instance runtime.
 *
 * Concrete implementations (e.g., Tmux, Screen, Docker) are registered
 * via [RuntimeRegistry] under a technology key.
 */
interface RuntimeProvider {
    /**
     * Starts a new process for the given instance.
     *
     * @param instanceId Unique 6-character identifier for the instance.
     * @param workingDir Directory in which the process should run.
     * @param port The allocated local port for the instance.
     * @param command The command string to execute.
     * @param ramMB Maximum RAM the instance may use (in megabytes). Zero means unlimited.
     * @param cpu Maximum CPU units the instance may use. Zero means unlimited.
     * @param templateConfig Optional template installation config. Runtimes that support
     *        init containers (e.g., K8s) can use this to pre-populate the working directory.
     * @return A [ProcessHandle] representing the started process.
     */
    fun start(
        instanceId: String,
        workingDir: Path,
        port: Int,
        command: String,
        ramMB: Int,
        cpu: Int,
        templateConfig: TemplateInstallationConfig? = null
    ): ProcessHandle

    /**
     * Stops the process associated with the given instance.
     *
     * @param instanceId Unique 6-character identifier for the instance.
     */
    fun stop(instanceId: String)

    /**
     * Pipes a command string into the stdin of the running process
     * for the given instance.
     *
     * @param instanceId Unique 6-character identifier for the instance.
     * @param command The command to send.
     */
    fun executeCommand(instanceId: String, command: String)

    /**
     * Returns true if the instance is currently running.
     *
     * @param instanceId Unique 6-character identifier for the instance.
     */
    fun isRunning(instanceId: String): Boolean

    /**
     * Returns a list of instance IDs currently managed by this runtime.
     * Used for instance recovery after node restart.
     */
    fun listRunningInstances(): List<String> = emptyList()
}
