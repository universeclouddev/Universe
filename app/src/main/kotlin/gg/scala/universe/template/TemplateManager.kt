package gg.scala.universe.template

import com.google.inject.Inject
import com.google.inject.Singleton
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.schema.Configuration
import gg.scala.universe.schema.Template
import gg.scala.universe.schema.TemplateInstallationConfig
import java.nio.file.Files
import java.nio.file.NoSuchFileException
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.util.zip.ZipInputStream
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
     * Creates an empty local template directory at `./templates/<group>/<name>/`.
     */
    fun createTemplate(group: String, name: String): Path {
        val path = getTemplatePath(group, name)
        if (path.exists()) {
            throw IllegalStateException("Template already exists: $group/$name")
        }
        path.createDirectories()
        return path
    }

    /**
     * Lists all files and directories within a template (relative paths).
     */
    fun listTemplateFiles(group: String, name: String): List<TemplateFileInfo> {
        val root = getTemplatePath(group, name)
        if (!root.exists() || !root.isDirectory()) {
            throw NoSuchFileException(root.toString(), null, "Template not found")
        }

        val results = mutableListOf<TemplateFileInfo>()
        Files.walk(root).use { stream ->
            stream.forEach { path ->
                if (path == root) return@forEach
                val relative = root.relativize(path).toString().replace('\\', '/')
                results.add(
                    TemplateFileInfo(
                        path = relative,
                        type = if (path.isDirectory()) "directory" else "file",
                        size = if (Files.isRegularFile(path)) Files.size(path) else 0L,
                    ),
                )
            }
        }
        return results.sortedBy { it.path }
    }

    /**
     * Reads a file inside a template directory.
     */
    fun readTemplateFile(group: String, name: String, relativePath: String): String {
        val file = resolveTemplateFile(group, name, relativePath)
        if (!file.exists() || file.isDirectory()) {
            throw NoSuchFileException(file.toString(), null, "File not found")
        }
        return file.readText()
    }

    /**
     * Writes a file inside a template directory, creating parent directories as needed.
     */
    fun writeTemplateFile(group: String, name: String, relativePath: String, content: String) {
        val file = resolveTemplateFile(group, name, relativePath)
        file.parent?.createDirectories()
        file.writeText(content)
    }

    /**
     * Extracts a zip archive into `./templates/<group>/<name>/`.
     */
    fun importTemplateZip(group: String, name: String, zipInput: ZipInputStream, overwrite: Boolean = true) {
        val root = getTemplatePath(group, name).toAbsolutePath().normalize()
        root.createDirectories()

        var entry = zipInput.nextEntry
        while (entry != null) {
            if (!entry.isDirectory) {
                val relative = entry.name.replace('\\', '/').trimStart('/')
                if (relative.isNotBlank() && !relative.contains("..")) {
                    val dest = root.resolve(relative).normalize()
                    if (dest.startsWith(root)) {
                        dest.parent?.createDirectories()
                        if (overwrite || !dest.exists()) {
                            Files.copy(zipInput, dest, StandardCopyOption.REPLACE_EXISTING)
                        }
                    }
                }
            }
            zipInput.closeEntry()
            entry = zipInput.nextEntry
        }
    }

    private fun resolveTemplateFile(group: String, name: String, relativePath: String): Path {
        val root = getTemplatePath(group, name).toAbsolutePath().normalize()
        if (!root.exists()) {
            throw NoSuchFileException(root.toString(), null, "Template not found")
        }
        val normalized = relativePath.replace('\\', '/').trimStart('/')
        if (normalized.isBlank() || normalized.contains("..")) {
            throw IllegalArgumentException("Invalid file path")
        }
        val target = root.resolve(normalized).normalize()
        if (!target.startsWith(root)) {
            throw IllegalArgumentException("Path traversal denied")
        }
        return target
    }
}

data class TemplateFileInfo(
    val path: String,
    val type: String,
    val size: Long,
)
