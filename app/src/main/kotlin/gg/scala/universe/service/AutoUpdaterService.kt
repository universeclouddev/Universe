package gg.scala.universe.service

import com.google.inject.Inject
import com.google.inject.Singleton
import gg.scala.universe.config.UpdateSource
import gg.scala.universe.config.UniverseMainConfiguration
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.template.TemplateStorageRegistry
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

/**
 * Auto-updater service for remote configurations and templates.
 *
 * Polls [UpdateSource] entries from the main configuration and downloads
 * files only when the remote content has changed (detected via hash).
 */
@Singleton
class AutoUpdaterService @Inject constructor(
    private val configuration: UniverseMainConfiguration,
    private val storageRegistry: TemplateStorageRegistry
) {
    private val client = HttpClient.newBuilder()
        .connectTimeout(java.time.Duration.ofSeconds(10))
        .build()

    private val executor = Executors.newScheduledThreadPool(2) { r ->
        Thread(r, "universe-auto-updater").apply { isDaemon = true }
    }

    private val futures = mutableListOf<ScheduledFuture<*>>()
    private val localHashes = mutableMapOf<String, String>()

    fun start() {
        val sources = configuration.updateSources.filter { it.enabled }
        if (sources.isEmpty()) {
            log("AutoUpdater: No update sources configured", LogLevel.DEBUG)
            return
        }

        log("AutoUpdater: Starting with ${sources.size} source(s)")

        for (source in sources) {
            val future = executor.scheduleAtFixedRate(
                { checkAndUpdate(source) },
                0,
                source.intervalMs,
                TimeUnit.MILLISECONDS
            )
            futures.add(future)
        }
    }

    fun stop() {
        futures.forEach { it.cancel(false) }
        futures.clear()
        executor.shutdown()
        try {
            if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
                executor.shutdownNow()
            }
        } catch (_: InterruptedException) {
            executor.shutdownNow()
        }
        log("AutoUpdater: Stopped")
    }

    /** Force immediate check for all sources. */
    fun forceCheckAll(): List<String> {
        val results = mutableListOf<String>()
        for (source in configuration.updateSources.filter { it.enabled }) {
            val updated = checkAndUpdate(source)
            results.add("${source.targetPath}: ${if (updated) "updated" else "unchanged"}")
        }
        return results
    }

    /** Check a single source and download if changed. Returns true if updated. */
    fun checkAndUpdate(source: UpdateSource): Boolean {
        return try {
            val remoteHash = fetchRemoteHash(source)
            val localHash = computeLocalHash(source.targetPath)

            if (remoteHash != null && remoteHash == localHash) {
                log("AutoUpdater: ${source.targetPath} is up to date (hash=$remoteHash)", LogLevel.DEBUG)
                return false
            }

            log("AutoUpdater: ${source.targetPath} hash mismatch (remote=$remoteHash, local=$localHash), downloading...")
            download(source)
            true
        } catch (e: Exception) {
            log("AutoUpdater: Failed to check ${source.url}: ${e.message}", LogLevel.WARNING)
            false
        }
    }

    // ─── Hash Detection ───

    private fun fetchRemoteHash(source: UpdateSource): String? {
        // 1. Explicit hash URL
        if (!source.hashUrl.isNullOrBlank()) {
            return fetchText(source.hashUrl)?.trim()
        }

        // 2. Try common suffixes
        val suffixes = listOf(".sha256", ".sha1", ".md5")
        for (suffix in suffixes) {
            val hash = fetchText(source.url + suffix)?.trim()
            if (!hash.isNullOrBlank()) return hash
        }

        // 3. HTTP HEAD for ETag
        val etag = fetchHeadHeader(source.url, "ETag")
        if (!etag.isNullOrBlank()) return etag

        // 4. HTTP HEAD for Last-Modified
        val lastModified = fetchHeadHeader(source.url, "Last-Modified")
        if (!lastModified.isNullOrBlank()) return "lastmod:$lastModified"

        // 5. Fall back: download the file and hash it ourselves
        val content = fetchBytes(source.url) ?: return null
        return sha256(content)
    }

    private fun computeLocalHash(targetPath: String): String? {
        val cached = localHashes[targetPath]
        if (cached != null) return cached

        val path = Path.of(targetPath)
        if (!Files.exists(path)) return null

        val bytes = Files.readAllBytes(path)
        val hash = sha256(bytes)
        localHashes[targetPath] = hash
        return hash
    }

    // ─── HTTP Helpers ───

    private fun fetchText(url: String): String? {
        val request = HttpRequest.newBuilder(URI.create(url))
            .GET()
            .timeout(java.time.Duration.ofSeconds(10))
            .build()
        val response = client.send(request, HttpResponse.BodyHandlers.ofString())
        return if (response.statusCode() == 200) response.body() else null
    }

    private fun fetchBytes(url: String): ByteArray? {
        val request = HttpRequest.newBuilder(URI.create(url))
            .GET()
            .timeout(java.time.Duration.ofSeconds(30))
            .build()
        val response = client.send(request, HttpResponse.BodyHandlers.ofByteArray())
        return if (response.statusCode() == 200) response.body() else null
    }

    private fun fetchHeadHeader(url: String, headerName: String): String? {
        return try {
            val request = HttpRequest.newBuilder(URI.create(url))
                .method("HEAD", HttpRequest.BodyPublishers.noBody())
                .timeout(java.time.Duration.ofSeconds(10))
                .build()
            val response = client.send(request, HttpResponse.BodyHandlers.discarding())
            if (response.statusCode() == 200) {
                response.headers().firstValue(headerName).orElse(null)
            } else null
        } catch (_: Exception) {
            null
        }
    }

    private fun download(source: UpdateSource) {
        val content = fetchBytes(source.url)
            ?: throw IllegalStateException("Failed to download ${source.url}")

        val target = Path.of(source.targetPath)
        Files.createDirectories(target.parent)

        val temp = Files.createTempFile(target.fileName.toString(), ".tmp")
        Files.write(temp, content)
        Files.move(temp, target, StandardCopyOption.REPLACE_EXISTING)

        localHashes[source.targetPath] = sha256(content)
        log("AutoUpdater: Downloaded ${source.url} → ${source.targetPath} (${content.size} bytes)", LogLevel.SUCCESS)

        // Sync to remote storage if configured
        syncToStorage(source)
    }

    /**
     * If [UpdateSource.syncToStorage] is set and the target path is under
     * `./templates/<group>/<name>/`, zips the template and uploads it to the
     * configured storage provider (e.g. S3).
     */
    private fun syncToStorage(source: UpdateSource) {
        val providerKey = source.syncToStorage ?: return
        val targetPath = source.targetPath

        // Only sync template directories
        if (!targetPath.startsWith("./templates/") && !targetPath.startsWith("templates/")) {
            log("AutoUpdater: syncToStorage skipped — target is not under ./templates/", LogLevel.DEBUG)
            return
        }

        val normalized = targetPath.removePrefix("./").removePrefix("templates/")
        val parts = normalized.split("/")
        if (parts.size < 2) {
            log("AutoUpdater: syncToStorage skipped — cannot parse group/name from $targetPath", LogLevel.WARNING)
            return
        }

        val group = parts[0]
        val name = parts[1]

        val provider = storageRegistry.get(providerKey)
        if (provider == null) {
            log("AutoUpdater: syncToStorage skipped — no provider registered for '$providerKey'", LogLevel.WARNING)
            return
        }

        log("AutoUpdater: Syncing template $group/$name to storage '$providerKey'...")
        val success = provider.uploadTemplate(group, name)
        if (success) {
            log("AutoUpdater: Synced template $group/$name to '$providerKey'", LogLevel.SUCCESS)
        } else {
            log("AutoUpdater: Failed to sync template $group/$name to '$providerKey'", LogLevel.WARNING)
        }
    }

    private fun sha256(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(bytes).joinToString("") { "%02x".format(it) }
    }
}
