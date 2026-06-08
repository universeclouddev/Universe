package gg.scala.universe.runtime

import com.google.inject.Singleton
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import java.nio.file.Path
import java.util.concurrent.ConcurrentHashMap

/**
 * [RuntimeProvider] implementation using [tmux](https://github.com/tmux/tmux).
 *
 * Each instance runs in a dedicated tmux session named after the instance ID.
 * Commands are piped via `tmux send-keys`.
 */
@Singleton
class TmuxRuntimeProvider : RuntimeProvider {

    private val sessions = ConcurrentHashMap<String, ProcessHandle>()

    override fun start(
        instanceId: String,
        workingDir: Path,
        port: Int,
        command: String,
        ramMB: Int,
        cpu: Int,
        configuration: gg.scala.universe.schema.Configuration,
        environmentVariables: Map<String, String>?,
    ): ProcessHandle {
        val sessionName = sessionName(instanceId)

        // Ensure any stale session with this name is cleaned up first
        silentExec("tmux", "kill-session", "-t", sessionName)

        // Build command with resource limit fallback prefix
        val wrappedCommand = CgroupResourceEnforcer.buildFallbackPrefix(ramMB, cpu) + command

        val processBuilder = ProcessBuilder("tmux", "new-session", "-d", "-s", sessionName, "-c", workingDir.toAbsolutePath().toString(), wrappedCommand)
            .inheritIO()

        if (!environmentVariables.isNullOrEmpty()) {
            processBuilder.environment().putAll(environmentVariables)
        }

        val process = processBuilder.start()

        val handle = process.toHandle()
        sessions[instanceId] = handle

        // Attempt cgroup v2 enforcement
        val cgroupPath = CgroupResourceEnforcer.createCgroup(instanceId, ramMB, cpu)
        if (cgroupPath != null) {
            CgroupResourceEnforcer.movePidToCgroup(handle.pid(), cgroupPath)
        }

        log("Started tmux session '$sessionName' for instance $instanceId (PID ${handle.pid()})", LogLevel.SUCCESS)
        return handle
    }

    override fun stop(instanceId: String) {
        val sessionName = sessionName(instanceId)
        silentExec("tmux", "kill-session", "-t", sessionName)
        sessions.remove(instanceId)
        CgroupResourceEnforcer.cleanupCgroup(instanceId)
        log("Stopped tmux session '$sessionName' for instance $instanceId")
    }

    override fun executeCommand(instanceId: String, command: String) {
        val sessionName = sessionName(instanceId)
        val process = ProcessBuilder("tmux", "send-keys", "-t", sessionName, command, "Enter")
            .inheritIO()
            .start()
        process.waitFor()
        log("Executed command on tmux session '$sessionName': $command")
    }

    override fun isRunning(instanceId: String): Boolean {
        val sessionName = sessionName(instanceId)
        return try {
            ProcessBuilder("tmux", "has-session", "-t", sessionName)
                .inheritIO()
                .start()
                .waitFor() == 0
        } catch (_: Exception) {
            false
        }
    }

    override fun listRunningInstances(): List<String> {
        return try {
            val process = ProcessBuilder("tmux", "list-sessions", "-F", "#S")
                .redirectOutput(ProcessBuilder.Redirect.PIPE)
                .redirectError(ProcessBuilder.Redirect.DISCARD)
                .start()
            val output = process.inputStream.bufferedReader().readLines()
            process.waitFor()
            output.filter { it.startsWith("universe-") }.map { it.removePrefix("universe-") }
        } catch (_: Exception) {
            emptyList()
        }
    }

    override fun getLogs(instanceId: String, lines: Int): List<String> {
        val sessionName = sessionName(instanceId)
        return try {
            val process = ProcessBuilder("tmux", "capture-pane", "-p", "-t", sessionName, "-S", "-${lines}")
                .redirectOutput(ProcessBuilder.Redirect.PIPE)
                .redirectError(ProcessBuilder.Redirect.DISCARD)
                .start()
            val output = process.inputStream.bufferedReader().readLines()
            process.waitFor()
            output.filter { it.isNotBlank() }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun sessionName(instanceId: String): String = "universe-$instanceId"

    private fun silentExec(vararg command: String) {
        try {
            ProcessBuilder(*command).inheritIO().start().waitFor()
        } catch (_: Exception) {
            // ignored — session may not exist
        }
    }
}
