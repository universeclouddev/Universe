package gg.scala.universe.api.routing

import gg.scala.universe.config.UniverseMainConfiguration
import gg.scala.universe.service.PanelBootstrapService
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import io.ktor.server.routing.routing

fun Application.configurePanelBootstrapRoutes(
    configuration: UniverseMainConfiguration,
    panelBootstrap: PanelBootstrapService,
) {
    routing {
        route("/api/panel") {
            get("/bootstrap") {
                if (!panelBootstrap.bootstrapAllowed()) {
                    call.respond(HttpStatusCode.Forbidden, mapOf("error" to "Panel bootstrap is disabled"))
                    return@get
                }

                val key = panelBootstrap.ensurePanelKey()
                call.respond(
                    HttpStatusCode.OK,
                    mapOf(
                        "token" to key.token,
                        "apiUrl" to panelBootstrap.publicApiUrl(),
                        "clusterName" to configuration.clusterName,
                    ),
                )
            }
        }
    }
}
