package gg.scala.universe.minecraft.api

/**
 * Information about a Universe instance.
 *
 * ```java
 * String id = info.getId();
 * String address = info.getHostAddress() + ":" + info.getAllocatedPort();
 * ```
 */
data class InstanceInfo(
    val id: String,
    val configurationName: String,
    val wrapperNodeId: String,
    val hostAddress: String,
    val allocatedPort: Int,
    val state: String,
    val lastHeartbeat: Long,
    val processPid: Long? = null,
    val allocatedRamMB: Int = 0,
    val allocatedCpu: Int = 0,
    val runtime: String = "screen",
    val players: Int = 0,
    val maxPlayers: Int = 0
) {

    /**
     * Returns the state as an [InstanceState] enum.
     */
    fun getStateEnum(): InstanceState {
        return try {
            InstanceState.valueOf(state)
        } catch (_: IllegalArgumentException) {
            InstanceState.STOPPED
        }
    }

    /**
     * Returns the full address as "host:port".
     */
    fun getAddress(): String = "$hostAddress:$allocatedPort"

    /**
     * Returns true if this instance is currently online.
     */
    fun isOnline(): Boolean = state == "ONLINE"

    class Builder {
        private var id: String = ""
        private var configurationName: String = ""
        private var wrapperNodeId: String = ""
        private var hostAddress: String = "127.0.0.1"
        private var allocatedPort: Int = 0
        private var state: String = "CREATING"
        private var lastHeartbeat: Long = 0
        private var processPid: Long? = null
        private var allocatedRamMB: Int = 0
        private var allocatedCpu: Int = 0
        private var runtime: String = "screen"
        private var players: Int = 0
        private var maxPlayers: Int = 0

        fun id(id: String) = apply { this.id = id }
        fun configurationName(name: String) = apply { this.configurationName = name }
        fun wrapperNodeId(nodeId: String) = apply { this.wrapperNodeId = nodeId }
        fun hostAddress(address: String) = apply { this.hostAddress = address }
        fun allocatedPort(port: Int) = apply { this.allocatedPort = port }
        fun state(state: String) = apply { this.state = state }
        fun state(state: InstanceState) = apply { this.state = state.name }
        fun lastHeartbeat(time: Long) = apply { this.lastHeartbeat = time }
        fun processPid(pid: Long?) = apply { this.processPid = pid }
        fun allocatedRamMB(ram: Int) = apply { this.allocatedRamMB = ram }
        fun allocatedCpu(cpu: Int) = apply { this.allocatedCpu = cpu }
        fun runtime(runtime: String) = apply { this.runtime = runtime }
        fun players(players: Int) = apply { this.players = players }
        fun maxPlayers(max: Int) = apply { this.maxPlayers = max }

        fun build() = InstanceInfo(
            id = id,
            configurationName = configurationName,
            wrapperNodeId = wrapperNodeId,
            hostAddress = hostAddress,
            allocatedPort = allocatedPort,
            state = state,
            lastHeartbeat = lastHeartbeat,
            processPid = processPid,
            allocatedRamMB = allocatedRamMB,
            allocatedCpu = allocatedCpu,
            runtime = runtime,
            players = players,
            maxPlayers = maxPlayers
        )
    }
}
