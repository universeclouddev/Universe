package gg.scala.universe.minecraft.legacy

import gg.scala.universe.minecraft.api.Universe
import org.bukkit.plugin.java.JavaPlugin
import org.incendo.cloud.annotations.AnnotationParser
import org.incendo.cloud.execution.ExecutionCoordinator
import org.incendo.cloud.paper.LegacyPaperCommandManager

class UniversePlugin : JavaPlugin() {

    private lateinit var api: LegacyUniverseAPIImpl
    private lateinit var reporter: InstanceReporter
    private var heartbeatTaskId: Int = -1

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

        api = LegacyUniverseAPIImpl(masterUrl, instanceId, apiKey, logger)
        reporter = InstanceReporter(masterUrl, instanceId, apiKey, logger)

        // Report ONLINE state
        reporter.reportState("ONLINE")

        // Start heartbeat
        val interval = config.getLong("heartbeat-interval-seconds", 30)
        heartbeatTaskId = server.scheduler.runTaskTimerAsynchronously(
            this,
            Runnable { reporter.heartbeat() },
            interval * 20,
            interval * 20
        ).taskId

        // Register Cloud commands
        val commandManager = LegacyPaperCommandManager.createNative(
            this,
            ExecutionCoordinator.simpleCoordinator()
        )

        val annotationParser = AnnotationParser(
            commandManager,
            org.bukkit.command.CommandSender::class.java
        )
        annotationParser.parse(UniverseCloudCommands(api))

        // Register API
        Universe.register(api)

        logger.info("Universe plugin enabled for instance $instanceId")
    }

    override fun onDisable() {
        if (::reporter.isInitialized) {
            reporter.reportState("OFFLINE")
        }
        if (heartbeatTaskId != -1) {
            server.scheduler.cancelTask(heartbeatTaskId)
        }

        // Unregister API
        Universe.unregister()

        logger.info("Universe plugin disabled")
    }

    private fun resolveMasterUrl(): String {
        return System.getProperty("universe.master.url")
            ?: System.getenv("UNIVERSE_MASTER_URL")
            ?: config.getString("master-url")
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
