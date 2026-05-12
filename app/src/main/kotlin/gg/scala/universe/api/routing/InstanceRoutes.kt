package gg.scala.universe.api.routing

import com.hazelcast.core.HazelcastInstance
import gg.scala.universe.hz.ClusterStateService
import gg.scala.universe.hz.nodeName
import gg.scala.universe.hz.task.TaskDispatcher
import gg.scala.universe.schema.InstanceState
import gg.scala.universe.service.InstanceCreationService
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import gg.scala.universe.command.CommandProvider
import gg.scala.universe.command.CommandSource

fun Application.configureInstanceRoutes(
    clusterStateService: ClusterStateService,
    hazelcastInstance: HazelcastInstance,
    taskDispatcher: TaskDispatcher,
    commandProvider: CommandProvider,
    commandSource: CommandSource,
    instanceCreationService: InstanceCreationService
) {
    routing {
        route("/api/commands/execute") {
            post {
                val request = call.receive<ExecuteCommandRequest>()
                val command = request.command
                
                val output = mutableListOf<String>()
                val capturingSource = CapturingCommandSource(output)
                
                commandProvider.execute(capturingSource, command)
                
                call.respond(HttpStatusCode.OK, mapOf(
                    "command" to command,
                    "output" to output
                ))
            }
        }

        route("/api/instances") {
            get {
                val instances = clusterStateService.getActiveInstances()
                call.respond(HttpStatusCode.OK, instances)
            }

            post {
                val request = call.receive<CreateInstanceRequest>()
                val configuration = clusterStateService.getConfiguration(request.configurationName)
                    ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Configuration not found"))

                val instanceInfo = instanceCreationService.createInstance(configuration)
                    ?: return@post call.respond(
                        HttpStatusCode.ServiceUnavailable,
                        mapOf("error" to "No node has enough resources for this configuration")
                    )

                call.respond(HttpStatusCode.Created, instanceInfo)
            }

            get("/{id}") {
                val id = call.parameters["id"]
                    ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing instance ID"))

                val instance = clusterStateService.getInstance(id)
                    ?: return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Instance not found"))

                call.respond(HttpStatusCode.OK, instance)
            }

            delete("/{id}") {
                val id = call.parameters["id"]
                    ?: return@delete call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing instance ID"))

                val instance = clusterStateService.getInstance(id)
                    ?: return@delete call.respond(HttpStatusCode.NotFound, mapOf("error" to "Instance not found"))

                val member = hazelcastInstance.cluster.members.firstOrNull {
                    it.uuid.toString() == instance.wrapperNodeId
                } ?: hazelcastInstance.cluster.localMember

                taskDispatcher.dispatchStop(id, member)
                clusterStateService.updateInstanceState(id, InstanceState.STOPPED)

                call.respond(HttpStatusCode.OK, mapOf("message" to "Instance $id stopped"))
            }

            post("/{id}/execute") {
                val id = call.parameters["id"]
                    ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing instance ID"))

                val instance = clusterStateService.getInstance(id)
                    ?: return@post call.respond(HttpStatusCode.NotFound, mapOf("error" to "Instance not found"))

                val request = call.receive<ExecuteOnInstanceRequest>()
                val member = hazelcastInstance.cluster.members.firstOrNull {
                    it.uuid.toString() == instance.wrapperNodeId
                } ?: hazelcastInstance.cluster.localMember

                taskDispatcher.dispatchExecute(id, request.command, member)
                call.respond(HttpStatusCode.OK, mapOf("message" to "Command sent to $id"))
            }

            put("/{id}/state") {
                val id = call.parameters["id"]
                    ?: return@put call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing instance ID"))

                val request = call.receive<UpdateStateRequest>()
                val instance = clusterStateService.getInstance(id)
                    ?: return@put call.respond(HttpStatusCode.NotFound, mapOf("error" to "Instance not found"))

                val newState = try {
                    InstanceState.valueOf(request.state)
                } catch (e: IllegalArgumentException) {
                    return@put call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid state"))
                }

                val updated = instance.copy(
                    state = newState,
                    lastHeartbeat = request.lastHeartbeat ?: System.currentTimeMillis()
                )
                clusterStateService.putInstance(updated)

                call.respond(HttpStatusCode.OK, updated)
            }
        }

        route("/api/configurations") {
            get {
                val configs = clusterStateService.configurations.values
                call.respond(HttpStatusCode.OK, configs)
            }

            get("/{name}") {
                val name = call.parameters["name"]
                    ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing configuration name"))

                val config = clusterStateService.getConfiguration(name)
                    ?: return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Configuration not found"))

                call.respond(HttpStatusCode.OK, config)
            }
        }

        route("/api/nodes") {
            get {
                val members = hazelcastInstance.cluster.members.map { member ->
                    val nodeId = member.nodeName()
                    val resources = clusterStateService.getNodeResources(nodeId)
                    val maxRam = member.getAttribute("maxRamMB")?.toIntOrNull() ?: 0
                    val maxCpu = member.getAttribute("maxCpu")?.toIntOrNull() ?: 0
                    mapOf(
                        "id" to nodeId,
                        "uuid" to member.uuid.toString(),
                        "local" to member.localMember(),
                        "usedRamMB" to resources.usedRamMB,
                        "maxRamMB" to maxRam,
                        "usedCpu" to resources.usedCpu,
                        "maxCpu" to maxCpu
                    )
                }
                call.respond(HttpStatusCode.OK, members)
            }
        }
    }
}

data class CreateInstanceRequest(val configurationName: String)
data class UpdateStateRequest(val state: String, val lastHeartbeat: Long? = null)
data class ExecuteCommandRequest(val command: String)
data class ExecuteOnInstanceRequest(val command: String)

private class CapturingCommandSource(private val output: MutableList<String>) : CommandSource {
    override fun sendMessage(message: String) {
        output.add(message)
    }

    override fun sendMessage(vararg messages: String) {
        messages.forEach { output.add(it) }
    }

    override fun sendMessage(messages: MutableCollection<String>) {
        output.addAll(messages)
    }

    override fun checkPermission(permission: String): Boolean = true
}
