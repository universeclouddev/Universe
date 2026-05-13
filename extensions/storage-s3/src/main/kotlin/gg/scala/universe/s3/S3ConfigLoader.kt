package gg.scala.universe.s3

import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.util.json.Serializers
import java.nio.file.Files
import java.nio.file.Path

object S3ConfigLoader {

    private val CONFIG_FILE = Path.of("./extensions/s3/config.json")

    fun load(): S3Config {
        if (!Files.exists(CONFIG_FILE)) {
            val default = S3Config()
            save(default)
            return default
        }

        return try {
            Files.newBufferedReader(CONFIG_FILE).use { reader ->
                Serializers.GSON.fromJson(reader, S3Config::class.java)
            }
        } catch (e: Exception) {
            log("Failed to load S3 config from $CONFIG_FILE: ${e.message}", LogLevel.ERROR)
            log("Defaulting to base S3 config", LogLevel.ERROR)
            S3Config()
        }
    }

    private fun save(config: S3Config) {
        try {
            Files.createDirectories(CONFIG_FILE.parent)
            Files.newBufferedWriter(CONFIG_FILE).use { writer ->
                Serializers.GSON.toJson(config, writer)
            }
        } catch (e: Exception) {
            log("Failed to save S3 config to $CONFIG_FILE: ${e.message}", LogLevel.ERROR)
        }
    }
}
