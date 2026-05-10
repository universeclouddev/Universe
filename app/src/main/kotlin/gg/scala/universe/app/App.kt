package gg.scala.universe.app

import com.google.inject.Guice
import com.google.inject.Injector
import com.google.inject.Module
import com.hazelcast.core.HazelcastInstance
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
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
import gg.scala.universe.runtime.RuntimeRegistry
import gg.scala.universe.runtime.ScreenRuntimeProvider
import gg.scala.universe.runtime.TmuxRuntimeProvider

fun run() {
    log("Starting Universe", LogType.INFORMATION)
    UniverseApplication()
}

class UniverseApplication {
    var mainConfiguration: UniverseMainConfiguration

    val injector: Injector
    val hzService: HazelcastService
    val extensionService: ExtensionService
    var commandBootstrap: CommandBootstrap

    init {
        instance = this
        mainConfiguration = ConfigLoader.load()

        injector = Guice.createInjector(guiceModules)

        hzService = HazelcastService()
        injector.injectMembers(hzService)
        hzService.start()

        // Register built-in runtime providers
        val runtimeRegistry = injector.getInstance(RuntimeRegistry::class.java)
        runtimeRegistry.register("tmux", TmuxRuntimeProvider())
        runtimeRegistry.register("screen", ScreenRuntimeProvider())
        log("Registered built-in runtime providers (tmux, screen)", LogType.INFORMATION)

        if (mainConfiguration.isMasterNode) {
            val clusterStateService = injector.getInstance(ClusterStateService::class.java)
            hzService.hzInstance.cluster.addMembershipListener(
                ResilienceMembershipListener(clusterStateService)
            )
            log("Registered MembershipListener for instance resilience", LogType.INFORMATION)
            ConfigurationLoader.load(clusterStateService)
        }

        extensionService = ExtensionService()
        injector.injectMembers(extensionService)
        extensionService.installExtensions()


        extensionService.loadExtensions()

        commandBootstrap = injector.getInstance(CommandBootstrap::class.java)
        commandBootstrap.start()

        Runtime.getRuntime().addShutdownHook(Thread({
            log("Shutting down Universe...", LogType.INFORMATION)
            commandBootstrap.stop()
            if (mainConfiguration.isMasterNode) {
                val ktorService = injector.getInstance(KtorServerService::class.java)
                ktorService.stop()
            }
            hzService.hzInstance.shutdown()
            log("Universe shutdown complete", LogType.INFORMATION)
        }, "universe-shutdown"))

        if (mainConfiguration.isMasterNode) {
            val ktorService = injector.getInstance(KtorServerService::class.java)
            ktorService.start()
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