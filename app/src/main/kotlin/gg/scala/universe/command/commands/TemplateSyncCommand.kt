package gg.scala.universe.command.commands

import com.google.inject.Inject
import com.google.inject.Singleton
import gg.scala.universe.command.CommandSource
import gg.scala.universe.command.ConsoleCommandSource
import gg.scala.universe.template.TemplateSyncService
import org.incendo.cloud.annotations.Argument
import org.incendo.cloud.annotations.Command

/**
 * Cloud v2 annotated command for syncing templates between cluster nodes.
 *
 * Usage:
 * - template sync <pattern> <targetNode>
 *
 * Patterns:
 * - default/server   → sync single template
 * - default/(*)        → sync all templates in group "default"
 * - *                → sync all templates in all groups
 */
@Singleton
class TemplateSyncCommand @Inject constructor(
    private val templateSyncService: TemplateSyncService,
    private val consoleSource: ConsoleCommandSource
) {

    @Command("template sync <pattern> <targetNode>")
    fun sync(
        source: CommandSource,
        @Argument("pattern") pattern: String,
        @Argument("targetNode") targetNode: String
    ) {
        val templates = templateSyncService.resolveTemplates(pattern)

        if (templates.isEmpty()) {
            source.sendMessage("No templates found matching pattern: $pattern")
            return
        }

        val details = mutableListOf<String>()
        var successCount = 0
        var failCount = 0

        for ((group, name) in templates) {
            val success = templateSyncService.syncTemplate(group, name, targetNode)
            if (success) {
                successCount++
                details.add("Synced $group/$name to $targetNode")
            } else {
                failCount++
                details.add("Failed to sync $group/$name to $targetNode")
            }
        }

        source.sendMessage("Template sync complete: $successCount succeeded, $failCount failed")
        if (details.isNotEmpty()) {
            source.sendMessage(details)
        }
    }
}
