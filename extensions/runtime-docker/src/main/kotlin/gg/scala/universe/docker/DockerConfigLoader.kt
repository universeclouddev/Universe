package gg.scala.universe.docker

import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import gg.scala.universe.util.json.Serializers
import java.nio.file.Files
import java.nio.file.Path

object DockerConfigLoader {

    private val CONFIG_FILE = Path.of("./extensions/docker/config.json")

    fun load(): DockerConfig {
        if (!Files.exists(CONFIG_FILE)) {
            val default = DockerConfig()
            save(default)
            return default
        }

        return try {
            Files.newBufferedReader(CONFIG_FILE).use { reader ->
                Serializers.GSON.fromJson(reader, DockerConfig::class.java)
            }
        } catch (e: Exception) {
            log("Failed to load docker config from $CONFIG_FILE: ${e.message}", LogType.ERROR)
            log("Defaulting to base docker config", LogType.ERROR)
            DockerConfig()
        }
    }

    private fun save(config: DockerConfig) {
        try {
            Files.createDirectories(CONFIG_FILE.parent)
            Files.newBufferedWriter(CONFIG_FILE).use { writer ->
                Serializers.GSON.toJson(config, writer)
            }
        } catch (e: Exception) {
            log("Failed to save docker config to $CONFIG_FILE: ${e.message}", LogType.ERROR)
        }
    }
}
