package gg.scala.universe.api.plugins

import gg.scala.universe.console.log
import io.ktor.server.application.Application
import io.ktor.server.html.respondHtml
import io.ktor.server.plugins.openapi.openAPI
import io.ktor.server.response.respondResource
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import kotlinx.html.body
import kotlinx.html.head
import kotlinx.html.id
import kotlinx.html.meta
import kotlinx.html.script
import kotlinx.html.style
import kotlinx.html.title
import kotlinx.html.unsafe

fun Application.configureDocumentation() {
    routing {
        // Serve Swagger UI and raw OpenAPI YAML spec
        openAPI(path = "openapi", swaggerFile = "openapi/documentation.yaml")
        get("/openapi/openapi.yaml") {
            call.respondResource("openapi/documentation.yaml")
        }

        // Scalar API Reference UI
        get("/docs") {
            call.respondHtml {
                head {
                    title { +"Universe API Reference" }
                    meta { charset = "utf-8" }
                    meta { name = "viewport"; content = "width=device-width, initial-scale=1" }
                    style {
                        unsafe {
                            raw("body { margin: 0; }")
                        }
                    }
                }
                body {
                    script {
                        id = "api-reference"
                        attributes["data-url"] = "/openapi/openapi.yaml"
                        attributes["data-theme"] = "saturn"
                    }
                    script(src = "https://cdn.jsdelivr.net/npm/@scalar/api-reference") {}
                }
            }
        }
    }
    log("Loaded API Documentation at /docs and /openapi")
}
