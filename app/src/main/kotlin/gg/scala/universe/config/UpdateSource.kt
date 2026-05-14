package gg.scala.universe.config

/**
 * Configuration for a single auto-update source.
 *
 * Universe periodically checks the remote URL and downloads it if the content
 * has changed (detected via hash or ETag).
 *
 * @param url Remote file URL to download.
 * @param targetPath Local path to write the file (e.g. "./configuration/lobby.json").
 * @param hashUrl Optional URL to fetch the hash (e.g. "https://example.com/lobby.json.sha256").
 *   If omitted, Universe tries common suffixes (.sha256, .sha1, .md5).
 * @param intervalMs Polling interval in milliseconds (default: 60_000 = 1 minute).
 * @param enabled Whether this source is active.
 */
data class UpdateSource(
    val url: String,
    val targetPath: String,
    val hashUrl: String? = null,
    val intervalMs: Long = 60_000,
    val enabled: Boolean = true
)
