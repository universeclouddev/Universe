package gg.scala.universe.minecraft.bungee

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.logging.Logger

class BungeeInstancePoller(
    private val masterUrl: String,
    private val serverRegistry: BungeeServerRegistry,
    private val logger: Logger
) {
    private val client = HttpClient.newHttpClient()
    private val gson = Gson()
    private var pollTask: ScheduledFuture<*>? = null

    @Volatile
    private var running = false

    fun start(intervalSeconds: Long, scheduler: ScheduledExecutorService) {
        if (running) return
        running = true

        pollTask = scheduler.scheduleAtFixedRate(
            { pollInstances() },
            0,
            intervalSeconds,
            TimeUnit.SECONDS
        )

        logger.info("Started Universe instance polling (every ${intervalSeconds}s)")
    }

    fun stop() {
        running = false
        pollTask?.cancel(false)
        pollTask = null
    }

    private fun pollInstances() {
        try {
            val url = "$masterUrl/api/instances"
            val request = HttpRequest.newBuilder(URI.create(url))
                .GET()
                .timeout(java.time.Duration.ofSeconds(5))
                .build()

            val response = client.send(request, HttpResponse.BodyHandlers.ofString())
            if (response.statusCode() != 200) {
                logger.warning("Failed to poll instances: HTTP ${response.statusCode()}")
                return
            }

            val instances = gson.fromJson<List<BungeeInstance>>(
                response.body(),
                object : TypeToken<List<BungeeInstance>>() {}.type
            )

            val onlineInstances = instances.filter { it.state == "ONLINE" }
            val currentRegistered = serverRegistry.getRegisteredServers().keys.toMutableSet()
            val desiredServers = mutableSetOf<String>()

            for (instance in onlineInstances) {
                val serverName = instance.configurationName
                desiredServers.add(serverName)

                if (!currentRegistered.contains(serverName)) {
                    serverRegistry.register(
                        serverName,
                        instance.hostAddress,
                        instance.allocatedPort
                    )
                }
            }

            // Unregister servers that are no longer online
            for (registeredName in currentRegistered) {
                if (!desiredServers.contains(registeredName)) {
                    serverRegistry.unregister(registeredName)
                }
            }

        } catch (e: Exception) {
            logger.warning("Error polling Universe instances: ${e.message}")
        }
    }

    data class BungeeInstance(
        val id: String,
        val configurationName: String,
        val state: String,
        val hostAddress: String,
        val allocatedPort: Int,
        val players: Int = 0,
        val maxPlayers: Int = 0
    )
}
