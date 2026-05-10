package gg.scala.universe.api.plugins

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.response.respond

fun Application.configureExceptionCatcher() {
    install(StatusPages) {
        exception<Throwable> { call, cause ->
            val errorMessage = cause.message ?: "An unknown internal error occurred"
            call.respond(HttpStatusCode.InternalServerError, mapOf("error" to errorMessage))
        }
    }
}
