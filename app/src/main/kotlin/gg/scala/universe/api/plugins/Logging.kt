package gg.scala.universe.api.plugins

import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import io.ktor.server.application.Application
import io.ktor.server.application.createApplicationPlugin
import io.ktor.server.application.install
import io.ktor.server.request.httpMethod
import io.ktor.server.request.path

fun Application.configureLoggingMessages() {
    val plugin = createApplicationPlugin("LoggingMessages") {
        onCallRespond { call, _ ->
            log("${call.request.httpMethod.value} ${call.request.path()}", LogType.NETWORK)
        }
    }
    install(plugin)
}
