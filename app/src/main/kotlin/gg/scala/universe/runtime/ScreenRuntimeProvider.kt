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

    override fun start(
        instanceId: String,
        workingDir: Path,
        port: Int,
        command: String,
        ramMB: Int,
        cpu: Int,
        templateConfig: gg.scala.universe.schema.TemplateInstallationConfig?,
        environmentVariables: Map<String, String>?
    ): ProcessHandle {
        val sessionName = sessionName(instanceId)

        // Ensure any stale session with this name is cleaned up first
        silentExec("screen", "-S", sessionName, "-X", "quit")

        // Build command with resource limit fallback prefix
        val prefix = CgroupResourceEnforcer.buildFallbackPrefix(ramMB, cpu)
        val shellCommand = "cd ${workingDir.toAbsolutePath()} && $prefix$command"
        val processBuilder = ProcessBuilder("screen", "-dmS", sessionName, "bash", "-c", shellCommand)
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

        log("Started screen session '$sessionName' for instance $instanceId (PID ${handle.pid()})", LogType.SUCCESS)
        return handle
    }

    override fun stop(instanceId: String) {
        val sessionName = sessionName(instanceId)
        silentExec("screen", "-S", sessionName, "-X", "quit")
        sessions.remove(instanceId)
        CgroupResourceEnforcer.cleanupCgroup(instanceId)
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

    override fun isRunning(instanceId: String): Boolean {
        val sessionName = sessionName(instanceId)
        return try {
            val process = ProcessBuilder("screen", "-ls")
                .redirectOutput(ProcessBuilder.Redirect.PIPE)
                .redirectError(ProcessBuilder.Redirect.DISCARD)
                .start()
            val output = process.inputStream.bufferedReader().readText()
            process.waitFor()
            output.contains(sessionName)
        } catch (_: Exception) {
            false
        }
    }

    override fun listRunningInstances(): List<String> {
        return try {
            val process = ProcessBuilder("screen", "-ls")
                .redirectOutput(ProcessBuilder.Redirect.PIPE)
                .redirectError(ProcessBuilder.Redirect.DISCARD)
                .start()
            val output = process.inputStream.bufferedReader().readText()
            process.waitFor()
            output.lines()
                .filter { it.contains("universe-") }
                .mapNotNull { line ->
                    Regex("universe-([a-zA-Z0-9]+)").find(line)?.groupValues?.get(1)
                }
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
