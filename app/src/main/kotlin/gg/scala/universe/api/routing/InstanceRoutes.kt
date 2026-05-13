package gg.scala.universe.api.routing

import com.hazelcast.core.HazelcastInstance
import com.hazelcast.cluster.Member
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
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
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import io.ktor.server.websocket.WebSocketServerSession
import io.ktor.server.websocket.webSocket
import io.ktor.websocket.CloseReason
import io.ktor.websocket.Frame
import io.ktor.websocket.close
import io.ktor.websocket.readText
import kotlinx.coroutines.delay
import java.io.RandomAccessFile
import java.nio.file.Path
import java.nio.file.Paths
import kotlin.io.path.exists

fun Application.configureInstanceRoutes(
    clusterStateService: ClusterStateService,
    hazelcastInstance: HazelcastInstance,
    taskDispatcher: TaskDispatcher,
    instanceCreationService: InstanceCreationService
) {
    routing {
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

            patch("/{id}/lifecycle") {
                val id = call.parameters["id"]
                    ?: return@patch call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing instance ID"))

                val instance = clusterStateService.getInstance(id)
                    ?: return@patch call.respond(HttpStatusCode.NotFound, mapOf("error" to "Instance not found"))

                val target = call.request.queryParameters["target"]
                    ?: return@patch call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing 'target' query parameter"))

                val member = hazelcastInstance.cluster.members.firstOrNull {
                    it.uuid.toString() == instance.wrapperNodeId
                } ?: hazelcastInstance.cluster.localMember

                when (target.lowercase()) {
                    "start" -> {
                        val config = clusterStateService.getConfiguration(instance.configurationName)
                            ?: return@patch call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Configuration not found"))
                        val newInstance = instanceCreationService.createInstance(config)
                            ?: return@patch call.respond(HttpStatusCode.ServiceUnavailable, mapOf("error" to "No node has enough resources"))
                        call.respond(HttpStatusCode.OK, mapOf("message" to "Instance started", "instance" to newInstance))
                    }
                    "stop" -> {
                        taskDispatcher.dispatchStop(id, member)
                        clusterStateService.updateInstanceState(id, InstanceState.STOPPED)
                        call.respond(HttpStatusCode.OK, mapOf("message" to "Instance $id stopped"))
                    }
                    "restart" -> {
                        taskDispatcher.dispatchStop(id, member)
                        clusterStateService.updateInstanceState(id, InstanceState.STOPPED)
                        val config = clusterStateService.getConfiguration(instance.configurationName)
                            ?: return@patch call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Configuration not found"))
                        val newInstance = instanceCreationService.createInstance(config)
                            ?: return@patch call.respond(HttpStatusCode.ServiceUnavailable, mapOf("error" to "No node has enough resources"))
                        call.respond(HttpStatusCode.OK, mapOf("message" to "Instance restarted", "instance" to newInstance))
                    }
                    else -> {
                        call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid lifecycle target. Supported: start, stop, restart"))
                    }
                }
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

            get("/{id}/logs") {
                val id = call.parameters["id"]
                    ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing instance ID"))

                val instance = clusterStateService.getInstance(id)
                    ?: return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Instance not found"))

                val lines = call.request.queryParameters["lines"]?.toIntOrNull() ?: 100
                val logFile = resolveLogFile(instance, clusterStateService)

                if (logFile == null || !logFile.exists()) {
                    return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "No logs available for this instance"))
                }

                val allLines = logFile.toFile().readLines()
                val tail = allLines.takeLast(lines.coerceAtLeast(1))

                call.respond(HttpStatusCode.OK, mapOf(
                    "instanceId" to id,
                    "lines" to tail,
                    "totalLines" to allLines.size,
                    "requestedLines" to lines
                ))
            }

            webSocket("/{id}/live-log") {
                val id = call.parameters["id"]
                if (id == null) {
                    close(CloseReason(CloseReason.Codes.CANNOT_ACCEPT, "Missing instance ID"))
                    return@webSocket
                }

                val instance = clusterStateService.getInstance(id)
                if (instance == null) {
                    close(CloseReason(CloseReason.Codes.CANNOT_ACCEPT, "Instance not found"))
                    return@webSocket
                }

                val logFile = resolveLogFile(instance, clusterStateService)
                if (logFile == null || !logFile.exists()) {
                    outgoing.send(Frame.Text("No logs available for this instance"))
                    close(CloseReason(CloseReason.Codes.CANNOT_ACCEPT, "No logs available"))
                    return@webSocket
                }

                val tailer = LogTailer(logFile.toFile())
                try {
                    while (true) {
                        val newLines = tailer.poll()
                        newLines.forEach { line ->
                            outgoing.send(Frame.Text(line))
                        }
                        delay(500)
                    }
                } catch (_: Exception) {
                    // Client disconnected
                } finally {
                    tailer.close()
                }
            }
        }
    }
}

data class CreateInstanceRequest(val configurationName: String)
data class UpdateStateRequest(val state: String, val lastHeartbeat: Long? = null)
data class ExecuteOnInstanceRequest(val command: String)

private fun resolveLogFile(instance: gg.scala.universe.schema.InstanceInfo, clusterStateService: ClusterStateService): Path? {
    val config = clusterStateService.getConfiguration(instance.configurationName)
    val workingDir = if (config?.static == true) {
        Paths.get("./static/${instance.configurationName}")
    } else {
        Paths.get("./running/${instance.id}")
    }
    val stdout = workingDir.resolve("stdout.log")
    val stderr = workingDir.resolve("stderr.log")
    return when {
        stdout.exists() -> stdout
        stderr.exists() -> stderr
        else -> null
    }
}

private class LogTailer(private val file: java.io.File) {
    private val raf = RandomAccessFile(file, "r")
    private var lastPosition = file.length()
    init { raf.seek(lastPosition) }

    fun poll(): List<String> {
        val newLines = mutableListOf<String>()
        val currentLength = file.length()
        if (currentLength < lastPosition) {
            // File was truncated, reset to beginning
            raf.seek(0)
            lastPosition = 0
        }
        if (currentLength > lastPosition) {
            val bytes = ByteArray((currentLength - lastPosition).toInt())
            raf.readFully(bytes)
            val text = String(bytes, Charsets.UTF_8)
            text.lines().filter { it.isNotEmpty() }.forEach { newLines.add(it) }
            lastPosition = currentLength
        }
        return newLines
    }

    fun close() {
        try { raf.close() } catch (_: Exception) {}
    }
}
