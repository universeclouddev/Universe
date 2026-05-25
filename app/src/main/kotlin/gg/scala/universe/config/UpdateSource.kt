package gg.scala.universe.config

/**
 * Configuration for a single auto-update source.
 *
 * Universe periodically checks the remote URL and downloads it if the content
 * has changed (detected via hash or ETag).
 *
 * @param url Remote file URL to download.
 * @param targetPath Local path to write the file (e.g. "./configuration/lobby.json").
 *   For templates, use "./templates/<group>/<name>/" (trailing slash) to download
 *   into a template directory that can be synced to remote storage.
 * @param hashUrl Optional URL to fetch the hash (e.g. "https://example.com/lobby.json.sha256").
 *   If omitted, Universe tries common suffixes (.sha256, .sha1, .md5).
 * @param intervalMs Polling interval in milliseconds (default: 60_000 = 1 minute).
 * @param enabled Whether this source is active.
 * @param syncToStorage Optional storage provider key (e.g. "s3") to sync to after
 *   local download. When set and targetPath is under ./templates/, the auto-updater
 *   will call uploadTemplate on the provider so other nodes can fetch the template.
 */
data class UpdateSource(
    val url: String,
    val targetPath: String,
    val hashUrl: String? = null,
    val intervalMs: Long = 60_000,
    val enabled: Boolean = true,
    val syncToStorage: String? = null
)
