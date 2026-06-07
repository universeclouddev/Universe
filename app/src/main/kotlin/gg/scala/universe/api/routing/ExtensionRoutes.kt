package gg.scala.universe.api.routing

import gg.scala.universe.config.UniverseMainConfiguration
import gg.scala.universe.extension.ExtensionService
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.call
import io.ktor.server.auth.authenticate
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import io.ktor.server.routing.routing

fun Application.configureExtensionRoutes(
    configuration: UniverseMainConfiguration,
    extensionService: ExtensionService,
) {
    routing {
        authenticate("protected") {
            route("/api/extensions") {
                get {
                    val installed = extensionService.getInstalledExtensions()
                    val loaded = extensionService.getLoadedExtensions()

                    val extensions = installed.map { (id, extension) ->
                        val status = when {
                            extension.masterOnly() && !configuration.isMasterNode -> "SKIPPED"
                            loaded.containsKey(id) -> "LOADED"
                            else -> "INSTALLED"
                        }
                        mapOf(
                            "id" to id,
                            "version" to extension.version(),
                            "status" to status,
                            "masterOnly" to extension.masterOnly(),
                            "reloadable" to extension.reloadable(),
                        )
                    }.sortedBy { it["id"] as String }

                    call.respond(HttpStatusCode.OK, extensions)
                }
            }
        }
    }
}
