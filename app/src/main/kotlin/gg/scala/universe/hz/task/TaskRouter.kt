package gg.scala.universe.hz.task

import com.google.inject.Inject
import com.google.inject.Singleton
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import gg.scala.universe.hz.ClusterStateService
import gg.scala.universe.runtime.PortAllocator
import gg.scala.universe.runtime.RuntimeRegistry
import gg.scala.universe.schema.InstanceState
import gg.scala.universe.task.DeployInstanceTask
import gg.scala.universe.task.ExecuteCommandTask
import gg.scala.universe.task.StopInstanceTask
import gg.scala.universe.task.UniverseTask
import gg.scala.universe.template.TemplateManager
import java.nio.file.Files
import java.nio.file.Paths
import java.util.Comparator

@Singleton
class TaskRouter @Inject constructor(
    private val runtimeRegistry: RuntimeRegistry,
    private val clusterStateService: ClusterStateService,
    private val portAllocator: PortAllocator,
    private val templateManager: TemplateManager
) {
    fun route(task: UniverseTask) {
        when (task) {
            is DeployInstanceTask -> handleDeploy(task)
            is StopInstanceTask -> handleStop(task)
            is ExecuteCommandTask -> handleExecute(task)
        }
    }

    private fun handleDeploy(task: DeployInstanceTask) {
        log("Routing deploy task for instance ${task.instanceId}", LogType.INFORMATION)

        val configuration = clusterStateService.getConfiguration(task.configurationName)
            ?: return log("Configuration ${task.configurationName} not found for instance ${task.instanceId}", LogType.ERROR)

        val runtimeProvider = runtimeRegistry.get(configuration.runtime)
            ?: return log("Runtime '${configuration.runtime}' not registered for instance ${task.instanceId}", LogType.ERROR)

        val allocatedPort = portAllocator.allocate(configuration.availablePorts)
            ?: return log("No available ports for instance ${task.instanceId} in range ${configuration.availablePorts.min}-${configuration.availablePorts.max}", LogType.ERROR)

        val workingDir = if (configuration.static) {
            Paths.get("./static/${configuration.name}").toAbsolutePath().normalize()
        } else {
            Paths.get("./running/${task.instanceId}").toAbsolutePath().normalize()
        }
        workingDir.toFile().mkdirs()

        if (!configuration.static) {
            templateManager.installTemplates(
                configuration = configuration,
                instanceId = task.instanceId,
                allocatedPort = allocatedPort,
                targetDir = workingDir
            )
        }

        val processHandle = try {
            runtimeProvider.start(
                instanceId = task.instanceId,
                workingDir = workingDir,
                port = allocatedPort,
                command = configuration.command,
                ramMB = configuration.ramMB,
                cpu = configuration.cpu
            )
        } catch (e: Exception) {
            val cause = e.cause ?: e
            val reason = "${cause.javaClass.simpleName}: ${cause.message ?: "no details"}"
            log("Failed to start instance ${task.instanceId}: $reason", LogType.ERROR)

            // Clean up: remove instance record
            clusterStateService.removeInstance(task.instanceId)

            // Clean up working directory (skip for static instances)
            if (!configuration.static) {
                try {
                    if (Files.exists(workingDir)) {
                        Files.walk(workingDir)
                            .sorted(Comparator.reverseOrder())
                            .forEach { Files.deleteIfExists(it) }
                        log("Cleaned up working directory for instance ${task.instanceId}", LogType.INFORMATION)
                    }
                } catch (cleanupEx: Exception) {
                    log("Failed to clean up working directory for instance ${task.instanceId}: ${cleanupEx.message}", LogType.WARNING)
                }
            }

            portAllocator.release(allocatedPort)
            return
        }

        // Update instance info in Hazelcast
        val existing = clusterStateService.getInstance(task.instanceId)
        if (existing != null) {
            clusterStateService.putInstance(
                existing.copy(
                    state = InstanceState.ONLINE,
                    allocatedPort = allocatedPort,
                    processPid = processHandle.pid()
                )
            )
        }

        // Track node resources
        val nodeId = existing?.wrapperNodeId ?: task.instanceId
        clusterStateService.addNodeResources(nodeId, configuration.ramMB, configuration.cpu)

        log("Instance ${task.instanceId} deployed with PID ${processHandle.pid()}", LogType.SUCCESS)
    }

    private fun handleStop(task: StopInstanceTask) {
        log("Routing stop task for instance ${task.instanceId}", LogType.INFORMATION)

        val instance = clusterStateService.getInstance(task.instanceId)
            ?: return log("Instance ${task.instanceId} not found", LogType.WARNING)

        val configuration = clusterStateService.getConfiguration(instance.configurationName)
        val runtimeKey = configuration?.runtime ?: instance.configurationName

        val runtimeProvider = runtimeRegistry.get(runtimeKey)
            ?: runtimeRegistry.getAll().values.firstOrNull()
            ?: return log("No runtime provider available to stop instance ${task.instanceId}", LogType.ERROR)

        runtimeProvider.stop(task.instanceId)
        portAllocator.release(instance.allocatedPort)

        // Clean up working directory (skip for static instances)
        if (configuration?.static != true) {
            val workingDir = Paths.get("./running/${task.instanceId}").toAbsolutePath().normalize()
            try {
                if (Files.exists(workingDir)) {
                    Files.walk(workingDir)
                        .sorted(Comparator.reverseOrder())
                        .forEach { Files.deleteIfExists(it) }
                    log("Cleaned up working directory for instance ${task.instanceId}", LogType.INFORMATION)
                }
            } catch (cleanupEx: Exception) {
                log("Failed to clean up working directory for instance ${task.instanceId}: ${cleanupEx.message}", LogType.WARNING)
            }
        }

        // Release node resources
        clusterStateService.removeNodeResources(instance.wrapperNodeId, instance.allocatedRamMB, instance.allocatedCpu)

        clusterStateService.updateInstanceState(task.instanceId, InstanceState.STOPPED)
        log("Instance ${task.instanceId} stopped", LogType.INFORMATION)
    }

    private fun handleExecute(task: ExecuteCommandTask) {
        log("Routing execute command for instance ${task.instanceId}: ${task.command}", LogType.INFORMATION)

        val instance = clusterStateService.getInstance(task.instanceId)
            ?: return log("Instance ${task.instanceId} not found", LogType.WARNING)

        val configuration = clusterStateService.getConfiguration(instance.configurationName)
        val runtimeKey = configuration?.runtime ?: instance.configurationName

        val runtimeProvider = runtimeRegistry.get(runtimeKey)
            ?: runtimeRegistry.getAll().values.firstOrNull()
            ?: return log("No runtime provider available to execute command on instance ${task.instanceId}", LogType.ERROR)

        runtimeProvider.executeCommand(task.instanceId, task.command)
    }
}
