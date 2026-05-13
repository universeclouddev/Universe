package gg.scala.universe.minecraft.api

import java.util.Optional
import java.util.concurrent.CompletableFuture

/**
 * Manager for Universe instance lifecycle operations.
 *
 * All methods communicate with the Universe master via REST API.
 */
interface InstanceManager {

    /**
     * Starts a new instance with the given configuration.
     *
     * @param configurationName Name of the configuration to use.
     * @return A future that completes with the new instance ID.
     */
    fun startInstance(configurationName: String): CompletableFuture<String>

    /**
     * Starts a new instance with a custom configuration.
     *
     * @param configuration The configuration to use.
     * @return A future that completes with the new instance ID.
     */
    fun startInstance(configuration: Configuration): CompletableFuture<String>

    /**
     * Stops the instance with the given ID.
     *
     * @param instanceId The instance ID to stop.
     * @return A future that completes when the stop request is acknowledged.
     */
    fun stopInstance(instanceId: String): CompletableFuture<Void>

    /**
     * Executes a command on the given instance.
     *
     * @param instanceId The instance ID.
     * @param command The command to execute.
     * @return A future that completes when the command is sent.
     */
    fun executeCommand(instanceId: String, command: String): CompletableFuture<Void>

    /**
     * Gets information about a specific instance.
     *
     * @param instanceId The instance ID.
     * @return A future that completes with an [Optional] containing the instance info,
     *         or [Optional.empty] if not found.
     */
    fun getInstance(instanceId: String): CompletableFuture<Optional<InstanceInfo>>

    /**
     * Lists all instances in the cluster.
     *
     * @return A future that completes with the list of instances.
     */
    fun getInstances(): CompletableFuture<List<InstanceInfo>>

    /**
     * Lists instances filtered by state.
     *
     * @param state The state to filter by.
     * @return A future that completes with the filtered list.
     */
    fun getInstancesByState(state: InstanceState): CompletableFuture<List<InstanceInfo>>

    /**
     * Gets the current state of an instance.
     *
     * @param instanceId The instance ID.
     * @return A future that completes with an [Optional] containing the state,
     *         or [Optional.empty] if not found.
     */
    fun getInstanceState(instanceId: String): CompletableFuture<Optional<InstanceState>>

    /**
     * Reports the state of this server instance to the master.
     * Used internally by the plugin; generally not needed by external plugins.
     *
     * @param state The state to report.
     * @return A future that completes when the report is sent.
     */
    fun reportState(state: InstanceState): CompletableFuture<Void>
}
