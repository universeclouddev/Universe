package gg.scala.universe.api.plugins

import gg.scala.universe.schema.ApiKey
import gg.scala.universe.schema.ApiPermission
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import io.ktor.websocket.CloseReason
import io.ktor.websocket.close
import io.ktor.server.websocket.WebSocketServerSession

fun ApplicationCall.extractBearerToken(): String? {
    val header = request.headers[HttpHeaders.Authorization]
    if (header != null && header.startsWith("Bearer ", ignoreCase = true)) {
        return header.substringAfter("Bearer ", "").trim().takeIf { it.isNotEmpty() }
    }
    return request.queryParameters["token"]?.trim()?.takeIf { it.isNotEmpty() }
}

fun ApplicationCall.authenticateApiKey(cache: ApiKeyCache, requireAll: Boolean): ApiKey? {
    val token = extractBearerToken() ?: return null
    val apiKey = cache.getByToken(token) ?: return null
    if (requireAll && apiKey.permission != ApiPermission.ALL) return null
    return apiKey
}

suspend fun ApplicationCall.respondUnauthorized() {
    respond(HttpStatusCode.Unauthorized, mapOf("error" to "Unauthorized"))
}

suspend fun WebSocketServerSession.closeUnauthorized(reason: String = "Unauthorized") {
    close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, reason))
}
