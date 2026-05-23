package gg.scala.universe.runtime

import com.google.inject.Singleton
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import java.nio.file.Path
import java.util.concurrent.ConcurrentHashMap

/**
 * [RuntimeProvider] that runs the instance command directly as a subprocess.
 *
 * This is the preferred runtime for Docker containers where screen/tmux
 * are not available. Stdout and stderr are redirected to log files in
 * the instance working directory.
 */
@Singleton
class ProcessRuntimeProvider : RuntimeProvider {

    private val processes = ConcurrentHashMap<String, Process>()

    override fun start(
        instanceId: String,
        workingDir: Path,
        port: Int,
        command: String,
        ramMB: Int,
        cpu: Int,
        configuration: gg.scala.universe.schema.Configuration,
        environmentVariables: Map<String, String>?
    ): ProcessHandle {
        if (command.isBlank()) {
            throw IllegalArgumentException("Command is blank for instance $instanceId")
        }

        val logOut = workingDir.resolve("stdout.log").toFile()
        val logErr = workingDir.resolve("stderr.log").toFile()

        // Build command with resource limit fallback prefix
        val wrappedCommand = CgroupResourceEnforcer.buildFallbackPrefix(ramMB, cpu) + command

        val processBuilder = ProcessBuilder("bash", "-c", wrappedCommand)
            .directory(workingDir.toFile())
            .redirectOutput(ProcessBuilder.Redirect.to(logOut))
            .redirectError(ProcessBuilder.Redirect.to(logErr))
            .redirectInput(ProcessBuilder.Redirect.PIPE)

        if (!environmentVariables.isNullOrEmpty()) {
            processBuilder.environment().putAll(environmentVariables)
        }

        val process = processBuilder.start()

        processes[instanceId] = process

        // Attempt cgroup v2 enforcement
        val cgroupPath = CgroupResourceEnforcer.createCgroup(instanceId, ramMB, cpu)
        if (cgroupPath != null) {
            CgroupResourceEnforcer.movePidToCgroup(process.pid(), cgroupPath)
        }

        log("Started process for instance $instanceId (PID ${process.pid()})", LogLevel.SUCCESS)
        return process.toHandle()
    }

    override fun stop(instanceId: String) {
        val process = processes.remove(instanceId) ?: return
        process.destroy()
        CgroupResourceEnforcer.cleanupCgroup(instanceId)
        log("Stopped process for instance $instanceId")
    }

    override fun executeCommand(instanceId: String, command: String) {
        val process = processes[instanceId]
            ?: return log("No process found for instance $instanceId", LogLevel.WARNING)

        process.outputStream.bufferedWriter().use {
            it.write(command)
            it.newLine()
            it.flush()
        }
        log("Executed command on instance $instanceId: $command")
    }

    override fun isRunning(instanceId: String): Boolean {
        val process = processes[instanceId] ?: return false
        return process.isAlive
    }

    override fun listRunningInstances(): List<String> {
        return processes.keys.toList()
    }
}
