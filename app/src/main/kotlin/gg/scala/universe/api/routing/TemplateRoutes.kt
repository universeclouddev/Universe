package gg.scala.universe.api.routing

import gg.scala.universe.hz.ClusterStateService
import gg.scala.universe.template.TemplateManager
import gg.scala.universe.template.TemplateSyncService
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.auth.authenticate
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import kotlin.io.path.exists

fun Application.configureTemplateRoutes(
    clusterStateService: ClusterStateService,
    templateManager: TemplateManager,
    templateSyncService: TemplateSyncService
) {
    routing {
        authenticate("protected") {
            route("/api/templates") {
                get {
                    val templates = templateManager.listAllTemplates()
                    call.respond(HttpStatusCode.OK, templates.map { template ->
                        mapOf(
                            "group" to template.group,
                            "name" to template.name,
                            "path" to templateManager.getTemplatePath(template.group, template.name).toString()
                        )
                    })
                }

                get("/{group}/{name}") {
                    val group = call.parameters["group"]
                        ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing group"))
                    val name = call.parameters["name"]
                        ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing name"))

                    val path = templateManager.getTemplatePath(group, name)
                    if (!path.exists()) {
                        return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Template not found"))
                    }

                    call.respond(HttpStatusCode.OK, mapOf(
                        "group" to group,
                        "name" to name,
                        "path" to path.toString()
                    ))
                }

                post("/sync") {
                    val request = call.receive<TemplateSyncRequest>()
                    templateSyncService.syncTemplates(request.pattern)
                    call.respond(HttpStatusCode.OK, mapOf("message" to "Sync triggered for pattern: ${request.pattern}"))
                }
            }
        }
    }
}

data class TemplateSyncRequest(val pattern: String)
