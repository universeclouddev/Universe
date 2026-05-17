package gg.scala.universe.minecraft.folia

import gg.scala.universe.minecraft.api.Universe
import org.bukkit.Bukkit
import org.bukkit.plugin.java.JavaPlugin
import org.incendo.cloud.annotations.AnnotationParser
import org.incendo.cloud.execution.ExecutionCoordinator
import org.incendo.cloud.paper.PaperCommandManager
import org.incendo.cloud.paper.util.sender.PaperSimpleSenderMapper
import java.util.concurrent.TimeUnit

class UniversePlugin : JavaPlugin() {

    private lateinit var api: FoliaUniverseAPIImpl
    private lateinit var reporter: InstanceReporter
    private var heartbeatTask: io.papermc.paper.threadedregions.scheduler.ScheduledTask? = null

    // ---- Plugin lifecycle ----

    override fun onEnable() {
        saveDefaultConfig()

        val masterUrl = resolveMasterUrl()
        val instanceId = resolveInstanceId()
        val apiKey = resolveApiKey()

        if (instanceId == null) {
            logger.warning("No Universe instance ID configured. Set universe.instance.id system property, UNIVERSE_INSTANCE_ID env var, or instance-id in config.yml")
            return
        }

        api = FoliaUniverseAPIImpl(masterUrl, instanceId, apiKey, logger)
        reporter = InstanceReporter(masterUrl, instanceId, apiKey, logger)

        // Report ONLINE state
        reporter.reportState(gg.scala.universe.minecraft.api.InstanceState.ONLINE)

        // Start heartbeat using Folia's AsyncScheduler
        val interval = config.getLong("heartbeat-interval-seconds", 30)
        heartbeatTask = Bukkit.getAsyncScheduler().runAtFixedRate(
            this,
            { reporter.heartbeat() },
            interval,
            interval,
            TimeUnit.SECONDS
        )

        // Register Cloud commands
        val commandManager = PaperCommandManager.builder(PaperSimpleSenderMapper.simpleSenderMapper())
            .executionCoordinator(ExecutionCoordinator.simpleCoordinator())
            .buildOnEnable(this)

        val annotationParser = AnnotationParser(
            commandManager,
            org.incendo.cloud.paper.util.sender.Source::class.java
        )
        annotationParser.parse(UniverseCloudCommands(api))

        // Register API
        Universe.register(api)

        logger.info("Universe plugin enabled for instance $instanceId (Folia)")
    }

    override fun onDisable() {
        if (::reporter.isInitialized) {
            reporter.reportState(gg.scala.universe.minecraft.api.InstanceState.OFFLINE)
        }
        heartbeatTask?.cancel()

        // Unregister API
        Universe.unregister()

        logger.info("Universe plugin disabled")
    }

    private fun resolveMasterUrl(): String {
        return System.getProperty("universe.master.url")
            ?: System.getenv("UNIVERSE_MASTER_URL")
            ?: config.getString("master-url", "http://localhost:6000")
            ?: "http://localhost:6000"
    }

    private fun resolveInstanceId(): String? {
        return System.getProperty("universe.instance.id")
            ?: System.getenv("UNIVERSE_INSTANCE_ID")
            ?: config.getString("instance-id")
    }

    private fun resolveApiKey(): String? {
        return System.getProperty("universe.api.key")
            ?: System.getenv("UNIVERSE_API_KEY")
            ?: config.getString("api-key")?.takeIf { it.isNotBlank() }
    }
}
