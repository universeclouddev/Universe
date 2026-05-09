package gg.scala.universe.app

import com.google.inject.AbstractModule
import com.google.inject.Provides
import gg.scala.universe.config.UniverseMainConfiguration
import gg.scala.universe.extension.ExtensionService

class MainGuiceModule : AbstractModule() {
    override fun configure() {

    }

    @Provides
    fun application(): UniverseApplication {
        return UniverseApplication.instance
    }

    @Provides
    fun mainConfigurationProvider(): UniverseMainConfiguration {
        return UniverseApplication.instance.mainConfiguration
    }

    @Provides
    fun extensionService(): ExtensionService {
        return UniverseApplication.instance.extensionService
    }

}