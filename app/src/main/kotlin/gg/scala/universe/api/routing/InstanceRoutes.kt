package gg.scala.universe.api.routing

import com.hazelcast.core.HazelcastInstance
import gg.scala.universe.hz.ClusterStateService
import gg.scala.universe.hz.task.TaskDispatcher
import gg.scala.universe.schema.InstanceState
import gg.scala.universe.service.InstanceCreationService
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.response.respond
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
                val instances = clusterStateService.getAllInstances()
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
    }
}

data class CreateInstanceRequest(val configurationName: String)
data class UpdateStateRequest(val state: String, val lastHeartbeat: Long? = null)
data class ExecuteCommandRequest(val command: String)

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
