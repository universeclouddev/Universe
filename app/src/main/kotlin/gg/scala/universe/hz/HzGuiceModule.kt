package gg.scala.universe.hz

import com.google.inject.AbstractModule
import com.google.inject.Provides
import com.hazelcast.core.HazelcastInstance
import gg.scala.universe.app.UniverseApplication

class HzGuiceModule : AbstractModule() {
    @Provides
    fun hazelcastInstance(): HazelcastInstance = UniverseApplication.instance.hzService.hzInstance

    @Provides
    fun hzService(): HazelcastService = UniverseApplication.instance.hzService
}