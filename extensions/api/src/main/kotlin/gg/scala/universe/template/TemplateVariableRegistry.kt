package gg.scala.universe.template

import gg.scala.universe.schema.Configuration

/**
 * Registry for [TemplateVariableProvider] implementations.
 *
 * Extensions receive this registry via Guice injection and call
 * [register] to contribute custom template variables.
 */
interface TemplateVariableRegistry {
    /**
     * Registers a [provider] to be queried during template variable replacement.
     */
    fun register(provider: TemplateVariableProvider)

    /**
     * Collects variables from all registered providers.
     *
     * @param configuration The instance configuration being deployed.
     * @param instanceId The unique instance identifier.
     * @param allocatedPort The port allocated to the instance.
     */
    fun collectVariables(configuration: Configuration, instanceId: String, allocatedPort: Int): Map<String, String>
}
