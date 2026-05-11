package gg.scala.universe.schema

data class PortRange(val min: Int, val max: Int)

enum class InstanceState {
    CREATING,
    ONLINE,
    OFFLINE,
    STOPPED
}

data class InstanceInfo(
    val id: String,
    val configurationName: String,
    val wrapperNodeId: String,
    val hostAddress: String,
    val allocatedPort: Int,
    val state: InstanceState,
    val lastHeartbeat: Long,
    val processPid: Long?,
    val allocatedRamMB: Int = 0,
    val allocatedCpu: Int = 0
)

data class Template(
    val name: String,
    val group: String,
    val storage: String,
    val priority: Int,
)

data class Configuration(
    val name: String = "default",
    val runtime: String = "screen",
    val command: String = "",
    val static: Boolean = false,
    val ramMB: Int = 512,
    val cpu: Int = 100,
    val instanceGroups: List<String> = emptyList(),
    val nodes: List<String> = listOf("node-1"),
    val hostAddress: String = "127.0.0.1",
    val availablePorts: PortRange = PortRange(25565, 25570),
    val minimumServiceCount: Int = 1,
    val environmentVariables: Map<String, String> = emptyMap(),
    val templateInstallationConfig: TemplateInstallationConfig = TemplateInstallationConfig(),
    val fileModifications: List<String> = emptyList(),
    val properties: Map<String, String> = emptyMap(),
)

data class NodeResources(
    val usedRamMB: Int = 0,
    val usedCpu: Int = 0
)

data class TemplateInstallationConfig(
    val allOf: List<Template> = emptyList(),
    val allInGroups: List<String> = emptyList(),
    val oneOf: List<Template> = emptyList(),
    val oneInGroups: List<String> = emptyList(),
    val onTemplatePasteOverridePresentFiles: Boolean = false,
)