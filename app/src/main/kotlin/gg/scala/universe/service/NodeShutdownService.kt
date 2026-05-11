package gg.scala.universe.service

import com.google.inject.Inject
import com.google.inject.Singleton
import com.hazelcast.core.HazelcastInstance
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import gg.scala.universe.hz.ClusterStateService
import gg.scala.universe.runtime.PortAllocator
import gg.scala.universe.runtime.RuntimeRegistry
import gg.scala.universe.schema.InstanceState
import java.nio.file.Files
import java.nio.file.Paths
import java.util.Comparator

/**
 * Gracefully stops all instances running on the local node.
 *
 * Called during shutdown (both console `stop` command and JVM shutdown hook)
 * to ensure no orphaned processes, containers, or resource leaks remain.
 */
@Singleton
class NodeShutdownService @Inject constructor(
    private val clusterStateService: ClusterStateService,
    private val hazelcastInstance: HazelcastInstance,
    private val runtimeRegistry: RuntimeRegistry,
    private val portAllocator: PortAllocator
) {

    /**
     * Stops all instances whose wrapperNodeId matches the local Hazelcast member.
     * Releases ports, node resources, and cleans up working directories.
     */
    fun stopAllLocalInstances() {
        val localNodeId = hazelcastInstance.cluster.localMember.uuid.toString()
        val localInstances = clusterStateService.getAllInstances()
            .filter { it.wrapperNodeId == localNodeId }

        if (localInstances.isEmpty()) {
            log("No local instances to stop", LogType.INFORMATION)
            return
        }

        log("Stopping ${localInstances.size} local instance(s)...", LogType.INFORMATION)

        for (instance in localInstances) {
            val config = clusterStateService.getConfiguration(instance.configurationName)
            val runtimeKey = config?.runtime ?: instance.configurationName
            val runtimeProvider = runtimeRegistry.get(runtimeKey)
                ?: runtimeRegistry.getAll().values.firstOrNull()

            if (runtimeProvider != null) {
                try {
                    runtimeProvider.stop(instance.id)
                    log("Stopped instance ${instance.id} (runtime=$runtimeKey)", LogType.INFORMATION)
                } catch (e: Exception) {
                    log("Failed to stop instance ${instance.id}: ${e.message}", LogType.WARNING)
                }
            }

            // Release port
            portAllocator.release(instance.allocatedPort)

            // Release node resources
            clusterStateService.removeNodeResources(localNodeId, instance.allocatedRamMB, instance.allocatedCpu)

            // Clean up working directory for non-static instances
            if (config?.static != true) {
                val workingDir = Paths.get("./running/${instance.id}").toAbsolutePath().normalize()
                try {
                    if (Files.exists(workingDir)) {
                        Files.walk(workingDir)
                            .sorted(Comparator.reverseOrder())
                            .forEach { Files.deleteIfExists(it) }
                        log("Cleaned up working directory for instance ${instance.id}", LogType.INFORMATION)
                    }
                } catch (cleanupEx: Exception) {
                    log("Failed to clean up working directory for instance ${instance.id}: ${cleanupEx.message}", LogType.WARNING)
                }
            }

            // Mark as STOPPED
            clusterStateService.updateInstanceState(instance.id, InstanceState.STOPPED)
        }

        log("All local instances stopped", LogType.SUCCESS)
    }
}
