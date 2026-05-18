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

        // Register auto-connect listener if enabled
        if (config.autoConnect.enabled && config.autoConnect.configurationType.isNotBlank()) {
            val listener = AutoConnectListener(
                proxy = ProxyServer.getInstance(),
                config = config.autoConnect,
                poller = poller
            )
            ProxyServer.getInstance().pluginManager.registerListener(this, listener)
            logger.info("Auto-connect enabled: configuration='${config.autoConnect.configurationType}', strategy=${config.autoConnect.strategy}")
        }

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

        return BungeeConfig(
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

    data class BungeeConfig(
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
    fun select(instances: List<BungeeInstancePoller.BungeeInstance>): BungeeInstancePoller.BungeeInstance? {
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
