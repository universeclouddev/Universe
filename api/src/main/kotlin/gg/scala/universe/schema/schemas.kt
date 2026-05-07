package gg.scala.universe.schema

data class PortRange(val min: Int, val max: Int)

data class Template(
    val name: String,
    val group: String,
    val storage: String,
    val priority: String,
)

data class Configuration(
    val name: String,
    val runtime: String,
    val command: String,
    val static: Boolean,
    val instanceGroups: List<String>,
    val nodes: List<String>,
    val hostAddress: String,
    val availablePorts: PortRange,
    val minimumServiceCount: Int,
    val environmentVariables: Map<String, String>,
    val templateInstallationConfig: TemplateInstallationConfig,
)

data class TemplateInstallationConfig(
    val allOf: List<Template>,
    val allInGroups: List<String>,
    val oneOf: List<Template>,
    val oneInGroups: List<String>,
    val onTemplatePasteOverridePresentFiles: Boolean,
)