package gg.scala.universe.template

import com.google.inject.Inject
import com.google.inject.Singleton
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import gg.scala.universe.config.UniverseMainConfiguration
import gg.scala.universe.schema.Configuration
import gg.scala.universe.schema.Template
import gg.scala.universe.schema.TemplateInstallationConfig
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import kotlin.io.path.copyTo
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
    private val mainConfiguration: UniverseMainConfiguration,
    private val variableRegistry: TemplateVariableRegistry
) {

    private val templatesDir = Path.of("./templates")

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
            log("No templates to install for configuration '${configuration.name}'", LogType.WARNING)
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

        log("Installing ${sorted.size} template(s) for instance $instanceId (override=${config.onTemplatePasteOverridePresentFiles})", LogType.INFORMATION)

        sorted.forEach { template ->
            val sourceDir = templatesDir.resolve(template.group).resolve(template.name)
            if (!sourceDir.exists() || !sourceDir.isDirectory()) {
                log("Template directory not found: $sourceDir", LogType.WARNING)
                return@forEach
            }

            copyDirectory(sourceDir, targetDir, config.onTemplatePasteOverridePresentFiles)
            log("Pasted template '${template.name}' from group '${template.group}'", LogType.INFORMATION)
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
        }

        // oneOf: pick exactly one from the list (highest priority wins, tiebreak random)
        if (config.oneOf.isNotEmpty()) {
            val pick = config.oneOf.maxByOrNull { it.priority }
                ?: config.oneOf.random()
            selected.add(pick)
        }

        // oneInGroups: pick one template from each group (highest priority wins, tiebreak random)
        config.oneInGroups.forEach { group ->
            val groupDir = templatesDir.resolve(group)
            if (groupDir.exists() && groupDir.isDirectory()) {
                val candidates = Files.list(groupDir).use { stream ->
                    stream.filter { it.isDirectory() }
                        .map { dir ->
                            Template(
                                name = dir.name,
                                group = group,
                                storage = "local",
                                priority = 0
                            )
                        }
                        .toList()
                }
                if (candidates.isNotEmpty()) {
                    val pick = candidates.maxByOrNull { it.priority }
                        ?: candidates.random()
                    selected.add(pick)
                }
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
                log("File for modification not found: $file", LogType.WARNING)
                return@forEach
            }

            try {
                var content = file.readText()
                variables.forEach { (placeholder, value) ->
                    content = content.replace(placeholder, value)
                }
                file.writeText(content)
                log("Applied variable replacements to $relativePath", LogType.INFORMATION)
            } catch (e: Exception) {
                log("Failed to modify file $relativePath: ${e.message}", LogType.ERROR)
            }
        }
    }

    /**
     * Builds the placeholder → value map for variable replacement.
     *
     * Combines built-in variables with those provided by registered [TemplateVariableProvider]s.
     */
    private fun buildVariableMap(
        configuration: Configuration,
        instanceId: String,
        allocatedPort: Int
    ): Map<String, String> {
        val builtIn = mapOf(
            "%PORT%" to allocatedPort.toString(),
            "%INSTANCE_ID%" to instanceId,
            "%MASTER_IP%" to mainConfiguration.masterAddress,
            "%MASTER_ADDRESS%" to mainConfiguration.masterAddress,
            "%MASTER_PORT%" to mainConfiguration.masterPort.toString(),
            "%MASTER_API_PORT%" to mainConfiguration.masterApiPort.toString(),
            "%NODE_ID%" to mainConfiguration.nodeId,
            "%HOST_ADDRESS%" to configuration.hostAddress,
            "%CONFIGURATION_NAME%" to configuration.name,
        )

        val custom = variableRegistry.collectVariables()

        // Custom variables take precedence over built-in ones
        return builtIn + custom
    }
}
