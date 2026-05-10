package gg.scala.universe.runtime

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
     * @return A [ProcessHandle] representing the started process.
     */
    fun start(instanceId: String, workingDir: Path, port: Int, command: String): ProcessHandle

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
}
