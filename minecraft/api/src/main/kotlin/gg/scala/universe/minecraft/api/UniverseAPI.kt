package gg.scala.universe.minecraft.api

import java.util.concurrent.CompletableFuture

/**
 * Main Universe API interface exposed by Minecraft plugins.
 *
 * Provides access to cluster management operations through manager interfaces.
 * All operations are asynchronous and return [CompletableFuture].
 */
interface UniverseAPI {

    /** The URL of the Universe Master REST API. */
    fun getMasterUrl(): String

    /** The instance ID of this server, if running as a Universe instance. */
    fun getInstanceId(): String?

    /** Whether this plugin is currently connected to the Universe master. */
    fun isConnected(): Boolean

    /** Manager for instance lifecycle operations (start, stop, execute commands). */
    fun getInstanceManager(): InstanceManager

    /** Manager for configuration operations (list, get, create configurations). */
    fun getConfigurationManager(): ConfigurationManager

    /** Manager for template operations (list, sync templates). */
    fun getTemplateManager(): TemplateManager
}
