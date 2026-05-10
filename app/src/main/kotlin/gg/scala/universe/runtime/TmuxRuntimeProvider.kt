package gg.scala.universe.runtime

import com.google.inject.Singleton
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
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

    override fun start(instanceId: String, workingDir: Path, port: Int, command: String): ProcessHandle {
        val sessionName = sessionName(instanceId)

        // Ensure any stale session with this name is cleaned up first
        silentExec("tmux", "kill-session", "-t", sessionName)

        val process = ProcessBuilder("tmux", "new-session", "-d", "-s", sessionName, "-c", workingDir.toAbsolutePath().toString(), command)
            .inheritIO()
            .start()

        val handle = process.toHandle()
        sessions[instanceId] = handle

        log("Started tmux session '$sessionName' for instance $instanceId (PID ${handle.pid()})", LogType.SUCCESS)
        return handle
    }

    override fun stop(instanceId: String) {
        val sessionName = sessionName(instanceId)
        silentExec("tmux", "kill-session", "-t", sessionName)
        sessions.remove(instanceId)
        log("Stopped tmux session '$sessionName' for instance $instanceId", LogType.INFORMATION)
    }

    override fun executeCommand(instanceId: String, command: String) {
        val sessionName = sessionName(instanceId)
        val process = ProcessBuilder("tmux", "send-keys", "-t", sessionName, command, "Enter")
            .inheritIO()
            .start()
        process.waitFor()
        log("Executed command on tmux session '$sessionName': $command", LogType.INFORMATION)
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
