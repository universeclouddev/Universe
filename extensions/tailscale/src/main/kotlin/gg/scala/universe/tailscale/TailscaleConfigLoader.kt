package gg.scala.universe.tailscale

import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.util.json.Serializers
import java.nio.file.Files
import java.nio.file.Path

object TailscaleConfigLoader {

    private val CONFIG_FILE = Path.of("./extensions/tailscale/config.json")

    fun load(): TailscaleConfig {
        if (!Files.exists(CONFIG_FILE)) {
            val default = TailscaleConfig()
            save(default)
            return default
        }

        return try {
            Files.newBufferedReader(CONFIG_FILE).use { reader ->
                Serializers.GSON.fromJson(reader, TailscaleConfig::class.java)
            }
        } catch (e: Exception) {
            log("Failed to load tailscale config from $CONFIG_FILE: ${e.message}", LogLevel.ERROR)
            log("Defaulting to base tailscale config", LogLevel.ERROR)
            TailscaleConfig()
        }
    }

    private fun save(config: TailscaleConfig) {
        try {
            Files.createDirectories(CONFIG_FILE.parent)
            Files.newBufferedWriter(CONFIG_FILE).use { writer ->
                Serializers.GSON.toJson(config, writer)
            }
        } catch (e: Exception) {
            log("Failed to save tailscale config to $CONFIG_FILE: ${e.message}", LogLevel.ERROR)
        }
    }
}
