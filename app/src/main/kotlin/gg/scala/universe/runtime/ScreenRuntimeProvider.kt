package gg.scala.universe.runtime

import com.google.inject.Singleton
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import java.nio.file.Path
import java.util.concurrent.ConcurrentHashMap

/**
 * [RuntimeProvider] implementation using [GNU Screen](https://www.gnu.org/software/screen/).
 *
 * Each instance runs in a dedicated screen session named after the instance ID.
 * Commands are piped via `screen -X stuff`.
 */
@Singleton
class ScreenRuntimeProvider : RuntimeProvider {

    private val sessions = ConcurrentHashMap<String, ProcessHandle>()

    override fun start(instanceId: String, workingDir: Path, port: Int, command: String): ProcessHandle {
        val sessionName = sessionName(instanceId)

        // Ensure any stale session with this name is cleaned up first
        silentExec("screen", "-S", sessionName, "-X", "quit")

        // Start a detached screen session that changes to the working dir and runs the command
        val shellCommand = "cd ${workingDir.toAbsolutePath()} && $command"
        val process = ProcessBuilder("screen", "-dmS", sessionName, "bash", "-c", shellCommand)
            .inheritIO()
            .start()

        val handle = process.toHandle()
        sessions[instanceId] = handle

        log("Started screen session '$sessionName' for instance $instanceId (PID ${handle.pid()})", LogType.SUCCESS)
        return handle
    }

    override fun stop(instanceId: String) {
        val sessionName = sessionName(instanceId)
        silentExec("screen", "-S", sessionName, "-X", "quit")
        sessions.remove(instanceId)
        log("Stopped screen session '$sessionName' for instance $instanceId", LogType.INFORMATION)
    }

    override fun executeCommand(instanceId: String, command: String) {
        val sessionName = sessionName(instanceId)
        val process = ProcessBuilder("screen", "-S", sessionName, "-X", "stuff", "$command\n")
            .inheritIO()
            .start()
        process.waitFor()
        log("Executed command on screen session '$sessionName': $command", LogType.INFORMATION)
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
