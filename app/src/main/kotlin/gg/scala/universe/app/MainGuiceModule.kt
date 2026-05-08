package gg.scala.universe.app

import com.google.inject.AbstractModule
import com.google.inject.Provides
import gg.scala.universe.config.UniverseMainConfiguration

class MainGuiceModule : AbstractModule() {
    override fun configure() {

    }

    @Provides
    fun mainConfigurationProvider(): UniverseMainConfiguration {
        return UniverseApplication.instance.mainConfiguration
    }

}