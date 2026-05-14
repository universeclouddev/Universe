package gg.scala.universe.db

/**
 * Registry for [DatabaseProvider] implementations.
 *
 * Extensions receive this registry via Guice injection and call
 * [register] to expose their database provider under a provider key.
 */
interface DatabaseRegistry {
    /**
     * Registers a [DatabaseProvider] under the given key.
     *
     * @param key Provider identifier (e.g., "h2", "mysql", "mongodb").
     * @param provider The database provider implementation.
     */
    fun register(key: String, provider: DatabaseProvider)

    /**
     * Unregisters the provider associated with the given key.
     */
    fun unregister(key: String)

    /**
     * Retrieves the provider registered under the given key.
     */
    fun get(key: String): DatabaseProvider?

    /**
     * Returns a snapshot of all registered providers.
     */
    fun getAll(): Map<String, DatabaseProvider>
}
