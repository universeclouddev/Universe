package gg.scala.universe.minecraft.api

/**
 * Universe instance configuration.
 *
 * ```java
 * Configuration config = new Configuration.Builder()
 *     .name("lobby")
 *     .runtime("docker")
 *     .command("java -jar paper.jar")
 *     .ramMB(4096)
 *     .portRange(new PortRange(25565, 25570))
 *     .build();
 * ```
 */
data class Configuration(
    val name: String = "default",
    val runtime: String = "screen",
    val command: String = "",
    val static: Boolean = false,
    val ramMB: Int = 2048,
    val cpu: Int = 100,
    val instanceGroups: List<String> = emptyList(),
    val nodes: List<String> = listOf("node-1"),
    val hostAddress: String = "127.0.0.1",
    val availablePorts: PortRange = PortRange(25565, 25570),
    val minimumServiceCount: Int = 1,
    val environmentVariables: Map<String, String> = emptyMap(),
    val fileModifications: List<String> = emptyList(),
    val properties: Map<String, String> = emptyMap()
) {

    class Builder {
        private var name: String = "default"
        private var runtime: String = "screen"
        private var command: String = ""
        private var static: Boolean = false
        private var ramMB: Int = 2048
        private var cpu: Int = 100
        private var instanceGroups: List<String> = emptyList()
        private var nodes: List<String> = listOf("node-1")
        private var hostAddress: String = "127.0.0.1"
        private var availablePorts: PortRange = PortRange(25565, 25570)
        private var minimumServiceCount: Int = 1
        private var environmentVariables: Map<String, String> = emptyMap()
        private var fileModifications: List<String> = emptyList()
        private var properties: Map<String, String> = emptyMap()

        fun name(name: String) = apply { this.name = name }
        fun runtime(runtime: String) = apply { this.runtime = runtime }
        fun command(command: String) = apply { this.command = command }
        fun static(static: Boolean) = apply { this.static = static }
        fun ramMB(ram: Int) = apply { this.ramMB = ram }
        fun cpu(cpu: Int) = apply { this.cpu = cpu }
        fun instanceGroups(groups: List<String>) = apply { this.instanceGroups = groups }
        fun nodes(nodes: List<String>) = apply { this.nodes = nodes }
        fun hostAddress(address: String) = apply { this.hostAddress = address }
        fun availablePorts(ports: PortRange) = apply { this.availablePorts = ports }
        fun minimumServiceCount(count: Int) = apply { this.minimumServiceCount = count }
        fun environmentVariables(env: Map<String, String>) = apply { this.environmentVariables = env }
        fun fileModifications(files: List<String>) = apply { this.fileModifications = files }
        fun properties(props: Map<String, String>) = apply { this.properties = props }

        fun build() = Configuration(
            name = name,
            runtime = runtime,
            command = command,
            static = static,
            ramMB = ramMB,
            cpu = cpu,
            instanceGroups = instanceGroups,
            nodes = nodes,
            hostAddress = hostAddress,
            availablePorts = availablePorts,
            minimumServiceCount = minimumServiceCount,
            environmentVariables = environmentVariables,
            fileModifications = fileModifications,
            properties = properties
        )
    }
}
