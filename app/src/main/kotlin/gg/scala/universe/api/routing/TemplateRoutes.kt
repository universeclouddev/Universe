package gg.scala.universe.api.routing

import gg.scala.universe.config.UniverseMainConfiguration
import gg.scala.universe.hz.ClusterStateService
import gg.scala.universe.template.TemplateManager
import gg.scala.universe.template.TemplateSyncService
import io.ktor.http.ContentDisposition
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.PartData
import io.ktor.http.content.forEachPart
import io.ktor.http.content.streamProvider
import io.ktor.server.application.Application
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.request.receiveMultipart
import io.ktor.server.response.respond
import io.ktor.server.response.respondBytes
import io.ktor.server.auth.authenticate
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import java.util.zip.ZipInputStream
import kotlin.io.path.exists
import kotlin.io.path.isDirectory

fun Application.configureTemplateRoutes(
    clusterStateService: ClusterStateService,
    templateManager: TemplateManager,
    templateSyncService: TemplateSyncService,
    mainConfiguration: UniverseMainConfiguration,
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

                get("/variables") {
                    val variables = buildList {
                        add(mapOf("key" to "%PORT%", "description" to "Allocated instance port"))
                        add(mapOf("key" to "%INSTANCE_ID%", "description" to "Unique instance identifier"))
                        add(mapOf("key" to "%MASTER_IP%", "description" to "Master node address"))
                        add(mapOf("key" to "%MASTER_ADDRESS%", "description" to "Master node address"))
                        add(mapOf("key" to "%MASTER_PORT%", "description" to "Master Hazelcast port"))
                        add(mapOf("key" to "%MASTER_API_PORT%", "description" to "Master REST API port"))
                        add(mapOf("key" to "%NODE_ID%", "description" to "Host node id"))
                        add(mapOf("key" to "%HOST_ADDRESS%", "description" to "Instance host address"))
                        add(mapOf("key" to "%CONFIGURATION_NAME%", "description" to "Configuration name"))
                        add(mapOf("key" to "%NODE_PORT%", "description" to "Node Hazelcast port"))
                        add(mapOf("key" to "%NODE_ADDRESS%", "description" to "Node bind address"))
                        add(mapOf("key" to "%RAM_MB%", "description" to "Allocated RAM in MB"))
                        add(mapOf("key" to "%INSTANCE_GROUPS%", "description" to "Instance groups (semicolon-separated)"))
                        mainConfiguration.nodeSpecificVariables.forEach { (key, _) ->
                            add(mapOf("key" to "%$key%", "description" to "Node-specific variable"))
                        }
                    }
                    call.respond(HttpStatusCode.OK, mapOf("variables" to variables))
                }

                post("/sync") {
                    val request = call.receive<TemplateSyncRequest>()
                    templateSyncService.syncTemplates(request.pattern)
                    call.respond(HttpStatusCode.OK, mapOf("message" to "Sync triggered for pattern: ${request.pattern}"))
                }

                post {
                    val request = call.receive<CreateTemplateRequest>()
                    try {
                        val path = templateManager.createTemplate(request.group, request.name)
                        call.respond(HttpStatusCode.Created, mapOf(
                            "group" to request.group,
                            "name" to request.name,
                            "path" to path.toString(),
                        ))
                    } catch (e: IllegalStateException) {
                        call.respond(HttpStatusCode.Conflict, mapOf("error" to e.message))
                    }
                }

                post("/import") {
                    var group: String? = null
                    var name: String? = null
                    var overwrite = true
                    var zipBytes: ByteArray? = null

                    call.receiveMultipart().forEachPart { part ->
                        when (part) {
                            is PartData.FormItem -> when (part.name) {
                                "group" -> group = part.value
                                "name" -> name = part.value
                                "overwrite" -> overwrite = part.value.toBooleanStrictOrNull() ?: true
                            }
                            is PartData.FileItem -> if (part.name == "file") {
                                zipBytes = part.streamProvider().readBytes()
                            }
                            else -> {}
                        }
                        part.dispose()
                    }

                    if (group.isNullOrBlank() || name.isNullOrBlank() || zipBytes == null) {
                        return@post call.respond(
                            HttpStatusCode.BadRequest,
                            mapOf("error" to "Missing group, name, or zip file"),
                        )
                    }

                    try {
                        ZipInputStream(zipBytes!!.inputStream()).use { zis ->
                            templateManager.importTemplateZip(group!!, name!!, zis, overwrite)
                        }
                        call.respond(HttpStatusCode.OK, mapOf(
                            "message" to "Template imported",
                            "group" to group,
                            "name" to name,
                        ))
                    } catch (e: Exception) {
                        call.respond(HttpStatusCode.BadRequest, mapOf("error" to (e.message ?: "Import failed")))
                    }
                }

                get("/{group}/{name}/files") {
                    val group = call.parameters["group"]
                        ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing group"))
                    val name = call.parameters["name"]
                        ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing name"))

                    try {
                        val files = templateManager.listTemplateFiles(group, name)
                        call.respond(HttpStatusCode.OK, mapOf(
                            "group" to group,
                            "name" to name,
                            "files" to files,
                        ))
                    } catch (_: NoSuchFileException) {
                        call.respond(HttpStatusCode.NotFound, mapOf("error" to "Template not found"))
                    }
                }

                get("/{group}/{name}/files/content") {
                    val group = call.parameters["group"]
                        ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing group"))
                    val name = call.parameters["name"]
                        ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing name"))
                    val path = call.request.queryParameters["path"]
                        ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing path query"))

                    try {
                        val content = templateManager.readTemplateFile(group, name, path)
                        call.respond(HttpStatusCode.OK, mapOf(
                            "path" to path,
                            "content" to content,
                            "encoding" to "utf-8",
                        ))
                    } catch (e: NoSuchFileException) {
                        call.respond(HttpStatusCode.NotFound, mapOf("error" to "File not found"))
                    } catch (e: IllegalArgumentException) {
                        call.respond(HttpStatusCode.BadRequest, mapOf("error" to e.message))
                    }
                }

                put("/{group}/{name}/files/content") {
                    val group = call.parameters["group"]
                        ?: return@put call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing group"))
                    val name = call.parameters["name"]
                        ?: return@put call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing name"))
                    val request = call.receive<TemplateFileWriteRequest>()

                    try {
                        templateManager.writeTemplateFile(group, name, request.path, request.content)
                        call.respond(HttpStatusCode.OK, mapOf(
                            "path" to request.path,
                            "message" to "Saved",
                        ))
                    } catch (e: NoSuchFileException) {
                        call.respond(HttpStatusCode.NotFound, mapOf("error" to "Template not found"))
                    } catch (e: IllegalArgumentException) {
                        call.respond(HttpStatusCode.BadRequest, mapOf("error" to e.message))
                    }
                }

                get("/{group}/{name}/export") {
                    val group = call.parameters["group"]
                        ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing group"))
                    val name = call.parameters["name"]
                        ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing name"))

                    val path = templateManager.getTemplatePath(group, name)
                    if (!path.exists() || !path.isDirectory()) {
                        return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "Template not found"))
                    }

                    val zipBytes = templateSyncService.zipDirectory(path)
                    call.response.headers.append(
                        HttpHeaders.ContentDisposition,
                        ContentDisposition.Attachment
                            .withParameter(ContentDisposition.Parameters.FileName, "$group-$name.zip")
                            .toString(),
                    )
                    call.respondBytes(zipBytes, ContentType.Application.Zip)
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
            }
        }
    }
}

data class TemplateSyncRequest(val pattern: String)

data class CreateTemplateRequest(val group: String, val name: String)

data class TemplateFileWriteRequest(val path: String, val content: String)
