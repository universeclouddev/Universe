package gg.scala.universe.template

import com.google.inject.Singleton
import java.util.concurrent.ConcurrentHashMap

/**
 * Guice-managed implementation of [TemplateStorageRegistry].
 */
@Singleton
class TemplateStorageRegistryImpl : TemplateStorageRegistry {
    private val providers = ConcurrentHashMap<String, TemplateStorageProvider>()

    override fun register(provider: TemplateStorageProvider) {
        providers[provider.storageKey] = provider
    }

    override fun get(key: String): TemplateStorageProvider? {
        return providers[key]
    }

    override fun unregister(key: String) {
        providers.remove(key)
    }

    override fun getAll(): Map<String, TemplateStorageProvider> {
        return providers.toMap()
    }
}
