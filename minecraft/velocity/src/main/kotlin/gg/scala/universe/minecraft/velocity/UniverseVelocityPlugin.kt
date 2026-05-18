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
import java.io.File
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
    private lateinit var config: VelocityConfig

    // ---- Lifecycle ----

    @Subscribe
    fun onProxyInitialization(event: ProxyInitializeEvent) {
        config = loadConfig()
        val masterUrl = config.masterUrl
        val apiKey = config.apiKey
        val pollInterval = config.pollIntervalSeconds

        api = VelocityUniverseAPIImpl(masterUrl, null, apiKey, logger)
        serverRegistry = ServerRegistry(proxy, logger)
        poller = InstancePoller(masterUrl, apiKey, serverRegistry, logger)

        // Start polling
        poller.start(pollInterval)

        // Register auto-connect listener if enabled
        if (config.autoConnect.enabled && config.autoConnect.configurationType.isNotBlank()) {
            val listener = AutoConnectListener(
                proxy = proxy,
                config = config.autoConnect,
                poller = poller
            )
            proxy.eventManager.register(this, listener)
            logger.info("Auto-connect enabled: configuration='{}', strategy={}", config.autoConnect.configurationType, config.autoConnect.strategy)
        }

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
        val configFile = dataDirectory.resolve("config.yml").toFile()
        if (!configFile.exists()) {
            dataDirectory.toFile().mkdirs()
            configFile.writeText(
                """
                # Universe Velocity Plugin Configuration
                master-url: "http://localhost:6000"
                poll-interval-seconds: 10
                # api-key: ""

                # Auto-connect: automatically route players to a server on join
                auto-connect:
                  enabled: false
                  # The configuration type to connect players to (e.g., "lobby", "hub")
                  configuration-type: "lobby"
                  # Server selection strategy: least_populated, most_populated, random
                  strategy: "least_populated"
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

        // Auto-connect defaults
        var autoConnectEnabled = false
        var autoConnectConfigType = "lobby"
        var autoConnectStrategy = "least_populated"

        var inAutoConnect = false
        for (line in lines) {
            val trimmed = line.trim()

            // Detect auto-connect section
            if (trimmed.startsWith("auto-connect:")) {
                inAutoConnect = true
                continue
            }

            // If we're in auto-connect section, parse its keys
            if (inAutoConnect) {
                if (trimmed.startsWith("enabled:")) {
                    autoConnectEnabled = trimmed.substringAfter(":").trim().toBoolean()
                    continue
                }
                if (trimmed.startsWith("configuration-type:")) {
                    autoConnectConfigType = trimmed.substringAfter(":").trim().trim('"')
                    continue
                }
                if (trimmed.startsWith("strategy:")) {
                    autoConnectStrategy = trimmed.substringAfter(":").trim().trim('"')
                    continue
                }
                // If we hit a non-indented line that's not a continuation, exit section
                if (!trimmed.startsWith("#") && !trimmed.startsWith("-") && !line.startsWith(" ") && !line.startsWith("\t") && trimmed.isNotEmpty()) {
                    inAutoConnect = false
                }
            }

            if (!inAutoConnect) {
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
        }

        val strategy = try {
            ServerSelectionStrategy.valueOf(autoConnectStrategy.uppercase())
        } catch (_: IllegalArgumentException) {
            ServerSelectionStrategy.LEAST_POPULATED
        }

        return VelocityConfig(
            masterUrl = masterUrl,
            apiKey = apiKey,
            pollIntervalSeconds = pollInterval,
            autoConnect = AutoConnectConfig(
                enabled = autoConnectEnabled,
                configurationType = autoConnectConfigType,
                strategy = strategy
            )
        )
    }

    data class VelocityConfig(
        val masterUrl: String,
        val apiKey: String?,
        val pollIntervalSeconds: Long,
        val autoConnect: AutoConnectConfig
    )
}

/**
 * Configuration for automatic player connection on join.
 */
data class AutoConnectConfig(
    val enabled: Boolean,
    val configurationType: String,
    val strategy: ServerSelectionStrategy
)

/**
 * Strategy for selecting which server to connect a player to.
 */
enum class ServerSelectionStrategy {
    /** Connect to the server with the fewest players. */
    LEAST_POPULATED,

    /** Connect to the server with the most players (but not full). */
    MOST_POPULATED,

    /** Connect to a random available server. */
    RANDOM;

    /**
     * Select a server from the available instances based on this strategy.
     * Returns null if no suitable server is available.
     */
    fun select(instances: List<InstancePoller.UniverseInstance>): InstancePoller.UniverseInstance? {
        if (instances.isEmpty()) return null

        return when (this) {
            LEAST_POPULATED -> instances.minByOrNull { it.players }
            MOST_POPULATED -> {
                // Filter out full servers, then pick the one with most players
                val notFull = instances.filter { it.maxPlayers <= 0 || it.players < it.maxPlayers }
                if (notFull.isEmpty()) null else notFull.maxByOrNull { it.players }
            }
            RANDOM -> instances.random()
        }
    }
}
