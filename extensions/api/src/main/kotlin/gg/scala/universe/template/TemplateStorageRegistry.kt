package gg.scala.universe.template

/**
 * Registry for [TemplateStorageProvider] implementations.
 *
 * Extensions receive this registry via Guice injection and call
 * [register] to expose their storage provider under a storage key.
 */
interface TemplateStorageRegistry {
    /**
     * Registers a [TemplateStorageProvider].
     *
     * @param provider The storage provider implementation.
     */
    fun register(provider: TemplateStorageProvider)

    /**
     * Retrieves the provider registered under the given key.
     *
     * @param key Storage identifier.
     * @return The associated [TemplateStorageProvider], or null if not found.
     */
    fun get(key: String): TemplateStorageProvider?

    /**
     * Unregisters the provider associated with the given key.
     *
     * @param key Storage identifier.
     */
    fun unregister(key: String)

    /**
     * Returns a snapshot of all registered providers.
     *
     * @return A map of storage keys to their [TemplateStorageProvider].
     */
    fun getAll(): Map<String, TemplateStorageProvider>
}
