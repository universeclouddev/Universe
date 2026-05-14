package gg.scala.universe.db.redis

import com.google.gson.Gson
import com.google.inject.Inject
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.db.DatabaseRegistry
import gg.scala.universe.extension.Extension

class RedisExtension : Extension {

    override fun id(): String = "db-redis"
    override fun version(): String = "1.0.0"

    @Inject
    private lateinit var registry: DatabaseRegistry

    override fun onLoad() {
        val config = loadDatabaseConfig()

        if (config.provider != "redis") {
            return // Not configured for Redis
        }

        val provider = RedisDatabaseProvider(
            host = config.host,
            port = config.port,
            password = config.password
        )
        registry.register("redis", provider)
        log("Redis database extension loaded (host=${config.host}:${config.port})", LogLevel.SUCCESS)
    }

    override fun onUnload() {
        registry.get("redis")?.disconnect()
        registry.unregister("redis")
        log("Redis database extension unloaded")
    }

    override fun onReload() {
        onUnload()
        onLoad()
        log("Redis database extension reloaded")
    }

    private fun loadDatabaseConfig(): DatabaseConfig {
        val file = java.io.File("./database.json")
        return if (file.exists()) {
            Gson().fromJson(file.readText(), DatabaseConfig::class.java)
        } else {
            DatabaseConfig()
        }
    }

    private data class DatabaseConfig(
        val provider: String = "h2",
        val url: String = "universe.db",
        val host: String = "localhost",
        val port: Int = 3306,
        val database: String = "universe",
        val username: String = "sa",
        val password: String = ""
    )
}
