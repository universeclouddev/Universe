package gg.scala.universe.metrics

/**
 * Registry for [MetricsProvider] implementations.
 *
 * Extensions receive this registry via Guice injection and call
 * [register] to expose their metrics provider under a provider key.
 */
interface MetricsRegistry {
    /**
     * Registers a [MetricsProvider] under the given key.
     *
     * @param key Provider identifier (e.g., "prometheus", "influxdb").
     * @param provider The metrics provider implementation.
     */
    fun register(key: String, provider: MetricsProvider)

    /**
     * Unregisters the provider associated with the given key.
     */
    fun unregister(key: String)

    /**
     * Retrieves the provider registered under the given key.
     */
    fun get(key: String): MetricsProvider?

    /**
     * Returns a snapshot of all registered providers.
     */
    fun getAll(): Map<String, MetricsProvider>
}
