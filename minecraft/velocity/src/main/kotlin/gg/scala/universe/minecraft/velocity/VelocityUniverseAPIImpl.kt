package gg.scala.universe.minecraft.velocity

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import gg.scala.universe.minecraft.api.*
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.Optional
import java.util.concurrent.CompletableFuture
import org.slf4j.Logger

class VelocityUniverseAPIImpl(
    private val masterUrl: String,
    private val instanceId: String?,
    private val apiKey: String?,
    private val logger: Logger
) : UniverseAPI {

    private val client = HttpClient.newHttpClient()
    private val gson = Gson()

    private val _instanceManager = VelocityInstanceManager()
    private val _configurationManager = VelocityConfigurationManager()
    private val _templateManager = VelocityTemplateManager()

    override fun getMasterUrl(): String = masterUrl
    override fun getInstanceId(): String? = instanceId
    override fun isConnected(): Boolean = _instanceManager.isConnected()
    override fun getInstanceManager(): InstanceManager = _instanceManager
    override fun getConfigurationManager(): ConfigurationManager = _configurationManager
    override fun getTemplateManager(): TemplateManager = _templateManager

    inner class VelocityInstanceManager : InstanceManager {

        @Volatile
        private var connected = false

        fun isConnected(): Boolean = connected

        override fun startInstance(configurationName: String): CompletableFuture<String> {
            return CompletableFuture.supplyAsync {
                val url = "$masterUrl/api/instances"
                val body = gson.toJson(mapOf("configurationName" to configurationName))
                val response = sendRequest(url, "POST", body)
                connected = response != null && response.first in 200..299
                if (connected) {
                    val json = response!!.second
                    val map = gson.fromJson<Map<String, String>>(json, object : TypeToken<Map<String, String>>() {}.type)
                    map["id"] ?: throw RuntimeException("No instance ID returned")
                } else {
                    throw RuntimeException("Failed to start instance: ${response?.first}")
                }
            }
        }

        override fun startInstance(configuration: Configuration): CompletableFuture<String> {
            return CompletableFuture.supplyAsync {
                val url = "$masterUrl/api/instances"
                val body = gson.toJson(configuration)
                val response = sendRequest(url, "POST", body)
                connected = response != null && response.first in 200..299
                if (connected) {
                    val json = response!!.second
                    val map = gson.fromJson<Map<String, String>>(json, object : TypeToken<Map<String, String>>() {}.type)
                    map["id"] ?: throw RuntimeException("No instance ID returned")
                } else {
                    throw RuntimeException("Failed to start instance: ${response?.first}")
                }
            }
        }

        override fun stopInstance(instanceId: String): CompletableFuture<Void> {
            return CompletableFuture.runAsync {
                val url = "$masterUrl/api/instances/$instanceId/stop"
                val response = sendRequest(url, "POST", "")
                if (response == null || response.first !in 200..299) {
                    throw RuntimeException("Failed to stop instance: ${response?.first}")
                }
            }
        }

        override fun executeCommand(instanceId: String, command: String): CompletableFuture<Void> {
            return CompletableFuture.runAsync {
                val url = "$masterUrl/api/instances/$instanceId/command"
                val body = gson.toJson(mapOf("command" to command))
                val response = sendRequest(url, "POST", body)
                if (response == null || response.first !in 200..299) {
                    throw RuntimeException("Failed to execute command: ${response?.first}")
                }
            }
        }

        override fun getInstance(instanceId: String): CompletableFuture<Optional<InstanceInfo>> {
            return CompletableFuture.supplyAsync {
                val url = "$masterUrl/api/instances/$instanceId"
                val response = sendRequest(url, "GET", null)
                connected = response != null && response.first == 200
                if (response != null && response.first == 200) {
                    Optional.of(gson.fromJson(response.second, InstanceInfo::class.java))
                } else {
                    Optional.empty()
                }
            }
        }

        override fun getInstances(): CompletableFuture<List<InstanceInfo>> {
            return CompletableFuture.supplyAsync {
                val url = "$masterUrl/api/instances"
                val response = sendRequest(url, "GET", null)
                connected = response != null && response.first == 200
                if (response != null && response.first == 200) {
                    gson.fromJson<List<InstanceInfo>>(response.second, object : TypeToken<List<InstanceInfo>>() {}.type) ?: emptyList()
                } else {
                    emptyList()
                }
            }
        }

        override fun getInstancesByState(state: InstanceState): CompletableFuture<List<InstanceInfo>> {
            return getInstances().thenApply { instances ->
                instances.filter { it.state == state.name }
            }
        }

        override fun getInstanceState(instanceId: String): CompletableFuture<Optional<InstanceState>> {
            return getInstance(instanceId).thenApply { opt ->
                opt.map { info ->
                    try {
                        InstanceState.valueOf(info.state)
                    } catch (_: IllegalArgumentException) {
                        InstanceState.STOPPED
                    }
                }
            }
        }

        override fun reportState(state: InstanceState): CompletableFuture<Void> {
            return CompletableFuture.runAsync {
                if (instanceId == null) return@runAsync
                val url = "$masterUrl/api/instances/$instanceId/state"
                val body = gson.toJson(mapOf(
                    "state" to state.name,
                    "lastHeartbeat" to System.currentTimeMillis()
                ))
                val response = sendRequest(url, "PUT", body)
                connected = response != null && response.first in 200..299
            }
        }
    }

    inner class VelocityConfigurationManager : ConfigurationManager {

        override fun getConfigurations(): CompletableFuture<List<Configuration>> {
            return CompletableFuture.supplyAsync {
                val url = "$masterUrl/api/configurations"
                val response = sendRequest(url, "GET", null)
                if (response != null && response.first == 200) {
                    gson.fromJson<List<Configuration>>(response.second, object : TypeToken<List<Configuration>>() {}.type) ?: emptyList()
                } else {
                    emptyList()
                }
            }
        }

        override fun getConfiguration(name: String): CompletableFuture<Configuration?> {
            return CompletableFuture.supplyAsync {
                val url = "$masterUrl/api/configurations/$name"
                val response = sendRequest(url, "GET", null)
                if (response != null && response.first == 200) {
                    gson.fromJson(response.second, Configuration::class.java)
                } else {
                    null
                }
            }
        }

        override fun saveConfiguration(configuration: Configuration): CompletableFuture<Void> {
            return CompletableFuture.runAsync {
                val url = "$masterUrl/api/configurations/${configuration.name}"
                val body = gson.toJson(configuration)
                val response = sendRequest(url, "PUT", body)
                if (response == null || response.first !in 200..299) {
                    throw RuntimeException("Failed to save configuration: ${response?.first}")
                }
            }
        }

        override fun deleteConfiguration(name: String): CompletableFuture<Void> {
            return CompletableFuture.runAsync {
                val url = "$masterUrl/api/configurations/$name"
                val response = sendRequest(url, "DELETE", null)
                if (response == null || response.first !in 200..299) {
                    throw RuntimeException("Failed to delete configuration: ${response?.first}")
                }
            }
        }
    }

    inner class VelocityTemplateManager : TemplateManager {

        override fun getTemplates(): CompletableFuture<List<Template>> {
            return CompletableFuture.supplyAsync {
                val url = "$masterUrl/api/templates"
                val response = sendRequest(url, "GET", null)
                if (response != null && response.first == 200) {
                    gson.fromJson<List<Template>>(response.second, object : TypeToken<List<Template>>() {}.type) ?: emptyList()
                } else {
                    emptyList()
                }
            }
        }

        override fun getTemplatesByGroup(group: String): CompletableFuture<List<Template>> {
            return getTemplates().thenApply { templates ->
                templates.filter { it.group == group }
            }
        }

        override fun syncTemplates(): CompletableFuture<Void> {
            return CompletableFuture.runAsync {
                val url = "$masterUrl/api/templates/sync"
                val response = sendRequest(url, "POST", "")
                if (response == null || response.first !in 200..299) {
                    throw RuntimeException("Failed to sync templates: ${response?.first}")
                }
            }
        }
    }

    private fun sendRequest(url: String, method: String, body: String?): Pair<Int, String>? {
        return try {
            val requestBuilder = HttpRequest.newBuilder(URI.create(url))
                .header("Content-Type", "application/json")
                .apply {
                    if (!apiKey.isNullOrBlank()) {
                        header("Authorization", "Bearer $apiKey")
                    }
                }
                .timeout(java.time.Duration.ofSeconds(10))

            val request = when (method) {
                "POST" -> if (body != null) requestBuilder.POST(HttpRequest.BodyPublishers.ofString(body)).build() else requestBuilder.POST(HttpRequest.BodyPublishers.noBody()).build()
                "PUT" -> requestBuilder.PUT(HttpRequest.BodyPublishers.ofString(body ?: "")).build()
                "DELETE" -> requestBuilder.DELETE().build()
                else -> requestBuilder.GET().build()
            }

            val response = client.send(request, HttpResponse.BodyHandlers.ofString())
            Pair(response.statusCode(), response.body())
        } catch (e: Exception) {
            logger.warn("Universe API request failed: ${e.message}")
            null
        }
    }
}
