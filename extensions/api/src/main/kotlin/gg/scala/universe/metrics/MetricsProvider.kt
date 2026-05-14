package gg.scala.universe.metrics

/**
 * Abstraction for metrics backends.
 *
 * Extensions register their implementation via [MetricsRegistry].
 * The core app exposes a single `/api/metrics` endpoint that delegates
 * to the active provider.
 */
interface MetricsProvider {
    /** Unique provider key, e.g. "prometheus", "influxdb". */
    val providerKey: String

    /** Start the metrics provider (bind meters, start reporters, etc.). */
    fun start()

    /** Stop the metrics provider (flush data, close connections). */
    fun stop()

    /**
     * Scrape current metrics in the format native to this provider.
     *
     * @return Prometheus text format, JSON, or other representation.
     */
    fun scrape(): String

    /** Record a gauge value. */
    fun gauge(name: String, value: Double, tags: Map<String, String> = emptyMap())

    /** Increment a counter. */
    fun counter(name: String, amount: Double = 1.0, tags: Map<String, String> = emptyMap())

    /** Record a timing in milliseconds. */
    fun timer(name: String, durationMs: Long, tags: Map<String, String> = emptyMap())
}
