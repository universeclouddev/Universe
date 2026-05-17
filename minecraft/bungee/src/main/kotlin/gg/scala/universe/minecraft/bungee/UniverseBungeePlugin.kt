package gg.scala.universe.minecraft.bungee

import gg.scala.universe.minecraft.api.Universe
import gg.scala.universe.minecraft.api.UniverseAPI
import net.md_5.bungee.api.ProxyServer
import net.md_5.bungee.api.plugin.Plugin
import org.incendo.cloud.bungee.BungeeCommandManager
import org.incendo.cloud.execution.ExecutionCoordinator
import org.incendo.cloud.SenderMapper
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

class UniverseBungeePlugin : Plugin() {

    private lateinit var api: BungeeUniverseAPIImpl
    private lateinit var serverRegistry: BungeeServerRegistry
    private lateinit var poller: BungeeInstancePoller
    private lateinit var scheduler: ScheduledExecutorService

    // ---- Lifecycle ----

    override fun onEnable() {
        val config = loadConfig()
        val masterUrl = config.masterUrl
        val apiKey = config.apiKey
        val pollInterval = config.pollIntervalSeconds

        api = BungeeUniverseAPIImpl(masterUrl, null, apiKey, logger)
        serverRegistry = BungeeServerRegistry(logger)
        poller = BungeeInstancePoller(masterUrl, apiKey, serverRegistry, logger)

        // Start polling
        scheduler = Executors.newSingleThreadScheduledExecutor()
        poller.start(pollInterval, scheduler)

        // Register Cloud commands
        val commandManager = BungeeCommandManager(
            this,
            ExecutionCoordinator.asyncCoordinator(),
            SenderMapper.identity()
        )

        val annotationParser = org.incendo.cloud.annotations.AnnotationParser(
            commandManager,
            net.md_5.bungee.api.CommandSender::class.java
        )
        annotationParser.parse(UniverseCloudCommands(ProxyServer.getInstance(), api))

        // Register API
        Universe.register(api)

        logger.info("Universe BungeeCord plugin enabled. Polling $masterUrl every ${pollInterval}s")
    }

    override fun onDisable() {
        poller.stop()
        if (::scheduler.isInitialized) {
            scheduler.shutdown()
            scheduler.awaitTermination(5, TimeUnit.SECONDS)
        }

        // Unregister API
        Universe.unregister()

        logger.info("Universe BungeeCord plugin disabled")
    }

    private fun loadConfig(): BungeeConfig {
        val configFile = File(dataFolder, "config.yml")
        if (!configFile.exists()) {
            dataFolder.mkdirs()
            configFile.writeText(
                """
                # Universe BungeeCord Plugin Configuration
                master-url: "http://localhost:6000"
                poll-interval-seconds: 10
                # api-key: ""
                """.trimIndent()
            )
        }

        // Simple YAML-like parsing (read key: value lines)
        val lines = configFile.readLines()
        var masterUrl = System.getProperty("universe.master.url")
            ?: System.getenv("UNIVERSE_MASTER_URL")
            ?: "http://localhost:6000"
        var apiKey = System.getProperty("universe.api.key")
            ?: System.getenv("UNIVERSE_API_KEY")
        var pollInterval = 10L

        for (line in lines) {
            val trimmed = line.trim()
            if (trimmed.startsWith("master-url:")) {
                masterUrl = trimmed.substringAfter(":").trim().trim('"')
            }
            if (trimmed.startsWith("poll-interval-seconds:")) {
                pollInterval = trimmed.substringAfter(":").trim().toLongOrNull() ?: 10L
            }
            if (trimmed.startsWith("api-key:")) {
                val key = trimmed.substringAfter(":").trim().trim('"')
                if (key.isNotBlank()) {
                    apiKey = key
                }
            }
        }

        return BungeeConfig(masterUrl, apiKey, pollInterval)
    }

    data class BungeeConfig(val masterUrl: String, val apiKey: String?, val pollIntervalSeconds: Long)
}
