package gg.scala.universe.template

import com.google.inject.Singleton

/**
 * Registry for [TemplateVariableProvider] instances.
 *
 * Extensions call [register] to contribute custom template variables.
 * [TemplateManager] queries all registered providers during variable replacement.
 */
@Singleton
class TemplateVariableRegistry {

    private val providers = mutableListOf<TemplateVariableProvider>()

    /**
     * Registers a [provider] to be queried during template variable replacement.
     */
    fun register(provider: TemplateVariableProvider) {
        providers.add(provider)
    }

    /**
     * Collects variables from all registered providers.
     */
    fun collectVariables(): Map<String, String> {
        val result = mutableMapOf<String, String>()
        providers.forEach { provider ->
            result.putAll(provider.provideVariables())
        }
        return result
    }
}
