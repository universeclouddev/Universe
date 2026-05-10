package gg.scala.universe.hz

import com.google.inject.Inject
import com.hazelcast.core.HazelcastInstance
import com.hazelcast.map.IMap
import gg.scala.universe.schema.Configuration
import gg.scala.universe.schema.InstanceInfo
import gg.scala.universe.schema.InstanceState

class ClusterStateService @Inject constructor(
    private val hazelcastInstance: HazelcastInstance
) {
    val configurations: IMap<String, Configuration>
        get() = hazelcastInstance.getMap("configurations")

    val instances: IMap<String, InstanceInfo>
        get() = hazelcastInstance.getMap("instances")

    fun getConfiguration(name: String): Configuration? {
        return configurations[name]
    }

    fun putConfiguration(configuration: Configuration) {
        configurations[configuration.name] = configuration
    }

    fun getInstance(id: String): InstanceInfo? {
        return instances[id]
    }

    fun getAllInstances(): Collection<InstanceInfo> {
        return instances.values
    }

    fun putInstance(info: InstanceInfo) {
        instances[info.id] = info
    }

    fun removeInstance(id: String) {
        instances.remove(id)
    }

    fun getInstancesByWrapper(nodeId: String): List<InstanceInfo> {
        return instances.values.filter { it.wrapperNodeId == nodeId }
    }

    fun updateInstanceState(id: String, state: InstanceState) {
        val existing = instances[id] ?: return
        instances[id] = existing.copy(state = state)
    }
}
