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

class UniverseBungeePlugin : Plugin(), UniverseAPI {

    private lateinit var apiImpl: BungeeUniverseAPIImpl
    private lateinit var serverRegistry: BungeeServerRegistry
    private lateinit var poller: BungeeInstancePoller
    private lateinit var scheduler: ScheduledExecutorService

    // ---- UniverseAPI implementation ----

    override fun getMasterUrl(): String = apiImpl.getMasterUrl()
    override fun getInstanceId(): String? = apiImpl.getInstanceId()
    override fun isConnected(): Boolean = apiImpl.isConnected()
    override fun getInstanceManager() = apiImpl.getInstanceManager()
    override fun getConfigurationManager() = apiImpl.getConfigurationManager()
    override fun getTemplateManager() = apiImpl.getTemplateManager()

    // ---- Lifecycle ----

    override fun onEnable() {
        val config = loadConfig()
        val masterUrl = config.masterUrl
        val pollInterval = config.pollIntervalSeconds

        apiImpl = BungeeUniverseAPIImpl(masterUrl, null, logger)
        serverRegistry = BungeeServerRegistry(logger)
        poller = BungeeInstancePoller(masterUrl, serverRegistry, logger)

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
        annotationParser.parse(UniverseCloudCommands(ProxyServer.getInstance(), this))

        // Register API
        Universe.register(this)

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
                """.trimIndent()
            )
        }

        // Simple YAML-like parsing (read key: value lines)
        val lines = configFile.readLines()
        var masterUrl = System.getProperty("universe.master.url")
            ?: System.getenv("UNIVERSE_MASTER_URL")
            ?: "http://localhost:6000"
        var pollInterval = 10L

        for (line in lines) {
            val trimmed = line.trim()
            if (trimmed.startsWith("master-url:")) {
                masterUrl = trimmed.substringAfter(":").trim().trim('"')
            }
            if (trimmed.startsWith("poll-interval-seconds:")) {
                pollInterval = trimmed.substringAfter(":").trim().toLongOrNull() ?: 10L
            }
        }

        return BungeeConfig(masterUrl, pollInterval)
    }

    data class BungeeConfig(val masterUrl: String, val pollIntervalSeconds: Long)
}
