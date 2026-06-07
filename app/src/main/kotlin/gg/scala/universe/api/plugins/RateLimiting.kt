package gg.scala.universe.api.plugins

import gg.scala.universe.console.log
import gg.scala.universe.schema.ApiKey
import gg.scala.universe.schema.ApiPermission
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.createRouteScopedPlugin
import io.ktor.server.response.respond
import java.util.concurrent.ConcurrentHashMap
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

/**
 * Configuration for the API-key-aware sliding window rate limiter.
 *
 * @param rate The time window for rate limiting (e.g., 10.seconds).
 * @param capacity Maximum number of calls allowed within the time window.
 * @param keyCache The API key cache used to validate tokens.
 */
class RateLimitConfig {
    var rate: Duration = 60.seconds
    var capacity: Int = 100
    var keyCache: ApiKeyCache? = null
}

/**
 * Custom Ktor plugin for API-key-aware sliding window rate limiting.
 *
 * - Unauthenticated requests are rejected with 401.
 * - Keys with [ApiPermission.ALL] bypass rate limiting entirely.
 * - Keys with [ApiPermission.PUBLIC] are tracked per-key.
 * - When the capacity is exceeded, 429 Too Many Requests is returned.
 *
 * Note: Reads the Authorization header directly because `onCall` runs
 * before Ktor's authentication interceptor sets the principal.
 */
val RateLimiting = createRouteScopedPlugin(
    name = "RateLimiting",
    createConfiguration = ::RateLimitConfig
) {
    val cache = pluginConfig.keyCache
        ?: throw IllegalStateException("RateLimiting plugin requires keyCache to be set")
    val rateLimiter = ApiKeyAwareSlidingWindowRateLimiter(
        rate = pluginConfig.rate,
        capacity = pluginConfig.capacity
    )

    onCall { call ->
        when (val result = rateLimiter.tryAccept(call, cache)) {
            is RateLimitResult.Allowed -> { /* proceed */ }
            is RateLimitResult.Denied -> {
                call.respond(
                    HttpStatusCode.TooManyRequests,
                    mapOf(
                        "error" to "Rate limit exceeded",
                        "message" to result.message,
                        "retryAfterMs" to result.retryAfterMs
                    )
                )
            }
            is RateLimitResult.Unauthenticated -> {
                call.respond(
                    HttpStatusCode.Unauthorized,
                    mapOf("error" to "Authentication required")
                )
            }
        }
    }
}

sealed class RateLimitResult {
    data object Allowed : RateLimitResult()
    data class Denied(val message: String, val retryAfterMs: Long) : RateLimitResult()
    data object Unauthenticated : RateLimitResult()
}

class ApiKeyAwareSlidingWindowRateLimiter(
    private val rate: Duration,
    private val capacity: Int
) {
    private val timeWindowMs = rate.inWholeMilliseconds
    private val timestamps = ConcurrentHashMap<String, MutableList<Long>>()

    fun tryAccept(call: ApplicationCall, cache: ApiKeyCache): RateLimitResult {
        // Read token directly (onCall runs before auth interceptor)
        val token = call.extractBearerToken()
            ?: return RateLimitResult.Unauthenticated

        val apiKey = cache.getByToken(token)
            ?: return RateLimitResult.Unauthenticated

        // Admin keys bypass rate limiting
        if (apiKey.permission == ApiPermission.ALL) {
            return RateLimitResult.Allowed
        }

        val now = System.currentTimeMillis()
        val keyTimestamps = timestamps.computeIfAbsent(apiKey.keyId) { mutableListOf() }

        synchronized(keyTimestamps) {
            // Remove timestamps outside the window
            val cutoff = now - timeWindowMs
            keyTimestamps.removeAll { it < cutoff }

            if (keyTimestamps.size >= capacity) {
                val oldestInWindow = keyTimestamps.firstOrNull() ?: now
                val retryAfterMs = (oldestInWindow + timeWindowMs) - now
                return RateLimitResult.Denied(
                    message = "$capacity calls were already made during $rate",
                    retryAfterMs = retryAfterMs.coerceAtLeast(0)
                )
            }

            keyTimestamps.add(now)
            return RateLimitResult.Allowed
        }
    }
}
