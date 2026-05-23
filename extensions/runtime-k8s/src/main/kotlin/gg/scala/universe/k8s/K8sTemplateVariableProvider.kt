package gg.scala.universe.k8s

import gg.scala.universe.schema.Configuration
import gg.scala.universe.template.TemplateVariableProvider

/**
 * Provides K8s-specific template variables for instances deployed on Kubernetes.
 *
 * Variables available:
 * - `%NAMESPACE%` — The K8s namespace (e.g., "universe")
 * - `%SERVICE_DNS%` — Service DNS name when services are enabled, empty otherwise
 * - `%POD_NAME%` — The pod name (e.g., "universe-a1b2c3")
 * - `%HOST_ADDRESS%` — Service DNS when services are enabled; falls back to empty so
 *   the configuration's [hostAddress] is used instead
 */
class K8sTemplateVariableProvider(
    private val config: K8sConfig
) : TemplateVariableProvider {

    override fun provideVariables(configuration: Configuration, instanceId: String, allocatedPort: Int): Map<String, String> {
        val serviceName = "universe-$instanceId"

        return if (config.service.enabled) {
            val serviceDns = "$serviceName.${config.namespace}.svc.cluster.local"
            mapOf(
                "%NAMESPACE%" to config.namespace,
                "%SERVICE_DNS%" to serviceDns,
                "%POD_NAME%" to serviceName,
                "%HOST_ADDRESS%" to serviceDns
            )
        } else {
            mapOf(
                "%NAMESPACE%" to config.namespace,
                "%SERVICE_DNS%" to "",
                "%POD_NAME%" to serviceName,
            )
        }
    }
}
