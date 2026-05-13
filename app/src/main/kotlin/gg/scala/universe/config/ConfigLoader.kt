package gg.scala.universe.config

import com.google.gson.Gson
import com.google.gson.JsonSyntaxException
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import java.nio.file.Path
import kotlin.io.path.exists
import kotlin.io.path.readText
import kotlin.io.path.writeText

object ConfigLoader {
    private const val CONFIG_FILE = "./config.json"
    private val gson = Gson()

    fun load(): UniverseMainConfiguration {
        val path = Path.of(CONFIG_FILE)
        if (!path.exists()) {
            log("Config file not found at $CONFIG_FILE, creating default config...", LogLevel.WARNING)
            val defaultConfig = UniverseMainConfiguration()
            save(defaultConfig)
            return defaultConfig
        }

        return try {
            val content = path.readText()
            gson.fromJson(content, UniverseMainConfiguration::class.java)
                .also { log("Loaded main configuration from $CONFIG_FILE") }
        } catch (e: JsonSyntaxException) {
            log("Failed to parse $CONFIG_FILE: ${e.message}", LogLevel.ERROR)
            UniverseMainConfiguration()
        }
    }

    fun save(config: UniverseMainConfiguration) {
        val path = Path.of(CONFIG_FILE)
        val json = gson.newBuilder().setPrettyPrinting().create().toJson(config)
        path.writeText(json)
        log("Saved main configuration to $CONFIG_FILE")
    }
}
