package gg.scala.universe.minecraft.api

import java.util.concurrent.CompletableFuture

/**
 * Manager for Universe configuration operations.
 */
interface ConfigurationManager {

    /**
     * Lists all configurations.
     *
     * @return A future that completes with the list of configurations.
     */
    fun getConfigurations(): CompletableFuture<List<Configuration>>

    /**
     * Gets a configuration by name.
     *
     * @param name The configuration name.
     * @return A future that completes with the configuration, or null if not found.
     */
    fun getConfiguration(name: String): CompletableFuture<Configuration?>

    /**
     * Creates or updates a configuration.
     *
     * @param configuration The configuration to save.
     * @return A future that completes when the operation is done.
     */
    fun saveConfiguration(configuration: Configuration): CompletableFuture<Void>

    /**
     * Deletes a configuration.
     *
     * @param name The configuration name.
     * @return A future that completes when the operation is done.
     */
    fun deleteConfiguration(name: String): CompletableFuture<Void>
}
