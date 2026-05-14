package gg.scala.universe.gitops

import com.google.gson.Gson
import java.io.File

/**
 * Configuration for the GitOps extension, read from
 * ./extensions/gitops/config.json.
 */
data class GitSyncConfig(
    val url: String = "",
    val branch: String = "main",
    val targetPath: String = "./git-sync",
    val intervalMs: Long = 300_000,
    val enabled: Boolean = false,
    val sshKeyPath: String = "",
    val username: String = "",
    val password: String = ""
)

object GitSyncConfigLoader {
    private val gson = Gson()

    fun load(): GitSyncConfig {
        val file = File("./extensions/gitops/config.json")
        return if (file.exists()) {
            gson.fromJson(file.readText(), GitSyncConfig::class.java)
        } else {
            GitSyncConfig().also { save(it) }
        }
    }

    fun save(config: GitSyncConfig) {
        val file = File("./extensions/gitops/config.json")
        file.parentFile.mkdirs()
        file.writeText(gson.newBuilder().setPrettyPrinting().create().toJson(config))
    }
}
