package gg.scala.universe.minecraft.velocity

import com.google.inject.Inject
import com.velocitypowered.api.event.Subscribe
import com.velocitypowered.api.event.proxy.ProxyInitializeEvent
import com.velocitypowered.api.event.proxy.ProxyShutdownEvent
import com.velocitypowered.api.plugin.Plugin
import com.velocitypowered.api.plugin.annotation.DataDirectory
import com.velocitypowered.api.proxy.ProxyServer
import gg.scala.universe.minecraft.api.Universe
import org.incendo.cloud.SenderMapper
import org.incendo.cloud.annotations.AnnotationParser
import org.incendo.cloud.execution.ExecutionCoordinator
import org.incendo.cloud.velocity.VelocityCommandManager
import org.slf4j.Logger
import java.nio.file.Path

@Plugin(
    id = "universe",
    name = "Universe",
    version = "0.0.1",
    description = "Auto-registers Universe instances as Velocity backends",
    authors = ["Scala Universe"]
)
class UniverseVelocityPlugin @Inject constructor(
    private val proxy: ProxyServer,
    private val logger: Logger,
    @DataDirectory private val dataDirectory: Path
) {

    private lateinit var api: VelocityUniverseAPIImpl
    private lateinit var serverRegistry: ServerRegistry
    private lateinit var poller: InstancePoller

    // ---- Lifecycle ----

    @Subscribe
    fun onProxyInitialization(event: ProxyInitializeEvent) {
        val config = loadConfig()
        val masterUrl = config.masterUrl
        val apiKey = config.apiKey
        val pollInterval = config.pollIntervalSeconds

        api = VelocityUniverseAPIImpl(masterUrl, null, apiKey, logger)
        serverRegistry = ServerRegistry(proxy, logger)
        poller = InstancePoller(masterUrl, apiKey, serverRegistry, logger)

        // Start polling
        poller.start(pollInterval)

        // Register Cloud commands
        val pluginContainer = proxy.pluginManager.fromInstance(this).orElseThrow()
        val commandManager = VelocityCommandManager(
            pluginContainer,
            proxy,
            ExecutionCoordinator.asyncCoordinator(),
            SenderMapper.identity()
        )

        val annotationParser = AnnotationParser(
            commandManager,
            com.velocitypowered.api.command.CommandSource::class.java
        )
        annotationParser.parse(UniverseCloudCommands(proxy, api))

        // Register API
        Universe.register(api)

        logger.info("Universe Velocity plugin enabled. Polling $masterUrl every ${pollInterval}s")
    }

    @Subscribe
    fun onProxyShutdown(event: ProxyShutdownEvent) {
        poller.stop()

        // Unregister API
        Universe.unregister()

        logger.info("Universe Velocity plugin disabled")
    }

    private fun loadConfig(): VelocityConfig {
        val configFile = dataDirectory.resolve("config.toml").toFile()
        if (!configFile.exists()) {
            dataDirectory.toFile().mkdirs()
            configFile.writeText(
                """
                # Universe Velocity Plugin Configuration
                master-url = "http://localhost:6000"
                poll-interval-seconds = 10
                # api-key = ""
                """.trimIndent()
            )
        }
        // Simple TOML parsing: read key = value lines
        val lines = configFile.readLines()
        var masterUrl = System.getProperty("universe.master.url")
            ?: System.getenv("UNIVERSE_MASTER_URL")
            ?: "http://localhost:6000"
        var apiKey = System.getProperty("universe.api.key")
            ?: System.getenv("UNIVERSE_API_KEY")
        var pollInterval = 10L

        for (line in lines) {
            val trimmed = line.trim()
            if (trimmed.startsWith("master-url")) {
                masterUrl = trimmed.substringAfter("=").trim().trim('"')
            }
            if (trimmed.startsWith("poll-interval-seconds")) {
                pollInterval = trimmed.substringAfter("=").trim().toLongOrNull() ?: 10L
            }
            if (trimmed.startsWith("api-key")) {
                val key = trimmed.substringAfter("=").trim().trim('"')
                if (key.isNotBlank()) {
                    apiKey = key
                }
            }
        }

        return VelocityConfig(masterUrl, apiKey, pollInterval)
    }

    data class VelocityConfig(val masterUrl: String, val apiKey: String?, val pollIntervalSeconds: Long)
}
