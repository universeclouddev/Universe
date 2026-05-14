package gg.scala.universe.argocd

import com.google.inject.Inject
import gg.scala.universe.cluster.ClusterDataProvider
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.extension.Extension
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Optional ArgoCD exporter extension that generates Kubernetes manifests
 * for Universe configurations and instances.
 *
 * This extension is completely independent from the K8s runtime.
 * If you don't use ArgoCD, simply don't install this extension.
 *
 * Writes ConfigMaps and Deployments to [outputPath] so they can be
 * committed to a Git repository and tracked by ArgoCD.
 *
 * ArgoCD is mainly used for updates and drift detection, while
 * Universe handles actual server runtime lifecycle.
 */
class ArgoCdExtension : Extension {

    override fun id(): String = "argocd-exporter"
    override fun version(): String = "1.0.0"

    @Inject
    private lateinit var clusterDataProvider: ClusterDataProvider

    private val outputPath = "./argocd-manifests"
    private val executor = Executors.newSingleThreadScheduledExecutor { r ->
        Thread(r, "universe-argocd-exporter").apply { isDaemon = true }
    }

    override fun onLoad() {
        log("ArgoCD Exporter: Starting (output=$outputPath)")
        exportAll()

        executor.scheduleAtFixedRate(
            ::exportAll,
            60,
            60,
            TimeUnit.SECONDS
        )
    }

    override fun onUnload() {
        executor.shutdown()
        try {
            if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
                executor.shutdownNow()
            }
        } catch (_: InterruptedException) {
            executor.shutdownNow()
        }
        log("ArgoCD Exporter: Stopped")
    }

    override fun onReload() {
        onUnload()
        onLoad()
        log("ArgoCD Exporter: Reloaded")
    }

    private fun exportAll() {
        try {
            val path = Path.of(outputPath)
            Files.createDirectories(path)

            // Export configurations as ConfigMaps
            val configs = clusterDataProvider.getConfigurations()
            for (config in configs) {
                val manifest = buildConfigMap(config)
                val file = path.resolve("config-${config.name}.yaml")
                Files.writeString(file, manifest)
            }

            // Export running instances as Deployments
            val instances = clusterDataProvider.getActiveInstances()
            for (instance in instances) {
                val manifest = buildDeployment(instance)
                val file = path.resolve("instance-${instance.id}.yaml")
                Files.writeString(file, manifest)
            }

            // Write kustomization.yaml for ArgoCD app-of-apps pattern
            val files = configs.map { "config-${it.name}.yaml" } + instances.map { "instance-${it.id}.yaml" }
            val kustomization = buildKustomization(files)
            Files.writeString(path.resolve("kustomization.yaml"), kustomization)

            log("ArgoCD Exporter: Exported ${configs.size} configs and ${instances.size} instances", LogLevel.DEBUG)
        } catch (e: Exception) {
            log("ArgoCD Exporter: Failed to export: ${e.message}", LogLevel.WARNING)
        }
    }

    private fun buildConfigMap(config: gg.scala.universe.schema.Configuration): String {
        return """
        apiVersion: v1
        kind: ConfigMap
        metadata:
          name: universe-config-${config.name}
          namespace: universe
          labels:
            app.kubernetes.io/part-of: universe
            app.kubernetes.io/component: configuration
            universe.scala.gg/configuration: "${config.name}"
        data:
          configuration.json: |
            ${com.google.gson.Gson().toJson(config).prependIndent("            ").trimStart()}
        """.trimIndent()
    }

    private fun buildDeployment(instance: gg.scala.universe.schema.InstanceInfo): String {
        return """
        apiVersion: apps/v1
        kind: Deployment
        metadata:
          name: universe-instance-${instance.id}
          namespace: universe
          labels:
            app.kubernetes.io/part-of: universe
            app.kubernetes.io/component: instance
            universe.scala.gg/instance-id: "${instance.id}"
            universe.scala.gg/configuration: "${instance.configurationName}"
        spec:
          replicas: 1
          selector:
            matchLabels:
              universe.scala.gg/instance-id: "${instance.id}"
          template:
            metadata:
              labels:
                universe.scala.gg/instance-id: "${instance.id}"
            spec:
              containers:
              - name: server
                image: universe-minecraft:latest
                env:
                - name: UNIVERSE_INSTANCE_ID
                  value: "${instance.id}"
                - name: UNIVERSE_CONFIGURATION
                  value: "${instance.configurationName}"
                ports:
                - containerPort: ${instance.allocatedPort}
        """.trimIndent()
    }

    private fun buildKustomization(files: List<String>): String {
        val resources = files.joinToString("\n") { "  - $it" }
        return """
        apiVersion: kustomize.config.k8s.io/v1beta1
        kind: Kustomization
        resources:
        $resources
        commonLabels:
          app.kubernetes.io/managed-by: argocd
          universe.scala.gg/managed-by: universe
        """.trimIndent()
    }
}
