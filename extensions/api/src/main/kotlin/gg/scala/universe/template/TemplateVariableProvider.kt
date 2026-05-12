package gg.scala.universe.template

import gg.scala.universe.schema.Configuration

/**
 * Implemented by extensions that wish to provide custom template variables.
 *
 * During instance deployment, [provideVariables] is called to collect
 * placeholder → value mappings that will be applied alongside built-in variables.
 */
interface TemplateVariableProvider {
    /**
     * Returns a map of placeholder → replacement value.
     *
     * @param configuration The instance configuration being deployed.
     * @param instanceId The unique instance identifier.
     * @param allocatedPort The port allocated to the instance.
     *
     * Example: `mapOf("%CUSTOM_VAR%" to "customValue")`
     */
    fun provideVariables(configuration: Configuration, instanceId: String, allocatedPort: Int): Map<String, String>
}
