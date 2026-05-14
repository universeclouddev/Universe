package gg.scala.universe.metrics.prometheus

import com.google.inject.Inject
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.extension.Extension
import gg.scala.universe.metrics.MetricsProvider
import gg.scala.universe.metrics.MetricsRegistry
import io.micrometer.core.instrument.Gauge
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.Timer
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import io.micrometer.prometheusmetrics.PrometheusConfig
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry
import java.util.concurrent.ConcurrentHashMap

class PrometheusMetricsProvider : MetricsProvider {

    override val providerKey: String = "prometheus"

    private lateinit var registry: PrometheusMeterRegistry
    private val gauges = ConcurrentHashMap<String, Gauge>()

    override fun start() {
        registry = PrometheusMeterRegistry(PrometheusConfig.DEFAULT)
        // Bind JVM metrics
        io.micrometer.core.instrument.binder.jvm.JvmMemoryMetrics().bindTo(registry)
        io.micrometer.core.instrument.binder.jvm.JvmGcMetrics().bindTo(registry)
        io.micrometer.core.instrument.binder.jvm.JvmThreadMetrics().bindTo(registry)
        io.micrometer.core.instrument.binder.system.ProcessorMetrics().bindTo(registry)
        io.micrometer.core.instrument.binder.system.UptimeMetrics().bindTo(registry)
        log("Prometheus metrics provider started", LogLevel.SUCCESS)
    }

    override fun stop() {
        registry.close()
        log("Prometheus metrics provider stopped")
    }

    override fun scrape(): String {
        return registry.scrape()
    }

    override fun gauge(name: String, value: Double, tags: Map<String, String>) {
        val key = name + tags.entries.sortedBy { it.key }.joinToString(",") { "${it.key}=${it.value}" }
        val existing = gauges[key]
        if (existing != null) {
            // Micrometer gauges read from a supplier, so we need to wrap the value
            // For simplicity, we re-register. In production you'd use AtomicReference.
            registry.remove(existing)
        }
        val builder = Gauge.builder(name) { value }
        tags.forEach { (k, v) -> builder.tag(k, v) }
        gauges[key] = builder.register(registry)
    }

    override fun counter(name: String, amount: Double, tags: Map<String, String>) {
        val builder = io.micrometer.core.instrument.Counter.builder(name)
        tags.forEach { (k, v) -> builder.tag(k, v) }
        builder.register(registry).increment(amount)
    }

    override fun timer(name: String, durationMs: Long, tags: Map<String, String>) {
        val builder = Timer.builder(name)
        tags.forEach { (k, v) -> builder.tag(k, v) }
        builder.register(registry).record(java.time.Duration.ofMillis(durationMs))
    }

    fun getRegistry(): MeterRegistry = registry
}
