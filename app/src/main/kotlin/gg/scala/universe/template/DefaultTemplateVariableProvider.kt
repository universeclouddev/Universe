package gg.scala.universe.template

import com.google.inject.Inject
import com.google.inject.Singleton
import gg.scala.universe.config.UniverseMainConfiguration
import gg.scala.universe.schema.Configuration

/**
 * Provides the built-in template variables available in every deployment.
 *
 * Registered automatically on construction via the injected [TemplateVariableRegistry].
 */
@Singleton
class DefaultTemplateVariableProvider @Inject constructor(
    private val mainConfiguration: UniverseMainConfiguration,
    registry: TemplateVariableRegistry
) : TemplateVariableProvider {

    init {
        registry.register(this)
    }

    override fun provideVariables(configuration: Configuration, instanceId: String, allocatedPort: Int): Map<String, String> {
        val result = mutableMapOf(
            "%PORT%" to allocatedPort.toString(),
            "%INSTANCE_ID%" to instanceId,
            "%MASTER_IP%" to mainConfiguration.masterAddress,
            "%MASTER_ADDRESS%" to mainConfiguration.masterAddress,
            "%MASTER_PORT%" to mainConfiguration.masterPort.toString(),
            "%MASTER_API_PORT%" to mainConfiguration.masterApiPort.toString(),
            "%NODE_ID%" to mainConfiguration.nodeId,
            "%HOST_ADDRESS%" to configuration.hostAddress,
            "%CONFIGURATION_NAME%" to configuration.name,
            "%NODE_PORT%" to mainConfiguration.port.toString(),
            "%NODE_ADDRESS%" to mainConfiguration.address,
            "%RAM_MB%" to configuration.ramMB.toString(),
            "%INSTANCE_GROUPS" to configuration.instanceGroups.joinToString { ";" }
        )

        mainConfiguration.nodeSpecificVariables.forEach { (key, value) -> result["%$key%"] = value  }
        configuration.properties.forEach { (key, value) -> result["%$key%"] = value }
        return result
    }
}
