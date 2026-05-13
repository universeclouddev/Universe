package gg.scala.universe.api.routing

import com.hazelcast.core.HazelcastInstance
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import gg.scala.universe.command.CommandProvider
import gg.scala.universe.command.CommandSource
import gg.scala.universe.config.UniverseMainConfiguration
import gg.scala.universe.hz.nodeName
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import io.ktor.server.websocket.webSocket
import io.ktor.websocket.CloseReason
import io.ktor.websocket.Frame
import io.ktor.websocket.close
import io.ktor.websocket.readText
import java.lang.management.ManagementFactory
import java.util.concurrent.TimeUnit

fun Application.configureNodeRoutes(
    config: UniverseMainConfiguration,
    hazelcastInstance: HazelcastInstance,
    commandProvider: CommandProvider
) {
    routing {
        route("/api") {
            get("/ping") {
                call.respond(HttpStatusCode.OK, mapOf(
                    "status" to "ok",
                    "nodeId" to config.nodeId,
                    "clusterName" to config.clusterName,
                    "master" to config.isMasterNode
                ))
            }

            get("/node") {
                val runtime = Runtime.getRuntime()
                val osBean = ManagementFactory.getOperatingSystemMXBean()
                val uptime = ManagementFactory.getRuntimeMXBean().uptime

                call.respond(HttpStatusCode.OK, mapOf(
                    "id" to config.nodeId,
                    "clusterName" to config.clusterName,
                    "version" to "0.0.1",
                    "master" to config.isMasterNode,
                    "address" to config.address,
                    "port" to config.port,
                    "apiPort" to config.apiPort,
                    "uptimeMs" to uptime,
                    "system" to mapOf(
                        "availableProcessors" to osBean.availableProcessors,
                        "systemLoadAverage" to osBean.systemLoadAverage,
                        "freeMemory" to runtime.freeMemory(),
                        "totalMemory" to runtime.totalMemory(),
                        "maxMemory" to runtime.maxMemory()
                    )
                ))
            }

            get("/node/config") {
                call.respond(HttpStatusCode.OK, config)
            }

            post("/node/reload") {
                // TODO: Trigger configuration reload
                call.respond(HttpStatusCode.NotImplemented, mapOf("error" to "Configuration reload is not yet implemented"))
            }

            webSocket("/console") {
                if (!config.isMasterNode) {
                    outgoing.send(Frame.Text("Console websocket is only available on the master node"))
                    close(CloseReason(CloseReason.Codes.CANNOT_ACCEPT, "Not master node"))
                    return@webSocket
                }

                val output = WebSocketConsoleOutput(outgoing)
                try {
                    for (frame in incoming) {
                        if (frame is Frame.Text) {
                            val command = frame.readText()
                            val source = WebSocketCommandSource(output)
                            commandProvider.execute(source, command)
                        }
                    }
                } catch (_: Exception) {
                    // Client disconnected
                }
            }
        }
    }
}

private class WebSocketConsoleOutput(private val outgoing: kotlinx.coroutines.channels.SendChannel<io.ktor.websocket.Frame>) {
    suspend fun send(line: String) {
        try {
            outgoing.send(Frame.Text(line))
        } catch (_: Exception) {
            // Ignore send failures on closed socket
        }
    }
}

private class WebSocketCommandSource(private val output: WebSocketConsoleOutput) : CommandSource {
    override fun sendMessage(message: String) {
        kotlinx.coroutines.runBlocking {
            output.send(message)
        }
    }

    override fun sendMessage(vararg messages: String) {
        kotlinx.coroutines.runBlocking {
            messages.forEach { output.send(it) }
        }
    }

    override fun sendMessage(messages: MutableCollection<String>) {
        kotlinx.coroutines.runBlocking {
            messages.forEach { output.send(it) }
        }
    }

    override fun checkPermission(permission: String): Boolean = true
}
