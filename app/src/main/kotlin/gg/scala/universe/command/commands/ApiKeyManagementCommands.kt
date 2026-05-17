package gg.scala.universe.command.commands

import com.google.inject.Inject
import com.google.inject.Singleton
import gg.scala.universe.command.CommandSource
import gg.scala.universe.console.Ansi
import gg.scala.universe.console.Ansi.MUTED_GRAY as GRAY
import gg.scala.universe.db.DatabaseProvider
import gg.scala.universe.schema.ApiKey
import gg.scala.universe.schema.ApiPermission
import org.incendo.cloud.annotations.Argument
import org.incendo.cloud.annotations.Command
import org.incendo.cloud.annotations.CommandDescription
import java.util.UUID

/**
 * Cloud v2 annotated commands for managing REST API keys.
 *
 * Usage:
 * - key list
 * - key create <keyId> <permission>
 * - key delete <keyId>
 */
@Singleton
class ApiKeyManagementCommands @Inject constructor(
    private val database: DatabaseProvider
) {

    @Command("key list")
    @CommandDescription("List all registered API keys")
    fun listKeys(source: CommandSource) {
        val keys = database.listApiKeys()

        if (keys.isEmpty()) {
            source.sendMessage("${Ansi.YELLOW}→${Ansi.RESET} No API keys registered.")
            return
        }

        source.sendMessage("${Ansi.CYAN}API Keys (${keys.size}):${Ansi.RESET}")
        keys.forEach { key ->
            val maskedToken = maskToken(key.token)
            val permColor = if (key.permission == ApiPermission.ALL) Ansi.GREEN else Ansi.YELLOW
            source.sendMessage("  ${GRAY}- ${Ansi.WHITE}${key.keyId}${GRAY} | ${permColor}${key.permission}${GRAY} | ${Ansi.WHITE}$maskedToken${Ansi.RESET}")
        }
    }

    @Command("key create <keyId> <permission>")
    @CommandDescription("Create a new API key with the specified permission level (ALL or PUBLIC)")
    fun createKey(
        source: CommandSource,
        @Argument("keyId") keyId: String,
        @Argument("permission") permissionStr: String
    ) {
        val permission = when (permissionStr.uppercase()) {
            "ALL" -> ApiPermission.ALL
            "PUBLIC" -> ApiPermission.PUBLIC
            else -> {
                source.sendMessage("${Ansi.RED}✗${Ansi.RESET} Invalid permission: $permissionStr. Must be ALL or PUBLIC.")
                return
            }
        }

        val existing = database.getApiKeyById(keyId)
        if (existing != null) {
            source.sendMessage("${Ansi.RED}✗${Ansi.RESET} API key '$keyId' already exists.")
            return
        }

        val token = generateToken()
        val apiKey = ApiKey(keyId, token, permission)
        database.saveApiKey(apiKey)

        source.sendMessage("${Ansi.GREEN}✓${Ansi.RESET} API key created:")
        source.sendMessage("  ${GRAY}ID: ${Ansi.WHITE}${keyId}${Ansi.RESET}")
        source.sendMessage("  ${GRAY}Permission: ${Ansi.WHITE}${permission}${Ansi.RESET}")
        source.sendMessage("  ${GRAY}Token: ${Ansi.CYAN}${token}${Ansi.RESET}")
        source.sendMessage("  ${Ansi.YELLOW}→${Ansi.RESET} Save this token now — it cannot be retrieved later.")
    }

    @Command("key delete <keyId>")
    @CommandDescription("Delete an API key by its ID")
    fun deleteKey(
        source: CommandSource,
        @Argument("keyId") keyId: String
    ) {
        val existing = database.getApiKeyById(keyId)
        if (existing == null) {
            source.sendMessage("${Ansi.RED}✗${Ansi.RESET} API key '$keyId' not found.")
            return
        }

        database.deleteApiKey(keyId)
        source.sendMessage("${Ansi.GREEN}✓${Ansi.RESET} API key '${Ansi.WHITE}$keyId${Ansi.RESET}' deleted.")
    }

    private fun maskToken(token: String): String {
        if (token.length <= 8) return "****"
        return token.take(4) + "..." + token.takeLast(4)
    }

    private fun generateToken(): String {
        return "unv_" + UUID.randomUUID().toString().replace("-", "")
    }
}
