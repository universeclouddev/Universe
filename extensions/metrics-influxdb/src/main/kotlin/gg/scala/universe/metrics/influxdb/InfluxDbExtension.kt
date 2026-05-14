package gg.scala.universe.metrics.influxdb

import com.google.inject.Inject
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.extension.Extension
import gg.scala.universe.metrics.MetricsRegistry
import java.io.File

class InfluxDbExtension : Extension {

    override fun id(): String = "metrics-influxdb"
    override fun version(): String = "1.0.0"

    @Inject
    private lateinit var registry: MetricsRegistry

    private lateinit var provider: InfluxDbMetricsProvider

    override fun onLoad() {
        val config = loadConfig()
        provider = InfluxDbMetricsProvider(config)
        provider.start()
        registry.register(provider.providerKey, provider)
        log("InfluxDB metrics extension loaded (bucket=${config.bucket}, org=${config.org})", LogLevel.SUCCESS)
    }

    override fun onUnload() {
        registry.unregister(provider.providerKey)
        provider.stop()
        log("InfluxDB metrics extension unloaded")
    }

    override fun onReload() {
        onUnload()
        onLoad()
        log("InfluxDB metrics extension reloaded")
    }

    private fun loadConfig(): InfluxDbConfig {
        val file = File("./extensions/metrics-influxdb/config.json")
        return if (file.exists()) {
            com.google.gson.Gson().fromJson(file.readText(), InfluxDbConfig::class.java)
        } else {
            InfluxDbConfig()
        }
    }

    data class InfluxDbConfig(
        val url: String = "http://localhost:8086",
        val token: String = "",
        val org: String = "universe",
        val bucket: String = "metrics",
        val intervalSeconds: Int = 15
    )
}
