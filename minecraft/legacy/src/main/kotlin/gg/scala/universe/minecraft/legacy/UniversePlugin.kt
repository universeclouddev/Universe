package gg.scala.universe.minecraft.legacy

import gg.scala.universe.minecraft.api.Universe
import gg.scala.universe.minecraft.api.UniverseAPI
import org.bukkit.plugin.java.JavaPlugin
import org.incendo.cloud.annotations.AnnotationParser
import org.incendo.cloud.execution.ExecutionCoordinator
import org.incendo.cloud.paper.LegacyPaperCommandManager

class UniversePlugin : JavaPlugin(), UniverseAPI {

    private lateinit var apiImpl: LegacyUniverseAPIImpl
    private lateinit var reporter: InstanceReporter
    private var heartbeatTaskId: Int = -1

    // ---- UniverseAPI delegation ----

    override fun getMasterUrl(): String = apiImpl.getMasterUrl()
    override fun getInstanceId(): String? = apiImpl.getInstanceId()
    override fun isConnected(): Boolean = apiImpl.isConnected()
    override fun getInstanceManager() = apiImpl.getInstanceManager()
    override fun getConfigurationManager() = apiImpl.getConfigurationManager()
    override fun getTemplateManager() = apiImpl.getTemplateManager()

    // ---- Plugin lifecycle ----

    override fun onEnable() {
        saveDefaultConfig()

        val masterUrl = resolveMasterUrl()
        val instanceId = resolveInstanceId()

        if (instanceId == null) {
            logger.warning("No Universe instance ID configured. Set universe.instance.id system property, UNIVERSE_INSTANCE_ID env var, or instance-id in config.yml")
            return
        }

        apiImpl = LegacyUniverseAPIImpl(masterUrl, instanceId, logger)
        reporter = InstanceReporter(masterUrl, instanceId, logger)

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
        annotationParser.parse(UniverseCloudCommands(this))

        // Register API
        Universe.register(this)

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
}
