package gg.scala.universe.s3

import com.google.inject.Inject
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import gg.scala.universe.command.CommandSource
import gg.scala.universe.template.TemplateResolver
import org.incendo.cloud.annotations.Argument
import org.incendo.cloud.annotations.Command
import com.google.inject.Singleton

/**
 * Cloud v2 annotated commands for S3 template storage operations.
 *
 * Usage:
 * - s3 upload <pattern>
 * - s3 download <pattern>
 *
 * Patterns:
 * - *                → all templates in all groups
 * - group/(*)          → all templates in the specified group
 * - group/name       → a single template
 */
@Singleton
class S3Commands @Inject constructor(
    private val s3TemplateStorage: S3TemplateStorage,
    private val templateResolver: TemplateResolver
) {

    @Command("s3 upload <pattern>")
    fun upload(
        source: CommandSource,
        @Argument("pattern") pattern: String
    ) {
        val templates = templateResolver.resolveTemplates(pattern)

        if (templates.isEmpty()) {
            source.sendMessage("No templates found matching pattern: $pattern")
            return
        }

        var successCount = 0
        var failCount = 0

        for ((group, name) in templates) {
            source.sendMessage("Uploading template $group/$name to S3...")
            val success = s3TemplateStorage.uploadTemplate(group, name)
            if (success) {
                successCount++
                source.sendMessage("Uploaded $group/$name successfully")
            } else {
                failCount++
                source.sendMessage("Failed to upload $group/$name")
            }
        }

        source.sendMessage("S3 upload complete: $successCount succeeded, $failCount failed")
    }

    @Command("s3 download <pattern>")
    fun download(
        source: CommandSource,
        @Argument("pattern") pattern: String
    ) {
        val templates = templateResolver.resolveTemplates(pattern)

        if (templates.isEmpty()) {
            source.sendMessage("No templates found matching pattern: $pattern")
            return
        }

        var successCount = 0
        var failCount = 0

        for ((group, name) in templates) {
            source.sendMessage("Downloading template $group/$name from S3...")
            val success = s3TemplateStorage.downloadTemplate(group, name)
            if (success) {
                successCount++
                source.sendMessage("Downloaded $group/$name successfully")
            } else {
                failCount++
                source.sendMessage("Failed to download $group/$name")
            }
        }

        source.sendMessage("S3 download complete: $successCount succeeded, $failCount failed")
    }
}
