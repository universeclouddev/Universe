package gg.scala.universe.runtime

import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths

/**
 * Applies OS-level resource limits to processes using Linux cgroups v2.
 *
 * Falls back to ulimit/nice wrappers if cgroups are not available.
 * This is a best-effort enforcement — Docker runtime provides stricter guarantees.
 */
object CgroupResourceEnforcer {

    private const val CGROUP_BASE = "/sys/fs/cgroup"
    private val isCgroupV2Available = Files.exists(Paths.get(CGROUP_BASE, "cgroup.controllers"))

    /**
     * Attempts to create a cgroup for the given instance and configure resource limits.
     * Returns the cgroup path if successful, null otherwise.
     */
    fun createCgroup(instanceId: String, ramMB: Int, cpu: Int): Path? {
        if (!isCgroupV2Available) {
            return null
        }

        return try {
            val cgroupPath = Paths.get(CGROUP_BASE, "universe", instanceId)
            Files.createDirectories(cgroupPath)

            if (ramMB > 0) {
                val bytes = ramMB * 1024L * 1024L
                Files.write(cgroupPath.resolve("memory.max"), bytes.toString().toByteArray())
            }

            if (cpu > 0) {
                // cpu units: 100 = 1 core fully utilized
                // cgroup v2 cpu.max format: "quota period"
                // quota = cpu * 1000us, period = 100000us (100ms)
                val quota = cpu * 1000L
                val period = 100000L
                Files.write(cgroupPath.resolve("cpu.max"), "$quota $period".toByteArray())
            }

            log("Created cgroup v2 for instance $instanceId at $cgroupPath (ram=${ramMB}MB, cpu=$cpu)")
            cgroupPath
        } catch (e: Exception) {
            log("Failed to create cgroup for instance $instanceId: ${e.message}. Resource limits will not be enforced.", LogLevel.WARNING)
            null
        }
    }

    /**
     * Moves the given process PID into the specified cgroup.
     */
    fun movePidToCgroup(pid: Long, cgroupPath: Path): Boolean {
        return try {
            Files.write(cgroupPath.resolve("cgroup.procs"), pid.toString().toByteArray())
            true
        } catch (e: Exception) {
            log("Failed to move PID $pid into cgroup $cgroupPath: ${e.message}", LogLevel.WARNING)
            false
        }
    }

    /**
     * Builds a shell command prefix that applies ulimit for memory and nice for CPU priority.
     * Used as fallback when cgroups are unavailable.
     */
    fun buildFallbackPrefix(ramMB: Int, cpu: Int): String {
        val parts = mutableListOf<String>()

        if (ramMB > 0) {
            // ulimit -v limits virtual memory in KB
            parts.add("ulimit -v ${ramMB * 1024}")
        }

        if (cpu > 0) {
            // nice value: lower priority for higher CPU usage instances
            // cpu=100 (default) → nice 0
            // cpu=200 → nice -5 (higher priority? no, we want to throttle high CPU)
            // Actually nice doesn't enforce limits, just priority. Higher nice = lower priority.
            // If cpu > 100, the instance wants MORE cpu, so lower nice (higher priority)?
            // But the point is to LIMIT it, not prioritize it.
            // Let's just set a modest nice value to avoid starving other processes.
            val niceValue = if (cpu > 100) 5 else 0
            parts.add("nice -n $niceValue")
        }

        return if (parts.isEmpty()) "" else parts.joinToString(" && ") + " && "
    }

    /**
     * Cleans up the cgroup directory for an instance.
     */
    fun cleanupCgroup(instanceId: String) {
        if (!isCgroupV2Available) return

        try {
            val cgroupPath = Paths.get(CGROUP_BASE, "universe", instanceId)
            if (Files.exists(cgroupPath)) {
                // In cgroup v2, a cgroup must be empty before it can be deleted.
                // Move any remaining processes to the parent.
                val procsFile = cgroupPath.resolve("cgroup.procs")
                if (Files.exists(procsFile)) {
                    val pids = Files.readAllLines(procsFile)
                    val parentPath = Paths.get(CGROUP_BASE, "universe")
                    pids.forEach { pid ->
                        try {
                            Files.write(parentPath.resolve("cgroup.procs"), pid.toByteArray())
                        } catch (_: Exception) { }
                    }
                }
                Files.deleteIfExists(cgroupPath)
                log("Cleaned up cgroup for instance $instanceId")
            }
        } catch (e: Exception) {
            log("Failed to clean up cgroup for instance $instanceId: ${e.message}", LogLevel.WARNING)
        }
    }
}
