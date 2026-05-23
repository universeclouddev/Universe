package gg.scala.universe.tailscale

import com.google.inject.Inject
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.extension.Extension
import gg.scala.universe.template.TemplateVariableRegistry

class TailscaleExtension : Extension {

    override fun id(): String = "tailscale"
    override fun version(): String = "1.0.0"

    @Inject
    private lateinit var templateVariableRegistry: TemplateVariableRegistry

    private lateinit var config: TailscaleConfig

    override fun onLoad() {
        config = TailscaleConfigLoader.load()
        val client = TailscaleClient(config)

        // Register Tailscale-specific template variables
        templateVariableRegistry.register(TailscaleVariableProvider(client))

        // Log availability so operators know whether the extension is functional
        val ipv4 = client.getIPv4()
        if (ipv4.isNotBlank()) {
            log("Tailscale extension loaded (ip=$ipv4, hostname=${client.getHostname()})", LogLevel.SUCCESS)
        } else {
            log("Tailscale extension loaded but no Tailscale IP detected. Is tailscale running?", LogLevel.WARNING)
        }
    }

    override fun onUnload() {
        // Variables are automatically dropped when the extension unloads
        log("Tailscale extension unloaded")
    }

    override fun onReload() {
        onUnload()
        onLoad()
        log("Tailscale extension reloaded")
    }
}
