package gg.scala.universe.db.postgres

import com.google.gson.Gson
import com.google.inject.Inject
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.db.DatabaseRegistry
import gg.scala.universe.extension.Extension

class PostgresExtension : Extension {

    override fun id(): String = "db-postgres"
    override fun version(): String = "1.0.0"

    @Inject
    private lateinit var registry: DatabaseRegistry

    override fun onLoad() {
        // Read database.json directly to avoid :app dependency
        val config = loadDatabaseConfig()

        if (config.provider != "postgres") {
            return // Not configured for PostgreSQL
        }

        val provider = PostgresDatabaseProvider(
            host = config.host,
            port = config.port,
            database = config.database,
            username = config.username,
            password = config.password
        )
        registry.register("postgres", provider)
        log("PostgreSQL database extension loaded (host=${config.host}:${config.port}, db=${config.database})", LogLevel.SUCCESS)
    }

    override fun onUnload() {
        registry.get("postgres")?.disconnect()
        registry.unregister("postgres")
        log("PostgreSQL database extension unloaded")
    }

    override fun onReload() {
        onUnload()
        onLoad()
        log("PostgreSQL database extension reloaded")
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
