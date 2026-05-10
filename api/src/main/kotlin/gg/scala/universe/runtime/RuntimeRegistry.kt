package gg.scala.universe.runtime

/**
 * Registry for [RuntimeProvider] implementations.
 *
 * Extensions receive this registry via Guice injection and call
 * [register] to expose their runtime provider under a technology key.
 */
interface RuntimeRegistry {
    /**
     * Registers a [RuntimeProvider] under the given key.
     *
     * @param key Technology identifier (e.g., "docker", "tmux", "screen").
     * @param provider The runtime provider implementation.
     */
    fun register(key: String, provider: RuntimeProvider)

    /**
     * Unregisters the provider associated with the given key.
     *
     * @param key Technology identifier.
     */
    fun unregister(key: String)

    /**
     * Retrieves the provider registered under the given key.
     *
     * @param key Technology identifier.
     * @return The associated [RuntimeProvider], or null if not found.
     */
    fun get(key: String): RuntimeProvider?

    /**
     * Returns a snapshot of all registered providers.
     *
     * @return A map of technology keys to their [RuntimeProvider].
     */
    fun getAll(): Map<String, RuntimeProvider>
}
