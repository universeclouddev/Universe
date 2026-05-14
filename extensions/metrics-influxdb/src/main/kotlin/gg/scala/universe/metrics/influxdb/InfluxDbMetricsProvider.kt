package gg.scala.universe.metrics.influxdb

import com.influxdb.client.InfluxDBClient
import com.influxdb.client.InfluxDBClientFactory
import com.influxdb.client.WriteApiBlocking
import com.influxdb.client.domain.WritePrecision
import com.influxdb.client.write.Point
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.metrics.MetricsProvider
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.binder.jvm.JvmGcMetrics
import io.micrometer.core.instrument.binder.jvm.JvmMemoryMetrics
import io.micrometer.core.instrument.binder.jvm.JvmThreadMetrics
import io.micrometer.core.instrument.binder.system.ProcessorMetrics
import io.micrometer.core.instrument.binder.system.UptimeMetrics
import io.micrometer.influx.InfluxConfig
import io.micrometer.influx.InfluxMeterRegistry
import java.time.Duration
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class InfluxDbMetricsProvider(
    private val config: InfluxDbExtension.InfluxDbConfig
) : MetricsProvider {

    override val providerKey: String = "influxdb"

    private var influxDBClient: InfluxDBClient? = null
    private var writeApi: WriteApiBlocking? = null
    private var micrometerRegistry: MeterRegistry? = null
    private val scheduledExecutor = Executors.newSingleThreadScheduledExecutor { r ->
        Thread(r, "universe-influxdb-metrics").apply { isDaemon = true }
    }

    // Local cache of gauge values for non-Micrometer reporting
    private val gaugeValues = ConcurrentHashMap<String, Double>()

    override fun start() {
        // Create InfluxDB client for direct Point writing
        influxDBClient = InfluxDBClientFactory.create(config.url, config.token.toCharArray(), config.org, config.bucket)
        writeApi = influxDBClient!!.writeApiBlocking

        // Create Micrometer registry for JVM metrics
        val influxConfig = object : InfluxConfig {
            override fun get(k: String): String? = null
            override fun uri(): String = config.url
            override fun token(): String = config.token
            override fun org(): String = config.org
            override fun bucket(): String = config.bucket
            override fun step(): Duration = Duration.ofSeconds(config.intervalSeconds.toLong())
        }
        micrometerRegistry = InfluxMeterRegistry.builder(influxConfig).build()

        // Bind JVM metrics
        val reg = micrometerRegistry!!
        JvmMemoryMetrics().bindTo(reg)
        JvmGcMetrics().bindTo(reg)
        JvmThreadMetrics().bindTo(reg)
        ProcessorMetrics().bindTo(reg)
        UptimeMetrics().bindTo(reg)

        log("InfluxDB metrics provider started (url=${config.url}, bucket=${config.bucket})", LogLevel.SUCCESS)
    }

    override fun stop() {
        scheduledExecutor.shutdown()
        try {
            if (!scheduledExecutor.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduledExecutor.shutdownNow()
            }
        } catch (_: InterruptedException) {
            scheduledExecutor.shutdownNow()
        }
        influxDBClient?.close()
        log("InfluxDB metrics provider stopped")
    }

    override fun scrape(): String {
        // Return a summary of cached gauge values
        return buildString {
            appendLine("# InfluxDB metrics provider (push-based)")
            appendLine("# Points cached for flush: ${gaugeValues.size}")
            gaugeValues.forEach { (key, value) ->
                appendLine("$key $value")
            }
        }
    }

    override fun gauge(name: String, value: Double, tags: Map<String, String>) {
        val key = name + tags.entries.sortedBy { it.key }.joinToString(",") { "${it.key}=${it.value}" }
        gaugeValues[key] = value

        // Write immediately as a Point
        val point = Point.measurement(name).addField("value", value)
        tags.forEach { (k, v) -> point.addTag(k, v) }
        point.time(System.currentTimeMillis(), WritePrecision.MS)

        try {
            writeApi?.writePoint(point)
        } catch (e: Exception) {
            log("Failed to write gauge to InfluxDB: ${e.message}", LogLevel.WARNING)
        }
    }

    override fun counter(name: String, amount: Double, tags: Map<String, String>) {
        val point = Point.measurement(name).addField("count", amount)
        tags.forEach { (k, v) -> point.addTag(k, v) }
        point.time(System.currentTimeMillis(), WritePrecision.MS)

        try {
            writeApi?.writePoint(point)
        } catch (e: Exception) {
            log("Failed to write counter to InfluxDB: ${e.message}", LogLevel.WARNING)
        }
    }

    override fun timer(name: String, durationMs: Long, tags: Map<String, String>) {
        val point = Point.measurement(name)
            .addField("duration_ms", durationMs.toDouble())
            .addField("duration_sec", durationMs / 1000.0)
        tags.forEach { (k, v) -> point.addTag(k, v) }
        point.time(System.currentTimeMillis(), WritePrecision.MS)

        try {
            writeApi?.writePoint(point)
        } catch (e: Exception) {
            log("Failed to write timer to InfluxDB: ${e.message}", LogLevel.WARNING)
        }
    }
}
