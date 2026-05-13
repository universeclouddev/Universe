package gg.scala.universe.minecraft.api

/**
 * Static entry point for accessing the Universe API from Minecraft plugins.
 *
 * ```java
 * // Java
 * UniverseAPI api = Universe.getAPI();
 * if (api != null) {
 *     api.getInstanceManager().getInstances().thenAccept(instances -> {
 *         instances.forEach(info -> System.out.println(info.getId()));
 *     });
 * }
 * ```
 *
 * ```kotlin
 * // Kotlin
 * val api = Universe.getAPI() ?: return
 * api.instanceManager.getInstances().thenAccept { instances ->
 *     instances.forEach { println(it.id) }
 * }
 * ```
 */
object Universe {

    @Volatile
    private var api: UniverseAPI? = null

    /**
     * Returns the registered Universe API instance, or null if the Universe plugin
     * is not loaded on this server.
     */
    @JvmStatic
    fun getAPI(): UniverseAPI? = api

    /**
     * Returns true if the Universe API is available.
     */
    @JvmStatic
    fun isAvailable(): Boolean = api != null

    /**
     * Internal method for Minecraft plugin implementations to register themselves.
     * Not intended for external use.
     */
    fun register(api: UniverseAPI) {
        this.api = api
    }

    /**
     * Internal method for Minecraft plugin implementations to unregister themselves.
     * Not intended for external use.
     */
    fun unregister() {
        this.api = null
    }
}
