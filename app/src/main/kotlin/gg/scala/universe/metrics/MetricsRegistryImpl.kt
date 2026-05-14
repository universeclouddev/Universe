package gg.scala.universe.metrics

import com.google.inject.Singleton
import java.util.concurrent.ConcurrentHashMap

/**
 * Guice-managed implementation of [MetricsRegistry].
 */
@Singleton
class MetricsRegistryImpl : MetricsRegistry {
    private val providers = ConcurrentHashMap<String, MetricsProvider>()

    override fun register(key: String, provider: MetricsProvider) {
        providers[key] = provider
    }

    override fun unregister(key: String) {
        providers.remove(key)
    }

    override fun get(key: String): MetricsProvider? {
        return providers[key]
    }

    override fun getAll(): Map<String, MetricsProvider> {
        return providers.toMap()
    }
}
