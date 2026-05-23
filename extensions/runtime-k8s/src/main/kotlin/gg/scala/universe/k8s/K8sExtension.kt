package gg.scala.universe.k8s

import com.google.inject.Inject
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.extension.Extension
import gg.scala.universe.runtime.RuntimeRegistry
import gg.scala.universe.template.TemplateVariableRegistry

class K8sExtension : Extension {

    override fun id(): String = "runtime-k8s"
    override fun version(): String = "1.0.0"

    @Inject
    private lateinit var runtimeRegistry: RuntimeRegistry

    @Inject
    private lateinit var templateVariableRegistry: TemplateVariableRegistry

    private lateinit var config: K8sConfig

    override fun onLoad() {
        config = K8sConfigLoader.load()
        val provider = K8sRuntimeProvider(config)
        runtimeRegistry.register(config.factoryName, provider)
        
        // Register K8s-specific template variables (%NAMESPACE%, %SERVICE_DNS%, etc.)
        templateVariableRegistry.register(K8sTemplateVariableProvider(config))
        
        log("Kubernetes runtime extension loaded (image=${config.image}, namespace=${config.namespace})", LogLevel.SUCCESS)
    }

    override fun onUnload() {
        runtimeRegistry.unregister(config.factoryName)
        log("Kubernetes runtime extension unloaded")
    }

    override fun onReload() {
        onUnload()
        onLoad()
        log("Kubernetes runtime extension reloaded")
    }
}
