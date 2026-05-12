package gg.scala.universe.k8s

import com.google.inject.Inject
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import gg.scala.universe.extension.Extension
import gg.scala.universe.runtime.RuntimeRegistry

class K8sExtension : Extension {

    override fun id(): String = "runtime-k8s"
    override fun version(): String = "1.0.0"

    @Inject
    private lateinit var runtimeRegistry: RuntimeRegistry

    private lateinit var config: K8sConfig

    override fun onLoad() {
        config = K8sConfigLoader.load()
        val provider = K8sRuntimeProvider(config)
        runtimeRegistry.register(config.factoryName, provider)
        log("Kubernetes runtime extension loaded (image=${config.image}, namespace=${config.namespace})", LogType.SUCCESS)
    }

    override fun onUnload() {
        runtimeRegistry.unregister(config.factoryName)
        log("Kubernetes runtime extension unloaded", LogType.INFORMATION)
    }

    override fun onReload() {
        onUnload()
        onLoad()
        log("Kubernetes runtime extension reloaded", LogType.INFORMATION)
    }
}
