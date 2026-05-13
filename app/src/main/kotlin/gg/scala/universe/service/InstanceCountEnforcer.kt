package gg.scala.universe.service

import com.google.inject.Inject
import com.google.inject.Singleton
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.config.UniverseMainConfiguration
import gg.scala.universe.hz.ClusterStateService
import gg.scala.universe.schema.InstanceState
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Automatically enforces [Configuration.minimumServiceCount] by spawning
 * new instances when the running count drops below the configured minimum.
 *
 * Runs on the master node every 5 seconds. Uses a single-threaded executor
 * to avoid race conditions. Static configurations are ignored.
 */
@Singleton
class InstanceCountEnforcer @Inject constructor(
    private val clusterStateService: ClusterStateService,
    private val instanceCreationService: InstanceCreationService,
    private val configuration: UniverseMainConfiguration
) {
    private val executor = Executors.newSingleThreadScheduledExecutor { r ->
        Thread(r, "universe-instance-enforcer").apply { isDaemon = true }
    }

    fun start() {
        if (!configuration.isMasterNode) {
            log("InstanceCountEnforcer disabled on non-master node", LogLevel.INFO)
            return
        }

        executor.scheduleAtFixedRate(
            ::enforce,
            5,   // initial delay
            5,   // period
            TimeUnit.SECONDS
        )
        log("InstanceCountEnforcer started (interval=5s)", LogLevel.INFO)
    }

    fun stop() {
        executor.shutdown()
        try {
            if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
                executor.shutdownNow()
            }
        } catch (_: InterruptedException) {
            executor.shutdownNow()
        }
    }

    private fun enforce() {
        try {
            val configs = clusterStateService.configurations.values
            val allInstances = clusterStateService.getAllInstances()

            for (config in configs) {
                if (config.static) continue
                if (config.minimumServiceCount <= 0) continue

                val activeCount = allInstances.count {
                    it.configurationName == config.name &&
                    (it.state == InstanceState.ONLINE || it.state == InstanceState.CREATING)
                }

                val deficit = config.minimumServiceCount - activeCount
                if (deficit <= 0) continue

                log(
                    "Config '${config.name}' has $activeCount active instance(s), " +
                    "minimum=${config.minimumServiceCount}. Spawning $deficit...",
                    LogLevel.WARNING
                )

                repeat(deficit) { i ->
                    val instanceInfo = instanceCreationService.createInstance(config)
                    if (instanceInfo == null) {
                        log(
                            "Failed to spawn instance #$i for config '${config.name}': no node has enough resources.",
                            LogLevel.WARNING
                        )
                        return@repeat
                    }
                    log(
                        "Auto-spawned instance ${instanceInfo.id} for config '${config.name}' on node ${instanceInfo.wrapperNodeId}",
                        LogLevel.SUCCESS
                    )
                }
            }
        } catch (e: Exception) {
            log("InstanceCountEnforcer encountered an error: ${e.message}", LogLevel.ERROR)
        }
    }
}
