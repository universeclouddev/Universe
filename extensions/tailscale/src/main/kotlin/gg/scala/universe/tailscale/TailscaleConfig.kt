package gg.scala.universe.tailscale

/**
 * Configuration for the Tailscale extension.
 */
data class TailscaleConfig(
    /**
     * Path to the `tailscale` CLI binary.
     * Defaults to "tailscale" (resolved via PATH).
     */
    val binaryPath: String = "tailscale",

    /**
     * Timeout in milliseconds for the `tailscale status --json` command.
     */
    val timeoutMs: Long = 5000,

    /**
     * When true, the extension logs a warning on startup if Tailscale is not available.
     */
    val warnIfUnavailable: Boolean = true
)
