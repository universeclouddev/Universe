package gg.scala.universe.minecraft.legacy

import com.google.gson.Gson
import org.bukkit.Bukkit
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.logging.Logger

class InstanceReporter(
    private val masterUrl: String,
    private val instanceId: String,
    private val logger: Logger
) {
    private val gson = Gson()

    @Volatile
    private var connected = false

    fun reportState(state: String) {
        val url = "$masterUrl/api/instances/$instanceId/state"
        val body = gson.toJson(mapOf(
            "state" to state,
            "lastHeartbeat" to System.currentTimeMillis()
        ))

        val success = sendRequestWithRetry(url, "PUT", body)
        connected = success
    }

    fun heartbeat() {
        val url = "$masterUrl/api/instances/$instanceId/state"
        val body = gson.toJson(mapOf(
            "state" to "ONLINE",
            "lastHeartbeat" to System.currentTimeMillis(),
            "players" to Bukkit.getOnlinePlayers().size,
            "maxPlayers" to Bukkit.getMaxPlayers()
        ))

        val success = sendRequestWithRetry(url, "PUT", body)
        connected = success
    }

    fun isConnected(): Boolean = connected

    fun fetchInstanceInfo(): gg.scala.universe.minecraft.api.InstanceInfo? {
        return try {
            val url = URL("$masterUrl/api/instances/$instanceId")
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.connectTimeout = 5000
            connection.readTimeout = 5000
            val responseCode = connection.responseCode
            val responseBody = connection.inputStream.bufferedReader().use { it.readText() }
            connection.disconnect()

            if (responseCode == 200) {
                gson.fromJson(responseBody, gg.scala.universe.minecraft.api.InstanceInfo::class.java)
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
                val connection = URL(url).openConnection() as HttpURLConnection
                connection.requestMethod = method
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.connectTimeout = 10000
                connection.readTimeout = 10000

                OutputStreamWriter(connection.outputStream).use { writer ->
                    writer.write(body)
                    writer.flush()
                }

                val responseCode = connection.responseCode
                connection.disconnect()

                if (responseCode in 200..299) {
                    if (attempt > 1) {
                        logger.info("Successfully contacted Universe master after $attempt attempts")
                    }
                    return true
                } else {
                    logger.warning("Universe API returned $responseCode")
                }
            } catch (e: Exception) {
                if (attempt == maxRetries) {
                    logger.warning("Failed to contact Universe master at $url after $maxRetries attempts: ${e.message}")
                } else {
                    Thread.sleep(1000L * attempt)
                }
            }
        }
        return false
    }
}
