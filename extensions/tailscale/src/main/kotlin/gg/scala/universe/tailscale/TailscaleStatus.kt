package gg.scala.universe.tailscale

/**
 * Represents the JSON output of `tailscale status --json`.
 *
 * Only the fields we care about are mapped; everything else is ignored.
 */
data class TailscaleStatus(
    /** The Tailscale IPv4 address of this node (e.g. "100.64.1.1"). */
    val TailscaleIPs: List<String>? = null,

    /** The IPv6 address of this node, if assigned. */
    val Self: TailscaleSelf? = null
)

data class TailscaleSelf(
    /** Hostname as known to Tailscale (e.g. "my-laptop"). */
    val HostName: String? = null,

    /** Full MagicDNS name (e.g. "my-laptop.tailxxxxx.ts.net"). */
    val DNSName: String? = null,

    /** Tailscale IPs (same as root, but repeated here for robustness). */
    val TailscaleIPs: List<String>? = null
)
