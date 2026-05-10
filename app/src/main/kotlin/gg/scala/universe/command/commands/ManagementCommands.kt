package gg.scala.universe.command.commands

import com.google.inject.Inject
import com.google.inject.Singleton
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import gg.scala.universe.command.CommandSource
import gg.scala.universe.config.ConfigurationLoader
import gg.scala.universe.extension.ExtensionService
import gg.scala.universe.hz.ClusterStateService
import gg.scala.universe.hz.task.TaskDispatcher
import gg.scala.universe.schema.InstanceInfo
import gg.scala.universe.schema.InstanceState
import gg.scala.universe.template.TemplateManager
import io.ktor.server.application.Application
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import io.ktor.http.HttpStatusCode
import org.incendo.cloud.annotations.Argument
import org.incendo.cloud.annotations.Command
import com.hazelcast.core.HazelcastInstance
import java.nio.file.Path
import java.nio.file.Files
import kotlin.io.path.exists
import kotlin.io.path.isDirectory
import kotlin.io.path.name

/**
 * Management commands for the Universe orchestrator.
 *
 * Provides cluster, instance, configuration, template, and extension management
 * via the console command system.
 */
@Singleton
class ManagementCommands @Inject constructor(
    private val clusterStateService: ClusterStateService,
    private val hazelcastInstance: HazelcastInstance,
    private val taskDispatcher: TaskDispatcher,
    private val extensionService: ExtensionService,
    private val templateManager: TemplateManager
) {

    // ─── Cluster Commands ───

    @Command("cluster status")
    fun clusterStatus(source: CommandSource) {
        val localMember = hazelcastInstance.cluster.localMember
        val members = hazelcastInstance.cluster.members

        source.sendMessage("=== Cluster Status ===")
        source.sendMessage("Cluster name: ${hazelcastInstance.config.clusterName}")
        source.sendMessage("Local node: ${localMember.uuid} (master=${localMember.localMember()})")
        source.sendMessage("Members: ${members.size}")
        members.forEach { member ->
            val isLocal = if (member.localMember()) " [LOCAL]" else ""
            source.sendMessage("  - ${member.uuid}$isLocal")
        }
    }

    @Command("cluster nodes")
    fun clusterNodes(source: CommandSource) {
        val members = hazelcastInstance.cluster.members
        source.sendMessage("=== Cluster Nodes ===")
        members.forEach { member ->
            val nodeId = member.getAttribute("nodeId") ?: "unknown"
            val isLocal = if (member.localMember()) " (local)" else ""
            source.sendMessage("  $nodeId - ${member.uuid}$isLocal")
        }
    }

    // ─── Instance Commands ───

    @Command("instance list")
    fun instanceList(source: CommandSource) {
        val instances = clusterStateService.getAllInstances()
        if (instances.isEmpty()) {
            source.sendMessage("No instances found.")
            return
        }

        source.sendMessage("=== Instances (${instances.size}) ===")
        source.sendMessage(String.format("%-8s %-12s %-15s %-8s %-10s", "ID", "Config", "Host", "Port", "State"))
        instances.forEach { instance ->
            source.sendMessage(
                String.format(
                    "%-8s %-12s %-15s %-8d %-10s",
                    instance.id,
                    instance.configurationName,
                    instance.hostAddress,
                    instance.allocatedPort,
                    instance.state
                )
            )
        }
    }

    @Command("instance create <config>")
    fun instanceCreate(
        source: CommandSource,
        @Argument("config") configName: String
    ) {
        val configuration = clusterStateService.getConfiguration(configName)
        if (configuration == null) {
            source.sendMessage("Configuration '$configName' not found.")
            return
        }

        val wrapperMember = hazelcastInstance.cluster.members.firstOrNull { !it.localMember() }
            ?: hazelcastInstance.cluster.localMember

        val instanceId = generateInstanceId()
        val instanceInfo = InstanceInfo(
            id = instanceId,
            configurationName = configuration.name,
            wrapperNodeId = wrapperMember.uuid.toString(),
            hostAddress = configuration.hostAddress,
            allocatedPort = 0,
            state = InstanceState.CREATING,
            lastHeartbeat = System.currentTimeMillis(),
            processPid = null
        )

        clusterStateService.putInstance(instanceInfo)
        taskDispatcher.dispatchDeploy(instanceInfo, wrapperMember)

        source.sendMessage("Created instance $instanceId from configuration '$configName' on ${wrapperMember.uuid}")
    }

    @Command("instance stop <id>")
    fun instanceStop(
        source: CommandSource,
        @Argument("id") instanceId: String
    ) {
        val instance = clusterStateService.getInstance(instanceId)
        if (instance == null) {
            source.sendMessage("Instance '$instanceId' not found.")
            return
        }

        val member = hazelcastInstance.cluster.members.firstOrNull {
            it.uuid.toString() == instance.wrapperNodeId
        } ?: hazelcastInstance.cluster.localMember

        taskDispatcher.dispatchStop(instanceId, member)
        source.sendMessage("Stopping instance $instanceId...")
    }

    @Command("instance info <id>")
    fun instanceInfo(
        source: CommandSource,
        @Argument("id") instanceId: String
    ) {
        val instance = clusterStateService.getInstance(instanceId)
        if (instance == null) {
            source.sendMessage("Instance '$instanceId' not found.")
            return
        }

        source.sendMessage("=== Instance $instanceId ===")
        source.sendMessage("  Configuration: ${instance.configurationName}")
        source.sendMessage("  State: ${instance.state}")
        source.sendMessage("  Host: ${instance.hostAddress}:${instance.allocatedPort}")
        source.sendMessage("  Wrapper: ${instance.wrapperNodeId}")
        source.sendMessage("  PID: ${instance.processPid ?: "N/A"}")
        source.sendMessage("  Last heartbeat: ${instance.lastHeartbeat}")
    }

    @Command("instance execute <id> <command>")
    fun instanceExecute(
        source: CommandSource,
        @Argument("id") instanceId: String,
        @Argument("command") command: String
    ) {
        val instance = clusterStateService.getInstance(instanceId)
        if (instance == null) {
            source.sendMessage("Instance '$instanceId' not found.")
            return
        }

        val member = hazelcastInstance.cluster.members.firstOrNull {
            it.uuid.toString() == instance.wrapperNodeId
        } ?: hazelcastInstance.cluster.localMember

        taskDispatcher.dispatchExecute(instanceId, command, member)
        source.sendMessage("Executed command on instance $instanceId: $command")
    }

    // ─── Configuration Commands ───

    @Command("config list")
    fun configList(source: CommandSource) {
        val configs = clusterStateService.configurations.values
        if (configs.isEmpty()) {
            source.sendMessage("No configurations found.")
            return
        }

        source.sendMessage("=== Configurations (${configs.size}) ===")
        configs.forEach { config ->
            source.sendMessage("  ${config.name} (runtime=${config.runtime}, ports=${config.availablePorts.min}-${config.availablePorts.max})")
        }
    }

    @Command("config reload")
    fun configReload(source: CommandSource) {
        ConfigurationLoader.load(clusterStateService)
        source.sendMessage("Configurations reloaded from disk.")
    }

    // ─── Template Commands ───

    @Command("template list")
    fun templateList(source: CommandSource) {
        val templatesDir = Path.of("./templates")
        if (!templatesDir.exists() || !templatesDir.isDirectory()) {
            source.sendMessage("No templates directory found.")
            return
        }

        source.sendMessage("=== Templates ===")
        Files.list(templatesDir).use { groupStream ->
            groupStream.filter { it.isDirectory() }.forEach { groupDir ->
                val groupName = groupDir.fileName.toString()
                Files.list(groupDir).use { templateStream ->
                    templateStream.filter { it.isDirectory() }.forEach { templateDir ->
                        source.sendMessage("  $groupName/${templateDir.fileName}")
                    }
                }
            }
        }
    }

    // ─── Extension Commands ───

    @Command("extension list")
    fun extensionList(source: CommandSource) {
        val installed = extensionService.getInstalledExtensions()
        val loaded = extensionService.getLoadedExtensions()

        source.sendMessage("=== Extensions (${installed.size} installed, ${loaded.size} loaded) ===")
        installed.forEach { (id, ext) ->
            val status = if (loaded.containsKey(id)) "[LOADED]" else "[INSTALLED]"
            source.sendMessage("  $status $id v${ext.version()}")
        }
    }

    @Command("extension reload")
    fun extensionReload(source: CommandSource) {
        extensionService.reloadExtensions()
        source.sendMessage("Extensions reloaded.")
    }

    // ─── System Commands ───

    @Command("stop")
    fun stop(source: CommandSource) {
        source.sendMessage("Shutting down Universe...")
        Runtime.getRuntime().exit(0)
    }

    @Command("help")
    fun help(source: CommandSource) {
        source.sendMessage("=== Universe Commands ===")
        source.sendMessage("")
        source.sendMessage("Cluster:")
        source.sendMessage("  cluster status         - Show cluster status")
        source.sendMessage("  cluster nodes          - List cluster nodes")
        source.sendMessage("")
        source.sendMessage("Instances:")
        source.sendMessage("  instance list          - List all instances")
        source.sendMessage("  instance create <cfg>  - Create a new instance")
        source.sendMessage("  instance stop <id>     - Stop an instance")
        source.sendMessage("  instance info <id>     - Show instance details")
        source.sendMessage("  instance execute <id>  - Execute command on instance")
        source.sendMessage("")
        source.sendMessage("Configuration:")
        source.sendMessage("  config list            - List configurations")
        source.sendMessage("  config reload          - Reload configurations from disk")
        source.sendMessage("")
        source.sendMessage("Templates:")
        source.sendMessage("  template list          - List local templates")
        source.sendMessage("  template sync <p> <n>  - Sync template to node")
        source.sendMessage("")
        source.sendMessage("Extensions:")
        source.sendMessage("  extension list         - List extensions")
        source.sendMessage("  extension reload       - Reload extensions")
        source.sendMessage("")
        source.sendMessage("System:")
        source.sendMessage("  help                   - Show this help")
        source.sendMessage("  stop                   - Shutdown Universe")
    }

    private fun generateInstanceId(): String {
        return java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 6)
    }
}
