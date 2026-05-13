package gg.scala.universe.app

import com.google.inject.Guice
import com.google.inject.Injector
import com.google.inject.Module
import com.hazelcast.core.HazelcastInstance
import gg.scala.universe.console.Console
import gg.scala.universe.console.log
import org.slf4j.LoggerFactory
import gg.scala.universe.api.ApiGuiceModule
import gg.scala.universe.api.KtorServerService
import gg.scala.universe.config.ConfigLoader
import gg.scala.universe.config.ConfigurationLoader
import gg.scala.universe.config.UniverseMainConfiguration
import gg.scala.universe.extension.ExtensionService
import gg.scala.universe.hz.ClusterStateService
import gg.scala.universe.hz.HazelcastService
import gg.scala.universe.hz.HzGuiceModule
import gg.scala.universe.hz.ResilienceMembershipListener
import gg.scala.universe.command.CommandBootstrap
import gg.scala.universe.console.LogLevel
import gg.scala.universe.runtime.RuntimeRegistry
import gg.scala.universe.runtime.ProcessRuntimeProvider
import gg.scala.universe.runtime.ScreenRuntimeProvider
import gg.scala.universe.runtime.TmuxRuntimeProvider
import gg.scala.universe.service.InstanceCountEnforcer
import gg.scala.universe.service.InstanceHealthMonitor
import gg.scala.universe.service.InstanceRecoveryService
import gg.scala.universe.service.NodeShutdownService

fun run() {
    log("Starting Universe")
    UniverseApplication()
}

class UniverseApplication {
    private val logger = LoggerFactory.getLogger(UniverseApplication::class.java)

    var mainConfiguration: UniverseMainConfiguration

    val injector: Injector
    val hzService: HazelcastService
    val extensionService: ExtensionService
    var commandBootstrap: CommandBootstrap

    init {
        instance = this
        mainConfiguration = ConfigLoader.load()

        Console.setDebug(mainConfiguration.debug)
        configureLogbackLevels(mainConfiguration.debug)

        injector = Guice.createInjector(guiceModules)

        hzService = HazelcastService()
        injector.injectMembers(hzService)
        hzService.start()

        // Register built-in runtime providers
        val runtimeRegistry = injector.getInstance(RuntimeRegistry::class.java)
        runtimeRegistry.register("tmux", TmuxRuntimeProvider())
        runtimeRegistry.register("screen", ScreenRuntimeProvider())
        runtimeRegistry.register("process", ProcessRuntimeProvider())
        log("Registered built-in runtime providers (tmux, screen, process)")

        // Start health monitor on every node (wrappers run instances too)
        val healthMonitor = injector.getInstance(InstanceHealthMonitor::class.java)
        healthMonitor.start()

        if (mainConfiguration.isMasterNode) {
            val clusterStateService = injector.getInstance(ClusterStateService::class.java)
            hzService.hzInstance.cluster.addMembershipListener(
                ResilienceMembershipListener(clusterStateService)
            )
            log("Registered MembershipListener for instance resilience")
            ConfigurationLoader.load(clusterStateService)
        }

        extensionService = ExtensionService()
        injector.injectMembers(extensionService)
        extensionService.installExtensions()
        extensionService.loadExtensions()

        // Recover instances that were running before restart
        val recoveryService = injector.getInstance(InstanceRecoveryService::class.java)
        recoveryService.recover()

        commandBootstrap = injector.getInstance(CommandBootstrap::class.java)
        commandBootstrap.start()

        Runtime.getRuntime().addShutdownHook(Thread({
            try {
                // Stop the console first so JLine terminal is closed cleanly
                // and stdout/stderr are restored to their originals.
                commandBootstrap.stop()

                // Use println directly to bypass JLine entirely during shutdown
                println("  \u001B[34m\u2192\u001B[0m Shutting down Universe...")

                // Stop background services first so they don't race with Hazelcast
                println("  \u001B[34m\u2192\u001B[0m Stopping background services...")
                val healthMonitor = injector.getInstance(InstanceHealthMonitor::class.java)
                healthMonitor.stop()

                if (mainConfiguration.isMasterNode) {
                    val enforcer = injector.getInstance(InstanceCountEnforcer::class.java)
                    enforcer.stop()
                    val ktorService = injector.getInstance(KtorServerService::class.java)
                    ktorService.stop()
                }

                // Stop local instances (needs Hazelcast)
                println("  \u001B[34m\u2192\u001B[0m Stopping local instances...")
                val nodeShutdownService = injector.getInstance(NodeShutdownService::class.java)
                nodeShutdownService.stopAllLocalInstances()

                // Shutdown Hazelcast last
                println("  \u001B[34m\u2192\u001B[0m Shutting down Hazelcast cluster...")
                try {
                    hzService.hzInstance.shutdown()
                } catch (_: com.hazelcast.core.HazelcastInstanceNotActiveException) {
                    // Already shut down
                }
                println("  \u001B[32m\u2713\u001B[0m Universe shutdown complete")
            } catch (e: Exception) {
                println("  \u001B[31m\u2717\u001B[0m Error during shutdown: ${e.message}")
                e.printStackTrace()
            }
        }, "universe-shutdown"))

        if (mainConfiguration.isMasterNode) {
            val ktorService = injector.getInstance(KtorServerService::class.java)
            ktorService.start()

            val enforcer = injector.getInstance(InstanceCountEnforcer::class.java)
            enforcer.start()
        }
    }

    companion object {
        @JvmField
        val guiceModules = mutableListOf<Module>(
            MainGuiceModule(), HzGuiceModule(), ApiGuiceModule()
        )

        lateinit var instance: UniverseApplication
    }
}

private fun configureLogbackLevels(debug: Boolean) {
    val loggerContext = LoggerFactory.getILoggerFactory() as? ch.qos.logback.classic.LoggerContext ?: return
    val root = loggerContext.getLogger(ch.qos.logback.classic.Logger.ROOT_LOGGER_NAME)
    val appLogger = loggerContext.getLogger("gg.scala.universe")

    val frameworkLoggers = listOf(
        "com.hazelcast",
        "io.fabric8.kubernetes",
        "com.github.dockerjava",
        "org.apache.http",
        "software.amazon.awssdk",
        "io.netty"
    )

    if (debug) {
        root.level = ch.qos.logback.classic.Level.INFO
        appLogger.level = ch.qos.logback.classic.Level.DEBUG
        frameworkLoggers.forEach { name ->
            loggerContext.getLogger(name)?.level = ch.qos.logback.classic.Level.INFO
        }
    } else {
        root.level = ch.qos.logback.classic.Level.WARN
        appLogger.level = ch.qos.logback.classic.Level.WARN
        frameworkLoggers.forEach { name ->
            loggerContext.getLogger(name)?.level = ch.qos.logback.classic.Level.WARN
        }
    }
}
