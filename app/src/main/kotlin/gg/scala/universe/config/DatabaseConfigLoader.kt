package gg.scala.universe.config

import com.google.gson.Gson
import com.google.gson.JsonSyntaxException
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import java.nio.file.Path
import kotlin.io.path.exists
import kotlin.io.path.readText
import kotlin.io.path.writeText

object DatabaseConfigLoader {
    private const val CONFIG_FILE = "./database.json"
    private val gson = Gson()

    fun load(): DatabaseConfiguration {
        val path = Path.of(CONFIG_FILE)
        if (!path.exists()) {
            log("Database config not found at $CONFIG_FILE, creating default...", LogLevel.WARNING)
            val default = DatabaseConfiguration()
            save(default)
            return default
        }

        return try {
            val content = path.readText()
            gson.fromJson(content, DatabaseConfiguration::class.java)
                .also { log("Loaded database configuration from $CONFIG_FILE (provider=${it.provider})") }
        } catch (e: JsonSyntaxException) {
            log("Failed to parse $CONFIG_FILE: ${e.message}", LogLevel.ERROR)
            DatabaseConfiguration()
        }
    }

    fun save(config: DatabaseConfiguration) {
        val path = Path.of(CONFIG_FILE)
        val json = gson.newBuilder().setPrettyPrinting().create().toJson(config)
        path.writeText(json)
        log("Saved database configuration to $CONFIG_FILE")
    }
}
