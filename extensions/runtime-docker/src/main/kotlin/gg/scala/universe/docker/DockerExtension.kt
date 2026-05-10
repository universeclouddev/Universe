package gg.scala.universe.docker

import com.google.inject.Inject
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import gg.scala.universe.extension.Extension
import gg.scala.universe.runtime.RuntimeRegistry

class DockerExtension : Extension {

    override fun id(): String = "runtime-docker"
    override fun version(): String = "1.0.0"

    @Inject
    private lateinit var runtimeRegistry: RuntimeRegistry

    override fun onLoad() {
        val config = DockerConfigLoader.load()
        val provider = DockerRuntimeProvider(config)
        runtimeRegistry.register("docker", provider)
        log("Docker runtime extension loaded (image=${config.javaImage.repository}:${config.javaImage.tag})", LogType.SUCCESS)
    }

    override fun onUnload() {
        runtimeRegistry.unregister("docker")
        log("Docker runtime extension unloaded", LogType.INFORMATION)
    }

    override fun onReload() {
        onUnload()
        onLoad()
        log("Docker runtime extension reloaded", LogType.INFORMATION)
    }
}
