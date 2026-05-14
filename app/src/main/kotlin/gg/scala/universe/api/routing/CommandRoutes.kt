package gg.scala.universe.api.routing

import gg.scala.universe.command.CommandProvider
import gg.scala.universe.command.CommandSource
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.auth.authenticate
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.routing.routing

fun Application.configureCommandRoutes(commandProvider: CommandProvider) {
    routing {
        authenticate("protected") {
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
        }
    }
}

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
