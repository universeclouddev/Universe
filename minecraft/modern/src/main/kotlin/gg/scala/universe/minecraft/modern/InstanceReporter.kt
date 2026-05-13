package gg.scala.universe.minecraft.modern

import com.google.gson.Gson
import org.bukkit.Bukkit
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.logging.Logger

class InstanceReporter(
    private val masterUrl: String,
    private val instanceId: String,
    private val logger: Logger
) {
    private val client = HttpClient.newHttpClient()
    private val gson = Gson()

    @Volatile
    private var connected = false

    fun reportState(state: gg.scala.universe.minecraft.api.InstanceState) {
        val url = "$masterUrl/api/instances/$instanceId/state"
        val body = gson.toJson(mapOf(
            "state" to state.name,
            "lastHeartbeat" to System.currentTimeMillis()
        ))

        val success = sendRequestWithRetry(url, "PUT", body)
        connected = success
    }

    fun heartbeat() {
        val url = "$masterUrl/api/instances/$instanceId/state"
        val body = gson.toJson(mapOf(
            "state" to gg.scala.universe.minecraft.api.InstanceState.ONLINE.name,
            "lastHeartbeat" to System.currentTimeMillis(),
            "players" to Bukkit.getOnlinePlayers().size,
            "maxPlayers" to Bukkit.getMaxPlayers(),
            "tps" to getTPS()
        ))

        val success = sendRequestWithRetry(url, "PUT", body)
        connected = success
    }

    fun isConnected(): Boolean = connected

    fun fetchInstanceInfo(): gg.scala.universe.minecraft.api.InstanceInfo? {
        return try {
            val url = "$masterUrl/api/instances/$instanceId"
            val request = HttpRequest.newBuilder(URI.create(url))
                .GET()
                .timeout(java.time.Duration.ofSeconds(5))
                .build()
            val response = client.send(request, HttpResponse.BodyHandlers.ofString())
            if (response.statusCode() == 200) {
                gson.fromJson(response.body(), gg.scala.universe.minecraft.api.InstanceInfo::class.java)
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun sendRequestWithRetry(url: String, method: String, body: String, maxRetries: Int = 3): Boolean {
        for (attempt in 1..maxRetries) {
            try {
                val requestBuilder = HttpRequest.newBuilder(URI.create(url))
                    .header("Content-Type", "application/json")
                    .timeout(java.time.Duration.ofSeconds(10))

                val request = when (method) {
                    "PUT" -> requestBuilder.PUT(HttpRequest.BodyPublishers.ofString(body)).build()
                    "POST" -> requestBuilder.POST(HttpRequest.BodyPublishers.ofString(body)).build()
                    else -> requestBuilder.GET().build()
                }

                val response = client.send(request, HttpResponse.BodyHandlers.ofString())
                if (response.statusCode() in 200..299) {
                    if (attempt > 1) {
                        logger.info("Successfully contacted Universe master after $attempt attempts")
                    }
                    return true
                } else {
                    logger.warning("Universe API returned ${response.statusCode()}: ${response.body()}")
                }
            } catch (e: Exception) {
                if (attempt == maxRetries) {
                    logger.warning("Failed to contact Universe master at $url after $maxRetries attempts: ${e.message}")
                } else {
                    Thread.sleep(1000L * attempt) // Exponential backoff: 1s, 2s, 3s
                }
            }
        }
        return false
    }

    /**
     * Gets the server's TPS using Paper's API.
     * Falls back to 20.0 if unavailable.
     */
    private fun getTPS(): Double {
        return try {
            Bukkit.getTPS()[0]
        } catch (_: Exception) {
            20.0
        }
    }
}
