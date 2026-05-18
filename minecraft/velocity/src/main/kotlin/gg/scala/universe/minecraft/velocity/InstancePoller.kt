package gg.scala.universe.minecraft.velocity

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.velocitypowered.api.proxy.server.ServerInfo
import org.slf4j.Logger
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

class InstancePoller(
    private val masterUrl: String,
    private val apiKey: String?,
    private val registry: ServerRegistry,
    private val logger: Logger
) {
    private val client = HttpClient.newHttpClient()
    private val gson = Gson()
    private val scheduler: ScheduledExecutorService = Executors.newSingleThreadScheduledExecutor { r ->
        Thread(r, "universe-poller").apply { isDaemon = true }
    }

    @Volatile
    private var lastInstances: List<UniverseInstance> = emptyList()

    @Volatile
    private var connected = false

    fun start(intervalSeconds: Long) {
        scheduler.scheduleAtFixedRate(
            { poll() },
            0,
            intervalSeconds,
            TimeUnit.SECONDS
        )
    }

    fun stop() {
        scheduler.shutdown()
    }

    fun pollNow() {
        poll()
    }

    fun getLastInstances(): List<UniverseInstance> = lastInstances
    fun isConnected(): Boolean = connected

    /**
     * Returns online instances matching the given configuration name.
     */
    fun getInstancesByConfiguration(configurationName: String): List<UniverseInstance> {
        return lastInstances.filter {
            it.state == "ONLINE" && it.configurationName == configurationName
        }
    }

    private fun poll() {
        try {
            val url = "$masterUrl/api/instances"
            val request = HttpRequest.newBuilder(URI.create(url))
                .GET()
                .apply {
                    if (!apiKey.isNullOrBlank()) {
                        header("Authorization", "Bearer $apiKey")
                    }
                }
                .timeout(java.time.Duration.ofSeconds(10))
                .build()

            val response = client.send(request, HttpResponse.BodyHandlers.ofString())
            if (response.statusCode() != 200) {
                logger.warn("Universe API returned ${response.statusCode()}")
                connected = false
                return
            }

            val instances: List<UniverseInstance> = gson.fromJson(
                response.body(),
                object : TypeToken<List<UniverseInstance>>() {}.type
            )

            lastInstances = instances
            connected = true

            val onlineInstances = instances.filter { it.state == "ONLINE" }
            val onlineIds = onlineInstances.map { it.id }.toSet()
            val registered = registry.getRegisteredNames().toSet()

            // Register new online instances
            onlineInstances.forEach { instance ->
                if (instance.id !in registered) {
                    registry.register(instance.id, instance.hostAddress, instance.allocatedPort)
                }
            }

            // Unregister offline/stopped instances
            registered.forEach { name ->
                if (name !in onlineIds) {
                    registry.unregister(name)
                }
            }
        } catch (e: Exception) {
            connected = false
            logger.warn("Failed to poll Universe master: ${e.message}")
        }
    }

    data class UniverseInstance(
        val id: String,
        val configurationName: String,
        val hostAddress: String,
        val allocatedPort: Int,
        val state: String,
        val players: Int = 0,
        val maxPlayers: Int = 0
    )
}
