package gg.scala.universe.tailscale

import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.util.json.Serializers
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Queries the local Tailscale daemon by shelling out to the `tailscale` CLI.
 *
 * Parses the JSON output of `tailscale status --json` to extract the node's
 * mesh-network IP, hostname, and MagicDNS name.
 */
class TailscaleClient(private val config: TailscaleConfig) {

    private var cachedStatus: TailscaleStatus? = null
    private var cacheTimestamp: Long = 0
    private val cacheTtlMs = 30_000L

    /**
     * Returns the current Tailscale status, using a short-lived in-memory cache
     * to avoid spawning a process on every variable resolution.
     */
    fun getStatus(): TailscaleStatus? {
        val now = System.currentTimeMillis()
        val cached = cachedStatus
        if (cached != null && now - cacheTimestamp < cacheTtlMs) {
            return cached
        }

        val fresh = fetchStatus()
        cachedStatus = fresh
        cacheTimestamp = now
        return fresh
    }

    private fun fetchStatus(): TailscaleStatus? {
        return try {
            val args = mutableListOf(config.binaryPath, "status", "--json")
            if (!config.socketPath.isNullOrBlank()) {
                args.add("--socket")
                args.add(config.socketPath)
            }
            val process = ProcessBuilder(args)
                .redirectErrorStream(true)
                .start()

            val finished = process.waitFor(config.timeoutMs, TimeUnit.MILLISECONDS)
            if (!finished) {
                process.destroyForcibly()
                log("Tailscale status command timed out after ${config.timeoutMs}ms", LogLevel.WARNING)
                return null
            }

            if (process.exitValue() != 0) {
                val error = process.inputStream.bufferedReader().readText()
                log("Tailscale status exited with code ${process.exitValue()}: $error", LogLevel.WARNING)
                return null
            }

            val json = process.inputStream.bufferedReader().readText()
            Serializers.GSON.fromJson(json, TailscaleStatus::class.java)
        } catch (e: Exception) {
            if (config.warnIfUnavailable) {
                log("Failed to query Tailscale status: ${e.message}", LogLevel.WARNING)
            }
            null
        }
    }

    /**
     * Convenience: extracts the primary IPv4 Tailscale IP.
     */
    fun getIPv4(): String {
        val status = getStatus() ?: return ""
        return status.TailscaleIPs?.firstOrNull { !it.contains(":") } ?: ""
    }

    /**
     * Convenience: extracts the IPv6 Tailscale IP.
     */
    fun getIPv6(): String {
        val status = getStatus() ?: return ""
        return status.TailscaleIPs?.firstOrNull { it.contains(":") } ?: ""
    }

    /**
     * Convenience: extracts the hostname.
     */
    fun getHostname(): String {
        return getStatus()?.Self?.HostName ?: ""
    }

    /**
     * Convenience: extracts the MagicDNS name.
     */
    fun getMagicDns(): String {
        return getStatus()?.Self?.DNSName ?: ""
    }
}
