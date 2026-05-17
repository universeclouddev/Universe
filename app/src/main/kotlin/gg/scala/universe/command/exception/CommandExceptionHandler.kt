package gg.scala.universe.command.exception

import com.google.inject.Inject
import com.google.inject.Singleton
import gg.scala.universe.command.CommandProvider
import gg.scala.universe.command.CommandSource
import gg.scala.universe.console.Ansi
import gg.scala.universe.console.Ansi.MUTED_GRAY as GRAY
import org.incendo.cloud.component.CommandComponent
import org.incendo.cloud.exception.*
import org.incendo.cloud.parser.flag.CommandFlagParser
import org.slf4j.LoggerFactory
import java.util.concurrent.CompletionException

/**
 * Handles Cloud command execution exceptions with user-friendly output.
 *
 * Replaces raw stack traces with styled error messages, usage hints,
 * and command suggestions.
 */
@Singleton
class CommandExceptionHandler @Inject constructor(
    private val commandProvider: CommandProvider
) {

    private val logger = LoggerFactory.getLogger(CommandExceptionHandler::class.java)

    /**
     * Handles a command execution exception, printing a user-friendly message
     * to the command source and logging the full stack trace at DEBUG level.
     */
    fun handle(source: CommandSource, cause: Throwable?) {
        if (cause == null) return

        // Unwrap CompletionException
        val rootCause = if (cause is CompletionException) cause.cause ?: cause else cause

        when (rootCause) {
            is NoSuchCommandException -> handleNoSuchCommand(source, rootCause)
            is InvalidSyntaxException -> handleInvalidSyntax(source, rootCause)
            is ArgumentParseException -> handleArgumentParse(source, rootCause)
            is NoPermissionException -> handleNoPermission(source, rootCause)
            is CommandExecutionException -> handleCommandExecution(source, rootCause)
            else -> handleUnknown(source, rootCause)
        }
    }

    private fun handleNoSuchCommand(source: CommandSource, ex: NoSuchCommandException) {
        val input = ex.suppliedCommand()
        val firstWord = input.split(" ").firstOrNull() ?: ""

        // Try to find similar commands
        val similar = findSimilarCommands(firstWord)

        val message = buildString {
            append("${Ansi.RED}✗${Ansi.RESET} Unknown command: ${Ansi.WHITE}'$input'${Ansi.RESET}")
            if (similar.isNotEmpty()) {
                append("\n${Ansi.YELLOW}→${Ansi.RESET} Did you mean: ${Ansi.CYAN}${similar.joinToString(", ")}${Ansi.RESET}?")
            }
            if (firstWord.isNotEmpty()) {
                val usage = getCommandUsage(firstWord)
                if (usage.isNotEmpty()) {
                    append("\n${Ansi.YELLOW}→${Ansi.RESET} Available subcommands:")
                    usage.forEach { append("\n  ${GRAY}- ${Ansi.WHITE}$it${Ansi.RESET}") }
                }
            }
        }

        source.sendMessage(message)
    }

    private fun handleInvalidSyntax(source: CommandSource, ex: InvalidSyntaxException) {
        val chain = ex.currentChain()
        val usage = collectCommandUsage(chain)

        val message = buildString {
            append("${Ansi.RED}✗${Ansi.RESET} Invalid command syntax")
            if (usage.isNotEmpty()) {
                append("\n${Ansi.YELLOW}→${Ansi.RESET} Usage:")
                usage.forEach { append("\n  ${GRAY}- ${Ansi.WHITE}$it${Ansi.RESET}") }
            } else {
                append("\n${Ansi.YELLOW}→${Ansi.RESET} Correct syntax: ${Ansi.WHITE}${ex.correctSyntax()}${Ansi.RESET}")
            }
        }

        source.sendMessage(message)
    }

    private fun handleArgumentParse(source: CommandSource, ex: ArgumentParseException) {
        when (val deepCause = ex.cause) {
            is CommandFlagParser.FlagParseException -> {
                val reason = deepCause.failureReason()
                val message = when (reason) {
                    CommandFlagParser.FailureReason.NO_FLAG_STARTED -> {
                        val chain = ex.currentChain()
                        val usage = collectCommandUsage(chain)
                        buildString {
                            append("${Ansi.RED}✗${Ansi.RESET} Invalid flag syntax")
                            if (usage.isNotEmpty()) {
                                append("\n${Ansi.YELLOW}→${Ansi.RESET} Usage:")
                                usage.forEach { append("\n  ${GRAY}- ${Ansi.WHITE}$it${Ansi.RESET}") }
                            }
                        }
                    }
                    else -> "${Ansi.RED}✗${Ansi.RESET} ${deepCause.message}"
                }
                source.sendMessage(message)
            }
            is IllegalArgumentException -> {
                source.sendMessage("${Ansi.RED}✗${Ansi.RESET} ${deepCause.message}")
            }
            else -> {
                logger.debug("Argument parse error", deepCause)
                source.sendMessage("${Ansi.RED}✗${Ansi.RESET} Invalid argument: ${deepCause?.message ?: "unknown error"}")
            }
        }
    }

    private fun handleNoPermission(source: CommandSource, ex: NoPermissionException) {
        source.sendMessage("${Ansi.RED}✗${Ansi.RESET} You do not have permission to execute this command.")
    }

    private fun handleCommandExecution(source: CommandSource, ex: CommandExecutionException) {
        val cause = ex.cause
        val commandName = try {
            ex.context()?.command()?.rootComponent()?.name() ?: "unknown"
        } catch (_: Exception) {
            "unknown"
        }
        logger.error("Error executing command '$commandName'", cause)
        source.sendMessage("${Ansi.RED}✗${Ansi.RESET} Command failed: ${cause?.message ?: "internal error"}")
    }

    private fun handleUnknown(source: CommandSource, cause: Throwable) {
        logger.error("Unexpected command error", cause)
        source.sendMessage("${Ansi.RED}✗${Ansi.RESET} ${cause.message ?: "An unexpected error occurred"}")
    }

    // ---- Helpers ----

    private fun findSimilarCommands(input: String): List<String> {
        if (input.isBlank()) return emptyList()
        val allCommands = commandProvider.commands()
        return allCommands
            .map { it.name }
            .filter { name ->
                levenshteinDistance(input.lowercase(), name.lowercase()) <= 2
            }
            .sortedBy { name ->
                levenshteinDistance(input.lowercase(), name.lowercase())
            }
            .take(3)
    }

    private fun getCommandUsage(root: String): List<String> {
        return try {
            val info = commandProvider.command(root)
            info.usage
        } catch (_: NullPointerException) {
            emptyList()
        }
    }

    private fun collectCommandUsage(chain: List<CommandComponent<*>>): List<String> {
        if (chain.isEmpty()) return emptyList()

        val root = chain.first().name()
        return try {
            val info = commandProvider.command(root)
            if (chain.size == 1) {
                // Show all usage for the root command
                info.usage
            } else {
                // Show usage matching the partial chain
                val chainPrefix = chain.joinToString(" ") { it.name() }
                val matching = info.usage.filter { it.startsWith(chainPrefix) }
                matching.ifEmpty { info.usage }
            }
        } catch (_: NullPointerException) {
            emptyList()
        }
    }

    private fun levenshteinDistance(s1: String, s2: String): Int {
        val dp = Array(s1.length + 1) { IntArray(s2.length + 1) }
        for (i in 0..s1.length) dp[i][0] = i
        for (j in 0..s2.length) dp[0][j] = j
        for (i in 1..s1.length) {
            for (j in 1..s2.length) {
                val cost = if (s1[i - 1] == s2[j - 1]) 0 else 1
                dp[i][j] = minOf(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + cost
                )
            }
        }
        return dp[s1.length][s2.length]
    }
}
