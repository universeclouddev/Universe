package gg.scala.universe.db

import com.google.inject.Singleton
import java.util.concurrent.ConcurrentHashMap

/**
 * Guice-managed implementation of [DatabaseRegistry].
 *
 * Backed by a [ConcurrentHashMap] for thread-safe registration
 * and lookup of [DatabaseProvider] implementations.
 */
@Singleton
class DatabaseRegistryImpl : DatabaseRegistry {
    private val providers = ConcurrentHashMap<String, DatabaseProvider>()

    override fun register(key: String, provider: DatabaseProvider) {
        providers[key] = provider
    }

    override fun unregister(key: String) {
        providers.remove(key)
    }

    override fun get(key: String): DatabaseProvider? {
        return providers[key]
    }

    override fun getAll(): Map<String, DatabaseProvider> {
        return providers.toMap()
    }
}
