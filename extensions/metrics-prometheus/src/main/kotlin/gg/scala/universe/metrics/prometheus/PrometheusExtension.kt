package gg.scala.universe.metrics.prometheus

import com.google.inject.Inject
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.extension.Extension
import gg.scala.universe.metrics.MetricsRegistry

class PrometheusExtension : Extension {

    override fun id(): String = "metrics-prometheus"
    override fun version(): String = "1.0.0"

    @Inject
    private lateinit var registry: MetricsRegistry

    private lateinit var provider: PrometheusMetricsProvider

    override fun onLoad() {
        provider = PrometheusMetricsProvider()
        provider.start()
        registry.register(provider.providerKey, provider)
        log("Prometheus metrics extension loaded", LogLevel.SUCCESS)
    }

    override fun onUnload() {
        registry.unregister(provider.providerKey)
        provider.stop()
        log("Prometheus metrics extension unloaded")
    }

    override fun onReload() {
        onUnload()
        onLoad()
        log("Prometheus metrics extension reloaded")
    }
}
