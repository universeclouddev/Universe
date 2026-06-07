package gg.scala.universe.api.routing

import com.hazelcast.core.HazelcastInstance
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.command.CommandProvider
import gg.scala.universe.command.CommandSource
import gg.scala.universe.command.exception.CommandExceptionHandler
import gg.scala.universe.config.UniverseMainConfiguration
import gg.scala.universe.api.plugins.ApiKeyCache
import gg.scala.universe.api.plugins.authenticateApiKey
import gg.scala.universe.api.plugins.closeUnauthorized
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.auth.authenticate
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
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch

fun Application.configureNodeRoutes(
    config: UniverseMainConfiguration,
    hazelcastInstance: HazelcastInstance,
    commandProvider: CommandProvider,
    apiKeyCache: ApiKeyCache,
    commandExceptionHandler: CommandExceptionHandler,
) {
    routing {
        route("/api") {
            // Public health check — no auth required
            get("/ping") {
                call.respond(HttpStatusCode.OK, mapOf(
                    "status" to "ok",
                    "nodeId" to config.nodeId,
                    "clusterName" to config.clusterName,
                    "master" to config.isMasterNode
                ))
            }

            authenticate("protected") {
                get("/node") {
                    val runtime = Runtime.getRuntime()
                    val osBean = ManagementFactory.getOperatingSystemMXBean()
                    val uptime = ManagementFactory.getRuntimeMXBean().uptime

                    val loadAverage = osBean.systemLoadAverage
                    val systemInfo = buildMap<String, Any> {
                        put("availableProcessors", osBean.availableProcessors)
                        if (loadAverage >= 0) {
                            put("systemLoadAverage", loadAverage)
                        }
                        put("freeMemory", runtime.freeMemory())
                        put("totalMemory", runtime.totalMemory())
                        put("maxMemory", runtime.maxMemory())
                    }

                    call.respond(HttpStatusCode.OK, mapOf(
                        "id" to config.nodeId,
                        "clusterName" to config.clusterName,
                        "version" to "0.0.1",
                        "master" to config.isMasterNode,
                        "address" to config.address,
                        "port" to config.port,
                        "apiPort" to config.apiPort,
                        "uptimeMs" to uptime,
                        "system" to systemInfo
                    ))
                }

                get("/node/config") {
                    call.respond(HttpStatusCode.OK, config)
                }

                post("/node/reload") {
                    // TODO: Trigger configuration reload
                    call.respond(HttpStatusCode.NotImplemented, mapOf("error" to "Configuration reload is not yet implemented"))
                }
            }

            // WebSocket auth uses ?token= query param for browser clients (no custom headers on WS handshake)
            webSocket("/console") {
                if (call.authenticateApiKey(apiKeyCache, requireAll = true) == null) {
                    closeUnauthorized()
                    return@webSocket
                }

                if (!config.isMasterNode) {
                    outgoing.send(Frame.Text("Console websocket is only available on the master node"))
                    close(CloseReason(CloseReason.Codes.CANNOT_ACCEPT, "Not master node"))
                    return@webSocket
                }

                val outputLines = Channel<String>(Channel.UNLIMITED)
                launch {
                    for (line in outputLines) {
                        try {
                            outgoing.send(Frame.Text(line))
                        } catch (_: Exception) {
                            break
                        }
                    }
                }

                val output = WebSocketConsoleOutput(outputLines)
                try {
                    for (frame in incoming) {
                        if (frame is Frame.Text) {
                            val command = frame.readText().trim()
                            if (command.isEmpty()) continue

                            val source = WebSocketCommandSource(output)
                            try {
                                commandProvider.execute(source, command)
                                    .exceptionally { throwable ->
                                        commandExceptionHandler.handle(source, throwable)
                                        null
                                    }
                                    .join()
                            } catch (e: Exception) {
                                commandExceptionHandler.handle(source, e)
                            }
                        }
                    }
                } catch (_: Exception) {
                    // Client disconnected
                } finally {
                    outputLines.close()
                }
            }
        }
    }
}

private class WebSocketConsoleOutput(
    private val lines: Channel<String>,
) {
    fun send(line: String) {
        lines.trySend(line)
    }
}

private class WebSocketCommandSource(private val output: WebSocketConsoleOutput) : CommandSource {
    override fun sendMessage(message: String) {
        output.send(message)
    }

    override fun sendMessage(vararg messages: String) {
        messages.forEach { output.send(it) }
    }

    override fun sendMessage(messages: MutableCollection<String>) {
        messages.forEach { output.send(it) }
    }

    override fun checkPermission(permission: String): Boolean = true
}
