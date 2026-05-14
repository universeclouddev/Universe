package gg.scala.universe.db.redis

import com.google.inject.Inject
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.db.DatabaseProvider
import gg.scala.universe.db.DatabaseRegistry
import gg.scala.universe.extension.Extension
import gg.scala.universe.schema.ApiKey
import gg.scala.universe.schema.ApiPermission
import redis.clients.jedis.JedisPooled

/**
 * Redis database provider for storing API keys.
 *
 * Uses [DatabaseConfiguration.host] and [port] to connect to a Redis server.
 * API keys are stored as Redis hashes under the key prefix `universe:apikey:`.
 */
class RedisDatabaseProvider(
    private val host: String,
    private val port: Int,
    private val password: String
) : DatabaseProvider {

    override val providerKey: String = "redis"

    private var jedis: JedisPooled? = null
    private val keyPrefix = "universe:apikey:"
    private val tokenIndexKey = "universe:apikey:index:token"

    override fun connect() {
        log("Connecting to Redis at $host:$port")
        jedis = if (password.isNotBlank()) {
            JedisPooled(host, port, null, password)
        } else {
            JedisPooled(host, port)
        }
        log("Redis database connected successfully")
    }

    override fun disconnect() {
        try {
            jedis?.close()
            log("Redis database disconnected")
        } catch (e: Exception) {
            log("Error closing Redis connection: ${e.message}", LogLevel.WARNING)
        }
        jedis = null
    }

    override fun isConnected(): Boolean {
        return try {
            jedis?.ping() == "PONG"
        } catch (_: Exception) {
            false
        }
    }

    override fun getApiKeyByToken(token: String): ApiKey? {
        val keyId = jedis!!.hget(tokenIndexKey, token) ?: return null
        return getApiKeyById(keyId)
    }

    override fun getApiKeyById(keyId: String): ApiKey? {
        val map = jedis!!.hgetAll("$keyPrefix$keyId") ?: return null
        if (map.isEmpty()) return null

        return ApiKey(
            keyId = map["key_id"] ?: return null,
            token = map["token"] ?: return null,
            permission = ApiPermission.valueOf(map["permission"] ?: return null)
        )
    }

    override fun saveApiKey(apiKey: ApiKey) {
        val hashKey = "$keyPrefix${apiKey.keyId}"
        jedis!!.hset(hashKey, mapOf(
            "key_id" to apiKey.keyId,
            "token" to apiKey.token,
            "permission" to apiKey.permission.name
        ))
        // Maintain token -> key_id index
        jedis!!.hset(tokenIndexKey, apiKey.token, apiKey.keyId)
    }

    override fun deleteApiKey(keyId: String) {
        val apiKey = getApiKeyById(keyId) ?: return
        jedis!!.del("$keyPrefix$keyId")
        jedis!!.hdel(tokenIndexKey, apiKey.token)
    }

    override fun listApiKeys(): List<ApiKey> {
        val keys = jedis!!.keys("$keyPrefix*")
        return keys.mapNotNull { key ->
            val keyId = key.removePrefix(keyPrefix)
            getApiKeyById(keyId)
        }
    }
}
