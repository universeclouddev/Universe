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

fun run() {
    log("Starting Universe", LogType.INFORMATION)
    UniverseApplication()
}

class UniverseApplication {
    lateinit var mainConfiguration: UniverseMainConfiguration

    val injector: Injector
    val hzService: HazelcastService
    val extensionService: ExtensionService

    init {
        instance = this
        mainConfiguration = ConfigLoader.load()

        injector = Guice.createInjector(guiceModules)

        hzService = HazelcastService()
        injector.injectMembers(hzService)
        hzService.start()

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