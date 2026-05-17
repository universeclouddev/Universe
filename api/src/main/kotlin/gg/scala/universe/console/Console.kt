package gg.scala.universe.console

import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Central console output system for Universe.
 * Replaces PrettyLog with a clean, ANSI-styled output that matches
 * the orchestrator aesthetic (see screenshot reference).
 *
 * All output is printed directly to stdout. In environments without
 * ANSI support (e.g., some Windows terminals), colors degrade gracefully
 * to plain text.
 */
object Console {

    private val timeFormatter = DateTimeFormatter.ofPattern("HH:mm:ss")

    // ─── Public Logging API ───

    /** Informational message — blue arrow prefix. */
    fun info(message: String, iconEnabled: Boolean) {
        println(tree("→", Ansi.BLUE, message, iconEnabled = iconEnabled))
    }

    /** Success message — green checkmark prefix. */
    fun success(message: String, iconEnabled: Boolean) {
        println(tree("✓", Ansi.GREEN, message, Ansi.GREEN, iconEnabled))
    }

    /** Warning message — yellow warning prefix. */
    fun warn(message: String, iconEnabled: Boolean) {
        println(tree("⚠", Ansi.YELLOW, message, Ansi.YELLOW, iconEnabled))
    }

    /** Error message — red cross prefix. */
    fun error(message: String, iconEnabled: Boolean) {
        println(tree("✗", Ansi.RED, message, Ansi.RED, iconEnabled))
    }

    /** Debug message — dimmed, only shown when debug is enabled. */
    fun debug(message: String, iconEnabled: Boolean) {
        if (debugEnabled) {
            println(tree("◆", Ansi.DARK_GRAY, message, Ansi.DIM, iconEnabled))
        }
    }

    /** Network message — cyan arrow prefix. */
    fun network(message: String, iconEnabled: Boolean) {
        println(tree("⇄", Ansi.CYAN, message, Ansi.CYAN, iconEnabled))
    }

    /** Plain message with no prefix. */
    fun println(message: String = "") {
        kotlin.io.println(message)
    }

    /** Sub-tree item — indented gray arrow. */
    fun sub(message: String, iconEnabled: Boolean) {
        println("  ${Ansi.DARK_GRAY}↳${Ansi.RESET} $message")
    }

    /** Sub-tree item with a colored label. */
    fun sub(label: String, labelColor: String, message: String) {
        println("  ${Ansi.DARK_GRAY}↳${Ansi.RESET} ${labelColor}${label}${Ansi.RESET} $message" + Ansi.RESET)
    }

    // ─── Styled Output Helpers ───

    /** Renders a status badge with background color. */
    fun badge(text: String, color: String): String {
        return "${color}${Ansi.BOLD}${text}${Ansi.RESET}"
    }

    /** Status badges for instance states. */
    fun running(text: String = "RUNNING") = badge(text, Ansi.BRIGHT_GREEN)
    fun starting(text: String = "STARTING") = badge(text, Ansi.ORANGE)
    fun stopped(text: String = "STOPPED") = badge(text, Ansi.BRIGHT_RED)
    fun offline(text: String = "OFFLINE") = badge(text, Ansi.MUTED_GRAY)
    fun creating(text: String = "CREATING") = badge(text, Ansi.BRIGHT_CYAN)

    /** Formats a section header. */
    fun header(title: String): String {
        return "${Ansi.BOLD}${Ansi.WHITE}${title}${Ansi.RESET}"
    }

    /** Formats a table row with aligned columns.
     *  @param columns List of (text, width) pairs. Text is left-aligned within width.
     */
    fun row(vararg columns: Pair<String, Int>): String {
        return columns.joinToString("  ") { (text, width) ->
            text.padEnd(width)
        }
    }

    /** Formats a table header row (bold white). */
    fun headerRow(vararg columns: Pair<String, Int>): String {
        return columns.joinToString("  ") { (text, width) ->
            "${Ansi.BOLD}${Ansi.WHITE}${text.padEnd(width)}${Ansi.RESET}"
        }
    }

    /** Renders a key-value pair. */
    fun kv(key: String, value: String): String {
        return "${Ansi.DARK_GRAY}${key}:${Ansi.RESET} ${Ansi.WHITE}${value}${Ansi.RESET}"
    }

    /** Renders a label like [master] in blue. */
    fun label(text: String, color: String = Ansi.BRIGHT_BLUE): String {
        return "${color}[${text}]${Ansi.RESET}"
    }

    // ─── Configuration ───

    var debugEnabled: Boolean = false
        private set

    fun setDebug(enabled: Boolean) {
        debugEnabled = enabled
    }

    // ─── Private Helpers ───

    private fun tree(icon: String, iconColor: String, message: String, color: String = Ansi.RESET, iconEnabled: Boolean): String {
        return "  ${if (iconEnabled) "${iconColor}${icon}" else ""}${color} $message"
    }
}

/**
 * Legacy compatibility shim for migrating from PrettyLog's `log()` function.
 * Maps PrettyLog log types to Console methods.
 */
fun log(message: String, type: LogLevel = LogLevel.INFO, icon: Boolean = true) {
    when (type) {
        LogLevel.INFO -> Console.info(message, icon)
        LogLevel.SUCCESS -> Console.success(message, icon)
        LogLevel.WARNING -> Console.warn(message, icon)
        LogLevel.ERROR -> Console.error(message, icon)
        LogLevel.DEBUG -> Console.debug(message, icon)
        LogLevel.NETWORK -> Console.network(message, icon)
    }
}

/**
 * Log levels matching the old PrettyLog types for easy migration.
 */
enum class LogLevel {
    INFO, SUCCESS, WARNING, ERROR, DEBUG, NETWORK
}
