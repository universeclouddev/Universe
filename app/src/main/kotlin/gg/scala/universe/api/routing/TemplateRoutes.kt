package gg.scala.universe.api.routing

import gg.scala.universe.hz.ClusterStateService
import gg.scala.universe.template.TemplateManager
import gg.scala.universe.template.TemplateStorageRegistry
import gg.scala.universe.template.TemplateSyncService
import io.ktor.http.ContentDisposition
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.request.receiveText
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.response.respondBytes
import io.ktor.server.response.respondText
import io.ktor.server.auth.authenticate
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import kotlin.io.path.exists

fun Application.configureTemplateRoutes(
    clusterStateService: ClusterStateService,
    templateManager: TemplateManager,
    templateSyncService: TemplateSyncService,
    templateStorageRegistry: TemplateStorageRegistry
) {
    routing {
        authenticate("protected") {
            route("/api/templates") {
                // ─── List all templates ───
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

                // ─── Get template metadata ───
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

                // ─── List all files in a template ───
                get("/{group}/{name}/files") {
                    val group = call.parameters["group"]
                        ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing group"))
                    val name = call.parameters["name"]
                        ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing name"))

                    val files = templateManager.listTemplateFiles(group, name)
                    call.respond(HttpStatusCode.OK, mapOf(
                        "group" to group,
                        "name" to name,
                        "files" to files
                    ))
                }

                // ─── Get file contents ───
                get("/{group}/{name}/files/{path...}") {
                    val group = call.parameters["group"]
                        ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing group"))
                    val name = call.parameters["name"]
                        ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing name"))
                    val relativePath = call.parameters.getAll("path")?.joinToString("/")
                        ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing file path"))

                    val content = templateManager.readTemplateFile(group, name, relativePath)
                        ?: return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "File not found"))

                    call.respondText(content, ContentType.Text.Plain)
                }

                // ─── Edit file contents (local templates only) ───
                patch("/{group}/{name}/files/{path...}") {
                    val group = call.parameters["group"]
                        ?: return@patch call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing group"))
                    val name = call.parameters["name"]
                        ?: return@patch call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing name"))
                    val relativePath = call.parameters.getAll("path")?.joinToString("/")
                        ?: return@patch call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing file path"))

                    val content = call.receiveText()
                    val success = templateManager.writeTemplateFile(group, name, relativePath, content)

                    if (success) {
                        call.respond(HttpStatusCode.OK, mapOf(
                            "message" to "File updated",
                            "path" to relativePath
                        ))
                    } else {
                        call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Failed to write file"))
                    }
                }

                // ─── Create new file ───
                post("/{group}/{name}/files/{path...}") {
                    val group = call.parameters["group"]
                        ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing group"))
                    val name = call.parameters["name"]
                        ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing name"))
                    val relativePath = call.parameters.getAll("path")?.joinToString("/")
                        ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing file path"))

                    val content = call.receiveText()
                    val success = templateManager.createTemplateFile(group, name, relativePath, content)

                    if (success) {
                        call.respond(HttpStatusCode.Created, mapOf(
                            "message" to "File created",
                            "path" to relativePath
                        ))
                    } else {
                        call.respond(HttpStatusCode.Conflict, mapOf("error" to "File already exists or failed to create"))
                    }
                }

                // ─── Delete file ───
                delete("/{group}/{name}/files/{path...}") {
                    val group = call.parameters["group"]
                        ?: return@delete call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing group"))
                    val name = call.parameters["name"]
                        ?: return@delete call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing name"))
                    val relativePath = call.parameters.getAll("path")?.joinToString("/")
                        ?: return@delete call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing file path"))

                    val success = templateManager.deleteTemplateFile(group, name, relativePath)

                    if (success) {
                        call.respond(HttpStatusCode.OK, mapOf(
                            "message" to "File deleted",
                            "path" to relativePath
                        ))
                    } else {
                        call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Failed to delete file"))
                    }
                }

                // ─── Export template as zip ───
                post("/{group}/{name}/export") {
                    val group = call.parameters["group"]
                        ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing group"))
                    val name = call.parameters["name"]
                        ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing name"))

                    val zipBytes = templateManager.exportTemplate(group, name)
                        ?: return@post call.respond(HttpStatusCode.NotFound, mapOf("error" to "Template not found"))

                    call.response.header(
                        "Content-Disposition",
                        ContentDisposition.Attachment.withParameter(
                            ContentDisposition.Parameters.FileName,
                            "$group-$name.zip"
                        ).toString()
                    )
                    call.respondBytes(
                        bytes = zipBytes,
                        contentType = ContentType.Application.Zip,
                        status = HttpStatusCode.OK
                    )
                }

                // ─── Import template from zip ───
                post("/{group}/{name}/import") {
                    val group = call.parameters["group"]
                        ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing group"))
                    val name = call.parameters["name"]
                        ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing name"))

                    val zipBytes = call.receive<ByteArray>()
                    val success = templateManager.importTemplate(group, name, zipBytes)

                    if (success) {
                        call.respond(HttpStatusCode.OK, mapOf(
                            "message" to "Template imported",
                            "group" to group,
                            "name" to name
                        ))
                    } else {
                        call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Failed to import template"))
                    }
                }

                // ─── Sync template from storage provider ───
                post("/{group}/{name}/sync") {
                    val group = call.parameters["group"]
                        ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing group"))
                    val name = call.parameters["name"]
                        ?: return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing name"))

                    val request = call.receive<StorageSyncRequest>()
                    val provider = templateStorageRegistry.get(request.storage)

                    if (provider == null) {
                        return@post call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Storage provider '${request.storage}' not found"))
                    }

                    val success = provider.syncTemplate(group, name)

                    if (success) {
                        call.respond(HttpStatusCode.OK, mapOf(
                            "message" to "Template synced from ${request.storage}",
                            "group" to group,
                            "name" to name,
                            "storage" to request.storage
                        ))
                    } else {
                        call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "Failed to sync template from ${request.storage}"))
                    }
                }

                // ─── Legacy sync endpoint (syncs all matching templates) ───
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
data class StorageSyncRequest(val storage: String)
