package gg.scala.universe.template

/**
 * Abstraction for template storage backends.
 *
 * Concrete implementations (e.g., S3, FTP, local) are registered
 * via [TemplateStorageRegistry] under a storage key.
 */
interface TemplateStorageProvider {
    /** Unique storage key, e.g. "s3", "ftp" */
    val storageKey: String

    /** Download a template zip to the local templates directory */
    fun downloadTemplate(group: String, name: String): Boolean

    /** Upload a local template zip to remote storage */
    fun uploadTemplate(group: String, name: String): Boolean

    /**
     * List available templates in the given group.
     *
     * @param group The template group name.
     * @return List of template names in the group.
     */
    fun listTemplates(group: String): List<String>

    /**
     * Download a template zip and extract it directly into [targetDir].
     *
     * This is used during instance deployment to avoid polluting the local
     * `./templates/` directory with files from remote storage. It allows
     * local and remote templates with the same group/name to coexist.
     *
     * The default implementation delegates to [downloadTemplate] and then
     * copies the extracted files from `./templates/<group>/<name>/` into
     * [targetDir]. Providers should override this for more efficient direct
     * extraction.
     *
     * @param group The template group name.
     * @param name The template name.
     * @param targetDir The directory to extract files into (e.g. `./running/<instance-id>/`).
     * @param overwrite If true, existing files in [targetDir] will be replaced.
     * @return `true` if extraction succeeded.
     */
    fun extractTemplate(group: String, name: String, targetDir: java.nio.file.Path, overwrite: Boolean): Boolean {
        val downloaded = downloadTemplate(group, name)
        if (!downloaded) return false

        val sourceDir = java.nio.file.Path.of("./templates").resolve(group).resolve(name)
        if (!java.nio.file.Files.exists(sourceDir)) return false

        java.nio.file.Files.walk(sourceDir).use { stream ->
            stream.forEach { srcPath ->
                val relative = sourceDir.relativize(srcPath)
                val destPath = targetDir.resolve(relative)

                if (java.nio.file.Files.isDirectory(srcPath)) {
                    if (!java.nio.file.Files.exists(destPath)) {
                        java.nio.file.Files.createDirectories(destPath)
                    }
                } else {
                    if (overwrite || !java.nio.file.Files.exists(destPath)) {
                        val parent = destPath.parent
                        if (parent != null && !java.nio.file.Files.exists(parent)) {
                            java.nio.file.Files.createDirectories(parent)
                        }
                        java.nio.file.Files.copy(
                            srcPath,
                            destPath,
                            java.nio.file.StandardCopyOption.REPLACE_EXISTING
                        )
                    }
                }
            }
        }
        return true
    }
}
