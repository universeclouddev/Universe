package gg.scala.universe.app

import com.google.inject.Guice
import com.google.inject.Injector
import com.google.inject.Module
import com.hazelcast.core.HazelcastInstance
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import gg.scala.universe.config.UniverseMainConfiguration
import gg.scala.universe.hz.HazelcastService
import gg.scala.universe.hz.HzGuiceModule

fun run() {
    log("Starting Universe", LogType.INFORMATION)
    UniverseApplication()
}

class UniverseApplication {
    lateinit var mainConfiguration: UniverseMainConfiguration

    val injector: Injector
    val hzService: HazelcastService

    init {
        instance = this
        mainConfiguration = UniverseMainConfiguration() //todo: load from file

        injector = Guice.createInjector(guiceModules)

        hzService = HazelcastService()
        injector.injectMembers(hzService)
        hzService.start()
    }

    companion object {
        @JvmField
        val guiceModules = mutableListOf<Module>(
            MainGuiceModule(), HzGuiceModule()
        )

        lateinit var instance: UniverseApplication
    }
}