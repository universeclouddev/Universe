package gg.scala.universe.k8s

import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import io.fabric8.kubernetes.api.model.IntOrString
import io.fabric8.kubernetes.api.model.OwnerReferenceBuilder
import io.fabric8.kubernetes.api.model.ServiceBuilder
import io.fabric8.kubernetes.client.KubernetesClient

/**
 * Creates a Kubernetes Service for the given pod based on [serviceConfig].
 *
 * When [serviceConfig.ownerReference] is true, the Service is created with an
 * [ownerReference] pointing to the pod so K8s automatically garbage-collects
 * the Service when the Pod is deleted.
 *
 * DNS name when headless: `universe-<instanceId>.<namespace>.svc.cluster.local`
 */
internal fun createInstanceService(
    k8s: KubernetesClient,
    serviceConfig: K8sServiceConfig,
    namespace: String,
    podName: String,
    instanceId: String,
    port: Int,
    labels: Map<String, String>,
    podUid: String?
) {
    if (!serviceConfig.enabled) return

    val serviceName = "universe-$instanceId"

    // Remove stale service if it exists
    try {
        val existing = k8s.services().inNamespace(namespace).withName(serviceName).get()
        if (existing != null) {
            k8s.services().inNamespace(namespace).withName(serviceName).delete()
            log("Deleted stale service '$serviceName' before creating new one")
        }
    } catch (_: Exception) {
        // ignored
    }

    val mergedLabels = labels + serviceConfig.labels

    val serviceBuilder = ServiceBuilder()
        .withNewMetadata()
            .withName(serviceName)
            .withNamespace(namespace)
            .addToLabels(mergedLabels)
            .addToAnnotations(serviceConfig.annotations)
        .endMetadata()
        .withNewSpec()
            .withType(serviceConfig.type)
            .apply {
                if (serviceConfig.clusterIP != null) {
                    withClusterIP(serviceConfig.clusterIP)
                }
            }
            .withSelector<String, String>(mapOf("universe-instance-id" to instanceId))
            .addNewPort()
                .withName("main")
                .withPort(port)
                .withTargetPort(IntOrString(port))
                .withProtocol("TCP")
            .endPort()
        .endSpec()

    // Set ownerReference so service is auto-deleted when pod is deleted
    if (serviceConfig.ownerReference && podUid != null) {
        serviceBuilder.editMetadata()
            .addToOwnerReferences(
                OwnerReferenceBuilder()
                    .withApiVersion("v1")
                    .withKind("Pod")
                    .withName(podName)
                    .withUid(podUid)
                    .withBlockOwnerDeletion(true)
                    .withController(true)
                    .build()
            )
            .endMetadata()
    }

    k8s.services().inNamespace(namespace).resource(serviceBuilder.build()).create()

    val dnsHint = if (serviceConfig.clusterIP == "None") " (DNS: $serviceName.$namespace.svc.cluster.local)" else ""
    log("Created ${serviceConfig.type} service '$serviceName'$dnsHint for instance $instanceId", LogLevel.SUCCESS)
}

/**
 * Cleans up orphaned services (services without a matching pod) on startup.
 * This handles the case where the app crashed before stop() could run.
 */
internal fun cleanupOrphanedServices(
    k8s: KubernetesClient,
    namespace: String,
    serviceConfig: K8sServiceConfig
) {
    if (!serviceConfig.cleanupOrphans) return

    try {
        val services = k8s.services().inNamespace(namespace)
            .withLabel("app", "universe")
            .list().items

        var deleted = 0
        services.forEach { service ->
            val instanceId = service.metadata?.labels?.get("universe-instance-id")
            if (instanceId != null) {
                val podName = "universe-$instanceId"
                val pod = k8s.pods().inNamespace(namespace).withName(podName).get()
                if (pod == null) {
                    // Pod doesn't exist — service is orphaned
                    k8s.services().inNamespace(namespace).withName(service.metadata.name).delete()
                    log("Deleted orphaned service '${service.metadata.name}' (no pod '$podName' found)")
                    deleted++
                }
            }
        }

        if (deleted > 0) {
            log("Cleaned up $deleted orphaned K8s service(s) in namespace '$namespace'", LogLevel.WARNING)
        }
    } catch (e: Exception) {
        log("Failed to cleanup orphaned services: ${e.message}", LogLevel.WARNING)
    }
}
