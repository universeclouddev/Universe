package gg.scala.universe.template

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
     */
    fun collectVariables(): Map<String, String>
}
