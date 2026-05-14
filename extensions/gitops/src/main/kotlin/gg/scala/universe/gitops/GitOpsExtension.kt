package gg.scala.universe.gitops

import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.extension.Extension
import org.eclipse.jgit.api.Git
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * GitOps extension that syncs templates and configurations from a Git repository.
 *
 * On startup: clones the repository if not present, pulls updates periodically.
 * After each sync: copies `templates/` and `configuration/` from the cloned repo
 * to the local Universe directories.
 */
class GitOpsExtension : Extension {

    override fun id(): String = "gitops"
    override fun version(): String = "1.0.0"

    private val executor = Executors.newSingleThreadScheduledExecutor { r ->
        Thread(r, "universe-git-sync").apply { isDaemon = true }
    }

    private var git: Git? = null
    private lateinit var config: GitSyncConfig

    override fun onLoad() {
        config = GitSyncConfigLoader.load()

        if (!config.enabled || config.url.isBlank()) {
            log("GitOps: Disabled or no URL configured", LogLevel.DEBUG)
            return
        }

        log("GitOps: Starting sync from ${config.url} (branch=${config.branch})")

        try {
            val target = Path.of(config.targetPath)
            if (Files.exists(target.resolve(".git"))) {
                log("GitOps: Existing repo found, opening...")
                git = Git.open(target.toFile())
                pull()
            } else {
                log("GitOps: Cloning repository...")
                Files.createDirectories(target)
                val clone = Git.cloneRepository()
                    .setURI(config.url)
                    .setDirectory(target.toFile())
                    .setBranch(config.branch)

                if (config.username.isNotBlank() && config.password.isNotBlank()) {
                    clone.setCredentialsProvider(
                        UsernamePasswordCredentialsProvider(config.username, config.password)
                    )
                }

                git = clone.call()
                log("GitOps: Repository cloned successfully", LogLevel.SUCCESS)
            }

            copyToLocal()

            executor.scheduleAtFixedRate(
                { sync() },
                config.intervalMs,
                config.intervalMs,
                TimeUnit.MILLISECONDS
            )
        } catch (e: Exception) {
            log("GitOps: Failed to initialize: ${e.message}", LogLevel.ERROR)
        }
    }

    override fun onUnload() {
        executor.shutdown()
        try {
            if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
                executor.shutdownNow()
            }
        } catch (_: InterruptedException) {
            executor.shutdownNow()
        }
        git?.close()
        log("GitOps: Stopped")
    }

    override fun onReload() {
        onUnload()
        onLoad()
        log("GitOps: Reloaded")
    }

    private fun sync() {
        try {
            log("GitOps: Pulling updates...", LogLevel.DEBUG)
            pull()
            copyToLocal()
            log("GitOps: Sync completed", LogLevel.DEBUG)
        } catch (e: Exception) {
            log("GitOps: Sync failed: ${e.message}", LogLevel.WARNING)
        }
    }

    private fun pull() {
        val pull = git!!.pull()
            .setRemoteBranchName(config.branch)

        if (config.username.isNotBlank() && config.password.isNotBlank()) {
            pull.setCredentialsProvider(
                UsernamePasswordCredentialsProvider(config.username, config.password)
            )
        }

        val result = pull.call()
        if (result.isSuccessful) {
            if (result.mergeResult != null && result.mergeResult.mergeStatus.isSuccessful) {
                log("GitOps: Pulled updates (${result.mergeResult.mergeStatus})", LogLevel.SUCCESS)
            }
        } else {
            log("GitOps: Pull failed", LogLevel.WARNING)
        }
    }

    private fun copyToLocal() {
        val source = Path.of(config.targetPath)
        copyDir(source.resolve("templates"), Path.of("./templates"))
        copyDir(source.resolve("configuration"), Path.of("./configuration"))
    }

    private fun copyDir(from: Path, to: Path) {
        if (!Files.exists(from)) return
        Files.createDirectories(to)

        Files.walk(from).forEach { sourcePath ->
            val relative = from.relativize(sourcePath)
            val targetPath = to.resolve(relative)
            if (Files.isDirectory(sourcePath)) {
                Files.createDirectories(targetPath)
            } else {
                Files.copy(sourcePath, targetPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING)
            }
        }

        log("GitOps: Copied ${from.fileName} → ${to}")
    }
}
