package gg.scala.universe.api.plugins

import com.google.inject.Inject
import com.google.inject.Singleton
import gg.scala.universe.console.log
import gg.scala.universe.db.DatabaseProvider
import gg.scala.universe.schema.ApiKey
import gg.scala.universe.schema.ApiPermission
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.auth.Authentication
import io.ktor.server.auth.bearer
import java.util.concurrent.ConcurrentHashMap
import kotlin.time.Duration.Companion.seconds

/**
 * In-memory cache for API keys with TTL-based invalidation.
 *
 * Keys are cached for 15 seconds before re-fetching from the database.
 */
@Singleton
class ApiKeyCache @Inject constructor(private val database: DatabaseProvider) {
    private data class CachedEntry(val key: ApiKey?, val timestamp: Long)

    private val cache = ConcurrentHashMap<String, CachedEntry>()
    private val ttlMs = 15_000L // 15 seconds

    fun getByToken(token: String): ApiKey? {
        val cached = cache[token]
        if (cached != null && System.currentTimeMillis() - cached.timestamp < ttlMs) {
            return cached.key
        }

        val key = database.getApiKeyByToken(token)
        cache[token] = CachedEntry(key, System.currentTimeMillis())
        return key
    }

    fun invalidate(token: String) {
        cache.remove(token)
    }

    fun invalidateAll() {
        cache.clear()
    }
}

fun Application.configureSecurity(cache: ApiKeyCache) {
    install(Authentication) {
        bearer("protected") {
            realm = "Access to protected endpoints"
            authenticate { tokenCredential ->
                val token = tokenCredential.token
                val apiKey = cache.getByToken(token)
                    ?: return@authenticate null

                if (apiKey.permission != ApiPermission.ALL) {
                    return@authenticate null
                }

                return@authenticate apiKey
            }
        }

        bearer("public") {
            realm = "Access to public endpoints"
            authenticate { tokenCredential ->
                val token = tokenCredential.token
                val apiKey = cache.getByToken(token)
                    ?: return@authenticate null

                return@authenticate apiKey
            }
        }
    }
    log("Loaded Authentication with database-backed API keys")
}
