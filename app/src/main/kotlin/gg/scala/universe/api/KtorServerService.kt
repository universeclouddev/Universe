package gg.scala.universe.api

import com.google.inject.Inject
import com.hazelcast.core.HazelcastInstance
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import gg.scala.universe.api.plugins.configureCors
import gg.scala.universe.api.plugins.configureExceptionCatcher
import gg.scala.universe.api.plugins.configureLoggingMessages
import gg.scala.universe.api.plugins.configureSecurity
import gg.scala.universe.api.routing.configureInstanceRoutes
import gg.scala.universe.config.UniverseMainConfiguration
import gg.scala.universe.hz.ClusterStateService
import gg.scala.universe.hz.task.TaskDispatcher
import io.ktor.server.application.Application
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.netty.NettyApplicationEngine
import java.util.concurrent.TimeUnit

class KtorServerService @Inject constructor(
    private val configuration: UniverseMainConfiguration,
    private val clusterStateService: ClusterStateService,
    private val hazelcastInstance: HazelcastInstance,
    private val taskDispatcher: TaskDispatcher
) {
    private var server: io.ktor.server.engine.EmbeddedServer<NettyApplicationEngine, NettyApplicationEngine.Configuration>? = null

    fun start() {
        if (!configuration.isMasterNode) {
            log("Not a master node, skipping Ktor server startup", LogType.INFORMATION)
            return
        }

        log("Starting Ktor REST API on ${configuration.address}:${configuration.apiPort}...", LogType.INFORMATION)

        server = embeddedServer(
            Netty,
            port = configuration.apiPort,
            host = configuration.address,
            module = {
                configureServerModule(clusterStateService, hazelcastInstance, taskDispatcher)
            }
        ).start(wait = false)

        log("Ktor REST API started", LogType.SUCCESS)
    }

    fun stop() {
        server?.stop(3, 5, TimeUnit.SECONDS)
        log("Ktor REST API stopped", LogType.INFORMATION)
    }
}

private fun Application.configureServerModule(
    clusterStateService: ClusterStateService,
    hazelcastInstance: HazelcastInstance,
    taskDispatcher: TaskDispatcher
) {
    configureCors()
    configureSecurity()
    configureLoggingMessages()
    configureSerialization()
    configureExceptionCatcher()
    configureInstanceRoutes(clusterStateService, hazelcastInstance, taskDispatcher)
}
