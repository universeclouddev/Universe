package gg.scala.universe.api

import com.google.inject.Inject
import com.hazelcast.core.HazelcastInstance
import gg.scala.universe.api.plugins.configureCors
import gg.scala.universe.api.plugins.configureDocumentation
import gg.scala.universe.api.plugins.configureExceptionCatcher
import gg.scala.universe.api.plugins.configureLoggingMessages
import gg.scala.universe.api.plugins.configureSecurity
import gg.scala.universe.api.routing.configureClusterRoutes
import gg.scala.universe.api.routing.configureCommandRoutes
import gg.scala.universe.api.routing.configureClusterRoutes
import gg.scala.universe.api.routing.configureConfigurationRoutes
import gg.scala.universe.api.routing.configureInstanceRoutes
import gg.scala.universe.api.routing.configureMetricsRoutes
import gg.scala.universe.api.routing.configureNodeRoutes
import gg.scala.universe.api.routing.configureTemplateRoutes
import gg.scala.universe.command.CommandProvider
import gg.scala.universe.config.UniverseMainConfiguration
import gg.scala.universe.console.log
import gg.scala.universe.db.DatabaseProvider
import gg.scala.universe.hz.ClusterStateService
import gg.scala.universe.hz.task.TaskDispatcher
import gg.scala.universe.metrics.MetricsRegistry
import gg.scala.universe.service.InstanceCreationService
import gg.scala.universe.template.TemplateManager
import gg.scala.universe.template.TemplateSyncService
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.netty.NettyApplicationEngine
import io.ktor.server.websocket.WebSockets
import io.ktor.server.websocket.pingPeriod
import io.ktor.server.websocket.timeout
import io.netty.util.internal.logging.InternalLoggerFactory
import io.netty.util.internal.logging.JdkLoggerFactory
import java.util.concurrent.TimeUnit
import java.util.logging.Level
import kotlin.time.Duration.Companion.seconds

class KtorServerService @Inject constructor(
    private val configuration: UniverseMainConfiguration,
    private val clusterStateService: ClusterStateService,
    private val hazelcastInstance: HazelcastInstance,
    private val taskDispatcher: TaskDispatcher,
    private val commandProvider: CommandProvider,
    private val instanceCreationService: InstanceCreationService,
    private val templateManager: TemplateManager,
    private val templateSyncService: TemplateSyncService,
    private val databaseProvider: DatabaseProvider,
    private val metricsRegistry: MetricsRegistry
) {
    private var server: io.ktor.server.engine.EmbeddedServer<NettyApplicationEngine, NettyApplicationEngine.Configuration>? = null

    fun start() {
        if (!configuration.isMasterNode) {
            log("Not a master node, skipping Ktor server startup")
            return
        }

        // Redirect Netty internal logging away from SLF4J to JDK logging,
        // then suppress Netty's noisy debug capability-check spam.
        InternalLoggerFactory.setDefaultFactory(JdkLoggerFactory.INSTANCE)
        java.util.logging.Logger.getLogger("io.netty").level = Level.WARNING

        log("Starting Ktor REST API on ${configuration.address}:${configuration.apiPort}")

        server = embeddedServer(
            Netty,
            port = configuration.apiPort,
            host = configuration.address,
            module = {
                configureServerModule(
                    configuration,
                    clusterStateService,
                    hazelcastInstance,
                    taskDispatcher,
                    commandProvider,
                    instanceCreationService,
                    templateManager,
                    templateSyncService,
                    databaseProvider,
                    metricsRegistry
                )
            }
        ).start(wait = false)

        log("Ktor REST API started")
    }

    fun stop() {
        server?.stop(3, 5, TimeUnit.SECONDS)
        log("Ktor REST API stopped")
    }
}

private fun Application.configureServerModule(
    configuration: UniverseMainConfiguration,
    clusterStateService: ClusterStateService,
    hazelcastInstance: HazelcastInstance,
    taskDispatcher: TaskDispatcher,
    commandProvider: CommandProvider,
    instanceCreationService: InstanceCreationService,
    templateManager: TemplateManager,
    templateSyncService: TemplateSyncService,
    databaseProvider: DatabaseProvider,
    metricsRegistry: MetricsRegistry
) {
    install(WebSockets) {
        pingPeriod = 15.seconds
        timeout = 15.seconds
        maxFrameSize = Long.MAX_VALUE
        masking = false
    }

    configureCors()
    configureSecurity(databaseProvider)
    configureLoggingMessages()
    configureSerialization()
    configureExceptionCatcher()
    configureDocumentation()

    configureCommandRoutes(commandProvider)
    configureInstanceRoutes(clusterStateService, hazelcastInstance, taskDispatcher, instanceCreationService)
    configureConfigurationRoutes(clusterStateService)
    configureClusterRoutes(clusterStateService, hazelcastInstance, taskDispatcher)
    configureNodeRoutes(configuration, hazelcastInstance, commandProvider)
    configureTemplateRoutes(clusterStateService, templateManager, templateSyncService)
    configureMetricsRoutes(metricsRegistry)
}
