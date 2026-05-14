package gg.scala.universe.api.routing

import gg.scala.universe.metrics.MetricsRegistry
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.call
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import io.ktor.server.routing.routing

fun Application.configureMetricsRoutes(metricsRegistry: MetricsRegistry) {
    routing {
        route("/api/metrics") {
            get {
                val providers = metricsRegistry.getAll()
                if (providers.isEmpty()) {
                    call.respondText(
                        "# No metrics providers registered",
                        ContentType.Text.Plain,
                        HttpStatusCode.ServiceUnavailable
                    )
                    return@get
                }

                // Use the first registered provider for scraping
                val provider = providers.values.first()
                val scrape = provider.scrape()
                call.respondText(scrape, ContentType.Text.Plain, HttpStatusCode.OK)
            }
        }
    }
}
