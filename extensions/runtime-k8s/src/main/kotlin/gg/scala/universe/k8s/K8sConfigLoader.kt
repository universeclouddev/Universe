package gg.scala.universe.k8s

import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import gg.scala.universe.util.json.Serializers
import java.nio.file.Files
import java.nio.file.Path

object K8sConfigLoader {

    private val CONFIG_FILE = Path.of("./extensions/k8s/config.json")

    fun load(): K8sConfig {
        if (!Files.exists(CONFIG_FILE)) {
            val default = K8sConfig()
            save(default)
            return default
        }

        return try {
            Files.newBufferedReader(CONFIG_FILE).use { reader ->
                Serializers.GSON.fromJson(reader, K8sConfig::class.java)
            }
        } catch (e: Exception) {
            log("Failed to load k8s config from $CONFIG_FILE: ${e.message}", LogType.ERROR)
            log("Defaulting to base k8s config", LogType.ERROR)
            K8sConfig()
        }
    }

    private fun save(config: K8sConfig) {
        try {
            Files.createDirectories(CONFIG_FILE.parent)
            Files.newBufferedWriter(CONFIG_FILE).use { writer ->
                Serializers.GSON.toJson(config, writer)
            }
        } catch (e: Exception) {
            log("Failed to save k8s config to $CONFIG_FILE: ${e.message}", LogType.ERROR)
        }
    }
}
