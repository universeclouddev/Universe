package gg.scala.universe.service

import com.google.inject.Inject
import com.google.inject.Singleton
import com.hazelcast.cluster.Member
import com.hazelcast.core.HazelcastInstance
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import gg.scala.universe.hz.ClusterStateService
import gg.scala.universe.hz.task.TaskDispatcher
import gg.scala.universe.schema.Configuration
import gg.scala.universe.schema.InstanceInfo
import gg.scala.universe.schema.InstanceState
import gg.scala.universe.util.InstanceIdGenerator

/**
 * Centralized service for creating and dispatching instances.
 * Handles resource-aware node selection, InstanceInfo construction,
 * state persistence, and deployment dispatching.
 */
@Singleton
class InstanceCreationService @Inject constructor(
    private val clusterStateService: ClusterStateService,
    private val hazelcastInstance: HazelcastInstance,
    private val taskDispatcher: TaskDispatcher
) {

    /**
     * Creates a single instance from the given configuration.
     * Performs resource-aware node selection and dispatches the deploy task.
     *
     * @param configuration The configuration to use
     * @param instanceId Optional explicit ID (for static instances). If null, a random ID is generated.
     * @return The created [InstanceInfo] if a suitable node was found, null otherwise.
     */
    fun createInstance(configuration: Configuration, instanceId: String? = null): InstanceInfo? {
        val id = instanceId ?: InstanceIdGenerator.generate()

        val wrapperMember = findBestNode(configuration)
        if (wrapperMember == null) {
            log(
                "No node has enough resources (RAM=${configuration.ramMB}MB, CPU=${configuration.cpu}) " +
                "for instance '$id'.",
                LogType.WARNING
            )
            return null
        }

        val instanceInfo = InstanceInfo(
            id = id,
            configurationName = configuration.name,
            wrapperNodeId = wrapperMember.uuid.toString(),
            hostAddress = configuration.hostAddress,
            allocatedPort = 0,
            state = InstanceState.CREATING,
            lastHeartbeat = System.currentTimeMillis(),
            processPid = null,
            allocatedRamMB = configuration.ramMB,
            allocatedCpu = configuration.cpu
        )

        clusterStateService.putInstance(instanceInfo)
        taskDispatcher.dispatchDeploy(instanceInfo, wrapperMember)

        return instanceInfo
    }

    /**
     * Finds the cluster node with the most available RAM that can fit the given configuration.
     * Returns null if no node has enough resources.
     */
    fun findBestNode(configuration: Configuration): Member? {
        val candidates = hazelcastInstance.cluster.members.filter { member ->
            val nodeId = member.uuid.toString()
            val resources = clusterStateService.getNodeResources(nodeId)
            val maxRam = member.getAttribute("maxRamMB")?.toIntOrNull() ?: Int.MAX_VALUE
            val maxCpu = member.getAttribute("maxCpu")?.toIntOrNull() ?: Int.MAX_VALUE

            resources.usedRamMB + configuration.ramMB <= maxRam &&
            resources.usedCpu + configuration.cpu <= maxCpu
        }

        if (candidates.isEmpty()) {
            return null
        }

        // Pick the node with the most available RAM
        return candidates.maxByOrNull { member ->
            val nodeId = member.uuid.toString()
            val resources = clusterStateService.getNodeResources(nodeId)
            val maxRam = member.getAttribute("maxRamMB")?.toIntOrNull() ?: Int.MAX_VALUE
            maxRam - resources.usedRamMB
        }
    }
}
