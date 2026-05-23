package gg.scala.universe.tailscale

import gg.scala.universe.schema.Configuration
import gg.scala.universe.template.TemplateVariableProvider

/**
 * Provides Tailscale-specific template variables for instances deployed on nodes
 * that are part of a Tailscale mesh network.
 *
 * Variables available:
 * - `%TAILSCALE_IP%` — Primary IPv4 Tailscale address (e.g. "100.64.1.1")
 * - `%TAILSCALE_IP6%` — IPv6 Tailscale address, if assigned
 * - `%TAILSCALE_HOSTNAME%` — Machine hostname in Tailscale (e.g. "my-laptop")
 * - `%TAILSCALE_MAGIC_DNS%` — Full MagicDNS name (e.g. "my-laptop.tailxxxxx.ts.net")
 * - `%TAILSCALE_ADDRESS%` — Alias for `%TAILSCALE_IP%` (convenience for hostAddress fields)
 */
class TailscaleVariableProvider(
    private val client: TailscaleClient
) : TemplateVariableProvider {

    override fun provideVariables(configuration: Configuration, instanceId: String, allocatedPort: Int): Map<String, String> {
        val ipv4 = client.getIPv4()
        val ipv6 = client.getIPv6()
        val hostname = client.getHostname()
        val magicDns = client.getMagicDns()

        return mapOf(
            "%TAILSCALE_IP%" to ipv4,
            "%TAILSCALE_IP6%" to ipv6,
            "%TAILSCALE_HOSTNAME%" to hostname,
            "%TAILSCALE_MAGIC_DNS%" to magicDns,
            "%TAILSCALE_ADDRESS%" to ipv4
        )
    }
}
