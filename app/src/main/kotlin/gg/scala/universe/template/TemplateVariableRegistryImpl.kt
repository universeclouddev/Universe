package gg.scala.universe.template

import com.google.inject.Singleton

/**
 * Guice-managed implementation of [TemplateVariableRegistry].
 */
@Singleton
class TemplateVariableRegistryImpl : TemplateVariableRegistry {

    private val providers = mutableListOf<TemplateVariableProvider>()

    override fun register(provider: TemplateVariableProvider) {
        providers.add(provider)
    }

    override fun collectVariables(): Map<String, String> {
        val result = mutableMapOf<String, String>()
        providers.forEach { provider ->
            result.putAll(provider.provideVariables())
        }
        return result
    }
}
