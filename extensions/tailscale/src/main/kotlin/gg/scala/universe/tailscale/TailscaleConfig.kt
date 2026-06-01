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
    val warnIfUnavailable: Boolean = true,

    /**
     * Path to the `tailscaled` daemon socket.
     * If set, the `tailscale` CLI is invoked with `--socket <path>` so it can
     * connect to the daemon inside a Docker container or non-standard location.
     * Defaults to `null` (let tailscale auto-detect).
     *
     * Common values:
     * - `/var/run/tailscale/tailscaled.sock` (most Linux distros)
     * - `/run/tailscale/tailscaled.sock` (some distros, e.g. Arch)
     */
    val socketPath: String? = null
)
