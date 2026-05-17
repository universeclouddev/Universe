package gg.scala.universe.hz

import com.google.inject.AbstractModule
import com.google.inject.Provides
import com.google.inject.Singleton
import com.hazelcast.core.HazelcastInstance
import gg.scala.universe.app.UniverseApplication
import gg.scala.universe.config.UniverseMainConfiguration

class HzGuiceModule : AbstractModule() {
    @Provides
    @Singleton
    fun hzService(configuration: UniverseMainConfiguration): HazelcastService {
        val service = HazelcastService()
        service.configuration = configuration
        service.start()
        return service
    }

    @Provides
    @Singleton
    fun hazelcastInstance(service: HazelcastService): HazelcastInstance {
        return service.hzInstance
    }
}