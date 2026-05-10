package gg.scala.universe.runtime

import com.google.inject.Inject
import com.google.inject.Singleton
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import gg.scala.universe.schema.PortRange
import java.net.ServerSocket
import java.util.concurrent.ConcurrentHashMap

/**
 * Scans local port ranges and allocates the lowest available port.
 *
 * Ports are tracked in-memory to avoid allocating the same port twice
 * within the same JVM instance. The actual availability test is performed
 * by attempting to bind a [ServerSocket].
 */
@Singleton
class PortAllocator @Inject constructor() {

    private val allocatedPorts = ConcurrentHashMap.newKeySet<Int>()

    /**
     * Finds and locks the lowest available port in the given [range].
     *
     * @param range The inclusive min/max port range to scan.
     * @return The allocated port number, or `null` if none are available.
     */
    fun allocate(range: PortRange): Int? {
        for (port in range.min..range.max) {
            if (allocatedPorts.contains(port)) continue

            if (isPortAvailable(port)) {
                allocatedPorts.add(port)
                log("Allocated port $port (range ${range.min}-${range.max})", LogType.INFORMATION)
                return port
            }
        }

        log("No available ports in range ${range.min}-${range.max}", LogType.ERROR)
        return null
    }

    /**
     * Releases a previously allocated port so it can be reused.
     */
    fun release(port: Int) {
        if (allocatedPorts.remove(port)) {
            log("Released port $port", LogType.INFORMATION)
        }
    }

    private fun isPortAvailable(port: Int): Boolean {
        return try {
            ServerSocket(port).use { true }
        } catch (_: Exception) {
            false
        }
    }
}
