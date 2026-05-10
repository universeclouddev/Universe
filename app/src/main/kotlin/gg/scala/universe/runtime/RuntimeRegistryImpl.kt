package gg.scala.universe.runtime

import com.google.inject.Singleton
import java.util.concurrent.ConcurrentHashMap

/**
 * Guice-managed implementation of [RuntimeRegistry].
 *
 * Backed by a [ConcurrentHashMap] for thread-safe registration
 * and lookup of [RuntimeProvider] implementations.
 */
@Singleton
class RuntimeRegistryImpl : RuntimeRegistry {
    private val providers = ConcurrentHashMap<String, RuntimeProvider>()

    override fun register(key: String, provider: RuntimeProvider) {
        providers[key] = provider
    }

    override fun unregister(key: String) {
        providers.remove(key)
    }

    override fun get(key: String): RuntimeProvider? {
        return providers[key]
    }

    override fun getAll(): Map<String, RuntimeProvider> {
        return providers.toMap()
    }
}
