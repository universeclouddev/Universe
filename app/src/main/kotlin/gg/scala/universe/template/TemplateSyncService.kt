package gg.scala.universe.template

import com.google.inject.Inject
import com.google.inject.Singleton
import com.hazelcast.core.HazelcastInstance
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.hz.ClusterStateService
import gg.scala.universe.hz.task.UniverseCallableTask
import gg.scala.universe.task.TemplateSyncTask
import gg.scala.universe.util.json.Serializers
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.nio.file.Files
import java.nio.file.Path
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream
import kotlin.io.path.exists
import kotlin.io.path.isDirectory
import kotlin.io.path.name

/**
 * Handles syncing template directories between cluster nodes via Hazelcast
 * [IExecutorService]. Supports zipping/unzipping and wildcard-based template
 * resolution.
 */
@Singleton
class TemplateSyncService @Inject constructor(
    private val hazelcastInstance: HazelcastInstance,
    private val clusterStateService: ClusterStateService
) : TemplateResolver {

    private val templatesDir = Path.of("./templates")
    private val executorService by lazy {
        hazelcastInstance.getExecutorService("universe-executor")
    }

    /**
     * Zips the template directory `./templates/<group>/<name>/` and dispatches
     * it to [targetNodeId] via Hazelcast [IExecutorService].
     *
     * The target member is resolved by matching [targetNodeId] against
     * Hazelcast member attributes (falling back to member UUID).
     *
     * @return `true` if the task was dispatched successfully.
     */
    fun syncTemplate(group: String, name: String, targetNodeId: String): Boolean {
        val sourceDir = templatesDir.resolve(group).resolve(name)
        if (!sourceDir.exists() || !sourceDir.isDirectory()) {
            log("Template directory not found: $sourceDir", LogLevel.WARNING)
            return false
        }

        val targetMember = hazelcastInstance.cluster.members.firstOrNull { member ->
            member.getAttribute("nodeId") == targetNodeId || member.uuid.toString() == targetNodeId
        }

        if (targetMember == null) {
            log("Target node $targetNodeId not found in cluster", LogLevel.WARNING)
            return false
        }

        return try {
            val zipBytes = zipDirectory(sourceDir)
            val task = TemplateSyncTask(
                group = group,
                name = name,
                templateZipBytes = zipBytes
            )
            val payload = Serializers.GSON.toJson(task)
            executorService.submitToMember(
                UniverseCallableTask(payload),
                targetMember
            )
            log(
                "Dispatched template sync for $group/$name to node $targetNodeId",
                LogLevel.INFO
            )
            true
        } catch (e: Exception) {
            log(
                "Failed to sync template $group/$name to node $targetNodeId: ${e.message}",
                LogLevel.ERROR
            )
            false
        }
    }

    /**
     * Receives a [TemplateSyncTask] and extracts its [TemplateSyncTask.templateZipBytes]
     * into `./templates/<task.group>/<task.name>/`.
     *
     * @return `true` if extraction succeeded.
     */
    fun receiveSync(task: TemplateSyncTask): Boolean {
        val bytes = task.templateZipBytes
        if (bytes == null) {
            log(
                "Received template sync task with null bytes for ${task.group}/${task.name}",
                LogLevel.WARNING
            )
            return false
        }

        val targetDir = templatesDir.resolve(task.group).resolve(task.name)
        return try {
            unzipDirectory(bytes, targetDir)
            log(
                "Received and extracted template ${task.group}/${task.name}",
                LogLevel.SUCCESS
            )
            true
        } catch (e: Exception) {
            log(
                "Failed to extract template ${task.group}/${task.name}: ${e.message}",
                LogLevel.ERROR
            )
            false
        }
    }

    /**
     * Syncs all templates matching the given [pattern] to all other cluster nodes.
     */
    fun syncTemplates(pattern: String) {
        val templates = resolveTemplates(pattern)
        val otherMembers = hazelcastInstance.cluster.members.filter { it != hazelcastInstance.cluster.localMember }
        templates.forEach { (group, name) ->
            otherMembers.forEach { member ->
                val nodeId = member.uuid.toString()
                syncTemplate(group, name, nodeId)
            }
        }
    }

    /**
     * Resolves template directories matching the given [pattern].
     *
     * Supported patterns:
     * - `*`          → all templates in all groups
     * - `group/ *`    → all templates in the specified group
     * - `group/name` → a single template
     *
     * @return A list of `(group, name)` pairs.
     */
    override fun resolveTemplates(pattern: String): List<Pair<String, String>> {
        val results = mutableListOf<Pair<String, String>>()

        when {
            pattern == "*" -> {
                if (templatesDir.exists() && templatesDir.isDirectory()) {
                    Files.list(templatesDir).use { groupStream ->
                        groupStream
                            .filter { it.isDirectory() }
                            .forEach { groupDir ->
                                Files.list(groupDir).use { templateStream ->
                                    templateStream
                                        .filter { it.isDirectory() }
                                        .forEach { results.add(groupDir.name to it.name) }
                                }
                            }
                    }
                }
            }

            pattern.endsWith("/*") -> {
                val group = pattern.removeSuffix("/*")
                val groupDir = templatesDir.resolve(group)
                if (groupDir.exists() && groupDir.isDirectory()) {
                    Files.list(groupDir).use { stream ->
                        stream
                            .filter { it.isDirectory() }
                            .forEach { results.add(group to it.name) }
                    }
                }
            }

            else -> {
                val parts = pattern.split("/")
                if (parts.size == 2) {
                    val (group, name) = parts
                    val templateDir = templatesDir.resolve(group).resolve(name)
                    if (templateDir.exists() && templateDir.isDirectory()) {
                        results.add(group to name)
                    }
                }
            }
        }

        return results
    }

    /**
     * Recursively zips the contents of [source] into a [ByteArray].
     */
    fun zipDirectory(source: Path): ByteArray {
        val output = ByteArrayOutputStream()
        ZipOutputStream(output).use { zos ->
            Files.walk(source).use { stream ->
                stream.forEach { path ->
                    if (path.isDirectory()) {
                        return@forEach
                    }

                    val relative = source.relativize(path).toString().replace("\\", "/")
                    zos.putNextEntry(ZipEntry(relative))
                    Files.copy(path, zos)
                    zos.closeEntry()
                }
            }
        }
        return output.toByteArray()
    }

    /**
     * Extracts [zipBytes] into [target], creating directories as needed.
     * Guards against zip-slip path traversal attacks.
     */
    fun unzipDirectory(zipBytes: ByteArray, target: Path) {
        ByteArrayInputStream(zipBytes).use { bais ->
            ZipInputStream(bais).use { zis ->
                var entry = zis.nextEntry
                while (entry != null) {
                    val entryPath = target.resolve(entry.name).normalize()
                    if (!entryPath.startsWith(target)) {
                        log(
                            "Skipping zip entry with path traversal: ${entry.name}",
                            LogLevel.WARNING
                        )
                        entry = zis.nextEntry
                        continue
                    }

                    if (entry.isDirectory) {
                        Files.createDirectories(entryPath)
                    } else {
                        Files.createDirectories(entryPath.parent)
                        Files.copy(zis, entryPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING)
                    }
                    zis.closeEntry()
                    entry = zis.nextEntry
                }
            }
        }
    }
}
