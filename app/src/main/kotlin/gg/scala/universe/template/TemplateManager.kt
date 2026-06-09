package gg.scala.universe.template

import com.google.inject.Inject
import com.google.inject.Singleton
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.schema.Configuration
import gg.scala.universe.schema.Template
import gg.scala.universe.schema.TemplateInstallationConfig
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import kotlin.io.path.copyTo
import kotlin.io.path.createDirectories
import kotlin.io.path.createDirectory
import kotlin.io.path.exists
import kotlin.io.path.isDirectory
import kotlin.io.path.name
import kotlin.io.path.readText
import kotlin.io.path.writeText
import kotlin.random.Random

/**
 * Resolves, copies, and modifies template files for instance deployment.
 *
 * Templates live under `./templates/<group>/<name>/`.
 * The paste order depends on [TemplateInstallationConfig.onTemplatePasteOverridePresentFiles]:
 * - When **true**: higher-priority templates are pasted **last** and **overwrite** existing files.
 * - When **false**: higher-priority templates are pasted **first** and **do not overwrite** existing files.
 */
@Singleton
class TemplateManager @Inject constructor(
    private val variableRegistry: TemplateVariableRegistry,
    private val storageRegistry: TemplateStorageRegistry
) {

    private val templatesDir = Path.of("./templates")

    init {
        if (!Files.exists(templatesDir)) {
            templatesDir.createDirectories()
            templatesDir.resolve("default/server").createDirectories()
        }
    }

    /**
     * Installs all applicable templates for the given [configuration] into [targetDir].
     *
     * After copying, applies variable replacement to files listed in
     * [Configuration.fileModifications].
     */
    fun installTemplates(
        configuration: Configuration,
        instanceId: String,
        allocatedPort: Int,
        targetDir: Path
    ) {
        val config = configuration.templateInstallationConfig
        val selectedTemplates = resolveTemplates(config)

        if (selectedTemplates.isEmpty()) {
            log("No templates to install for configuration '${configuration.name}'", LogLevel.WARNING)
            return
        }

        // Sort by priority based on override behavior
        val sorted = if (config.onTemplatePasteOverridePresentFiles) {
            // Lower priority first, higher priority last (so they overwrite)
            selectedTemplates.sortedBy { it.priority }
        } else {
            // Higher priority first (so they are preserved and not overwritten)
            selectedTemplates.sortedByDescending { it.priority }
        }

        log("Installing ${sorted.size} template(s) for instance $instanceId (override=${config.onTemplatePasteOverridePresentFiles})")

        sorted.forEach { template ->
            if (template.storage != "local") {
                // Non-local templates are extracted directly into the running folder
                // to avoid polluting ./templates/ and to allow local+remote templates
                // with the same group/name to coexist.
                val provider = storageRegistry.get(template.storage)
                if (provider != null) {
                    val success = provider.extractTemplate(
                        template.group,
                        template.name,
                        targetDir,
                        config.onTemplatePasteOverridePresentFiles
                    )
                    if (success) {
                        log("Extracted template '${template.name}' from group '${template.group}' (storage=${template.storage})")
                    } else {
                        log("Failed to extract template ${template.group}/${template.name} from storage '${template.storage}'", LogLevel.WARNING)
                    }
                } else {
                    log("No storage provider found for '${template.storage}', skipping template ${template.group}/${template.name}", LogLevel.WARNING)
                }
            } else {
                // Local templates are copied from ./templates/<group>/<name>/
                val sourceDir = templatesDir.resolve(template.group).resolve(template.name)
                if (!sourceDir.exists() || !sourceDir.isDirectory()) {
                    log("Template directory not found: $sourceDir", LogLevel.WARNING)
                    return@forEach
                }

                copyDirectory(sourceDir, targetDir, config.onTemplatePasteOverridePresentFiles)
                log("Pasted template '${template.name}' from group '${template.group}'")
            }
        }

        // Apply variable replacement
        applyVariableReplacements(configuration, instanceId, allocatedPort, targetDir)
    }

    /**
     * Resolves which templates should be installed based on the [config].
     */
    private fun resolveTemplates(config: TemplateInstallationConfig): List<Template> {
        val selected = mutableListOf<Template>()

        // allOf: include every listed template
        selected.addAll(config.allOf)

        // allInGroups: include every template found in those group directories
        config.allInGroups.forEach { group ->
            // Discover from local filesystem
            val groupDir = templatesDir.resolve(group)
            if (groupDir.exists() && groupDir.isDirectory()) {
                Files.list(groupDir).use { stream ->
                    stream.filter { it.isDirectory() }
                        .map { dir ->
                            Template(
                                name = dir.name,
                                group = group,
                                storage = "local",
                                priority = 0
                            )
                        }
                        .forEach { selected.add(it) }
                }
            }
            // Discover from registered storage providers
            storageRegistry.getAll().values.forEach { provider ->
                provider.listTemplates(group).forEach { name ->
                    selected.add(Template(name = name, group = group, storage = provider.storageKey, priority = 0))
                }
            }
        }

        // oneOf: pick exactly one from the list (highest priority wins, tiebreak random)
        if (config.oneOf.isNotEmpty()) {
            val pick = config.oneOf.random()
            selected.add(pick)
        }

        // oneInGroups: pick one template from each group (highest priority wins, tiebreak random)
        config.oneInGroups.forEach { group ->
            val candidates = mutableListOf<Template>()
            // Local templates
            val groupDir = templatesDir.resolve(group)
            if (groupDir.exists() && groupDir.isDirectory()) {
                Files.list(groupDir).use { stream ->
                    stream.filter { it.isDirectory() }
                        .map { dir ->
                            Template(
                                name = dir.name,
                                group = group,
                                storage = "local",
                                priority = 0
                            )
                        }
                        .forEach { candidates.add(it) }
                }
            }
            // Storage provider templates
            storageRegistry.getAll().values.forEach { provider ->
                provider.listTemplates(group).forEach { name ->
                    candidates.add(Template(name = name, group = group, storage = provider.storageKey, priority = 0))
                }
            }
            if (candidates.isNotEmpty()) {
                val pick = candidates.random()
                selected.add(pick)
            }
        }

        return selected
    }

    /**
     * Recursively copies files from [source] into [target].
     *
     * @param overwrite If true, existing files will be replaced.
     */
    private fun copyDirectory(source: Path, target: Path, overwrite: Boolean) {
        Files.walk(source).use { stream ->
            stream.forEach { srcPath ->
                val relative = source.relativize(srcPath)
                val destPath = target.resolve(relative)

                if (srcPath.isDirectory()) {
                    if (!destPath.exists()) {
                        Files.createDirectories(destPath)
                    }
                } else {
                    if (overwrite || !destPath.exists()) {
                        if (!destPath.parent.exists()) {
                            Files.createDirectories(destPath.parent)
                        }
                        srcPath.copyTo(destPath, overwrite = true)
                    }
                }
            }
        }
    }

    /**
     * Reads the files specified in [Configuration.fileModifications] and replaces
     * known placeholders with actual runtime values.
     */
    private fun applyVariableReplacements(
        configuration: Configuration,
        instanceId: String,
        allocatedPort: Int,
        targetDir: Path
    ) {
        if (configuration.fileModifications.isEmpty()) return

        val variables = buildVariableMap(configuration, instanceId, allocatedPort)

        configuration.fileModifications.forEach { relativePath ->
            val file = targetDir.resolve(relativePath)
            if (!file.exists()) {
                log("File for modification not found: $file", LogLevel.WARNING)
                return@forEach
            }

            try {
                var content = file.readText()
                variables.forEach { (placeholder, value) ->
                    content = content.replace(placeholder, value)
                }
                file.writeText(content)
                log("Applied variable replacements to $relativePath")
            } catch (e: Exception) {
                log("Failed to modify file $relativePath: ${e.message}", LogLevel.ERROR)
            }
        }
    }

    /**
     * Builds the placeholder → value map for variable replacement.
     *
     * Delegates to the [TemplateVariableRegistry] which aggregates variables
     * from all registered providers, including [DefaultTemplateVariableProvider].
     * Providers registered later override earlier ones.
     */
    private fun buildVariableMap(
        configuration: Configuration,
        instanceId: String,
        allocatedPort: Int
    ): Map<String, String> {
        return variableRegistry.collectVariables(configuration, instanceId, allocatedPort)
    }

    /**
     * Lists all local templates under `./templates/`.
     *
     * @return A list of [Template] objects discovered from the filesystem.
     */
    fun listAllTemplates(): List<Template> {
        val results = mutableListOf<Template>()
        if (!templatesDir.exists() || !templatesDir.isDirectory()) {
            return results
        }
        Files.list(templatesDir).use { groupStream ->
            groupStream.filter { it.isDirectory() }.forEach { groupDir ->
                Files.list(groupDir).use { templateStream ->
                    templateStream.filter { it.isDirectory() }.forEach { templateDir ->
                        results.add(
                            Template(
                                name = templateDir.name,
                                group = groupDir.name,
                                storage = "local",
                                priority = 0
                            )
                        )
                    }
                }
            }
        }
        return results
    }

    /**
     * Returns the filesystem path for a template.
     */
    fun getTemplatePath(group: String, name: String): Path {
        return templatesDir.resolve(group).resolve(name)
    }

    /**
     * Lists all files within a local template directory recursively.
     *
     * @return List of relative file paths (e.g. "server.properties", "plugins/config.yml").
     */
    fun listTemplateFiles(group: String, name: String): List<String> {
        val dir = getTemplatePath(group, name)
        if (!dir.exists() || !dir.isDirectory()) return emptyList()

        val files = mutableListOf<String>()
        Files.walk(dir).use { stream ->
            stream.filter { !it.isDirectory() }.forEach { file ->
                files.add(dir.relativize(file).toString().replace("\\", "/"))
            }
        }
        return files
    }

    /**
     * Reads the contents of a file within a local template.
     *
     * @return File contents as a string, or null if the file doesn't exist.
     */
    fun readTemplateFile(group: String, name: String, relativePath: String): String? {
        val file = getTemplatePath(group, name).resolve(relativePath)
        return if (file.exists() && !file.isDirectory()) file.readText() else null
    }

    /**
     * Writes contents to a file within a local template.
     * Creates parent directories if needed.
     *
     * @return true if the write succeeded.
     */
    fun writeTemplateFile(group: String, name: String, relativePath: String, content: String): Boolean {
        return try {
            val file = getTemplatePath(group, name).resolve(relativePath)
            file.parent?.createDirectories()
            file.writeText(content)
            true
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Creates a new file within a local template.
     * Fails if the file already exists.
     *
     * @return true if the file was created.
     */
    fun createTemplateFile(group: String, name: String, relativePath: String, content: String): Boolean {
        return try {
            val file = getTemplatePath(group, name).resolve(relativePath)
            if (file.exists()) return false
            file.parent?.createDirectories()
            file.writeText(content)
            true
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Deletes a file within a local template.
     *
     * @return true if the file was deleted (or didn't exist).
     */
    fun deleteTemplateFile(group: String, name: String, relativePath: String): Boolean {
        return try {
            val file = getTemplatePath(group, name).resolve(relativePath)
            if (file.exists() && !file.isDirectory()) {
                Files.delete(file)
            }
            true
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Exports a local template as a zip byte array.
     *
     * @return Zip bytes, or null if the template doesn't exist.
     */
    fun exportTemplate(group: String, name: String): ByteArray? {
        val dir = getTemplatePath(group, name)
        if (!dir.exists() || !dir.isDirectory()) return null

        val baos = java.io.ByteArrayOutputStream()
        java.util.zip.ZipOutputStream(baos).use { zos ->
            Files.walk(dir).use { stream ->
                stream.filter { !it.isDirectory() }.forEach { file ->
                    val relativePath = dir.relativize(file).toString().replace("\\", "/")
                    zos.putNextEntry(java.util.zip.ZipEntry(relativePath))
                    java.nio.file.Files.copy(file, zos)
                    zos.closeEntry()
                }
            }
        }
        return baos.toByteArray()
    }

    /**
     * Imports a template from a zip byte array.
     * Overwrites existing files.
     *
     * @return true if the import succeeded.
     */
    fun importTemplate(group: String, name: String, zipBytes: ByteArray): Boolean {
        return try {
            val dir = getTemplatePath(group, name)
            dir.createDirectories()

            java.io.ByteArrayInputStream(zipBytes).use { bais ->
                java.util.zip.ZipInputStream(bais).use { zis ->
                    var entry = zis.nextEntry
                    while (entry != null) {
                        if (entry.isDirectory) {
                            entry = zis.nextEntry
                            continue
                        }
                        // Security: prevent path traversal
                        val entryName = entry.name.replace("\\", "/")
                        if (entryName.contains("..") || entryName.startsWith("/")) {
                            entry = zis.nextEntry
                            continue
                        }
                        val outFile = dir.resolve(entryName)
                        outFile.parent?.createDirectories()
                        java.nio.file.Files.copy(zis, outFile, StandardCopyOption.REPLACE_EXISTING)
                        entry = zis.nextEntry
                    }
                }
            }
            true
        } catch (_: Exception) {
            false
        }
    }
}
