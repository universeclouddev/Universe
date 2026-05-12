package gg.scala.universe.template

import com.google.inject.Singleton
import gg.scala.universe.schema.Configuration

/**
 * Guice-managed implementation of [TemplateVariableRegistry].
 */
@Singleton
class TemplateVariableRegistryImpl : TemplateVariableRegistry {

    private val providers = mutableListOf<TemplateVariableProvider>()

    override fun register(provider: TemplateVariableProvider) {
        providers.add(provider)
    }

    override fun collectVariables(configuration: Configuration, instanceId: String, allocatedPort: Int): Map<String, String> {
        val result = mutableMapOf<String, String>()
        providers.forEach { provider ->
            result.putAll(provider.provideVariables(configuration, instanceId, allocatedPort))
        }
        return result
    }
}
