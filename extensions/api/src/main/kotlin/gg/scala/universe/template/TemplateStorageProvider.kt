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
}
