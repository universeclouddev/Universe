package gg.scala.universe.command

import gg.scala.universe.config.UniverseMainConfiguration
import org.jline.utils.AttributedString
import org.jline.utils.AttributedStringBuilder
import org.jline.utils.AttributedStyle

/**
 * Console UI renderer using JLine 3's attributed string API.
 * Eliminates raw ANSI escape codes in favor of type-safe styling.
 */
object ConsoleRenderer {

    private val PRIMARY = AttributedStyle.DEFAULT.foreground(AttributedStyle.CYAN)
    private val PRIMARY_BOLD = PRIMARY.bold()
    private val SUCCESS = AttributedStyle.DEFAULT.foreground(AttributedStyle.GREEN)
    private val WARNING = AttributedStyle.DEFAULT.foreground(AttributedStyle.YELLOW)
    private val MUTED = AttributedStyle.DEFAULT.foreground(AttributedStyle.BRIGHT)
    private val BOLD_DEFAULT = AttributedStyle.DEFAULT.bold()

    /**
     * Prints the startup banner with node info.
     */
    fun printBanner(configuration: UniverseMainConfiguration) {
        val roleStyle = if (configuration.isMasterNode) SUCCESS else WARNING
        val role = styled(roleStyle, if (configuration.isMasterNode) "Master" else "Wrapper")
        val nodeName = styled(PRIMARY_BOLD, configuration.nodeId)
        val addr = styled(AttributedStyle.DEFAULT.foreground(AttributedStyle.MAGENTA),
            "${configuration.address}:${configuration.port}")

        println()
        println("  ${styled(PRIMARY_BOLD, "┌────────────────────────────────────────────┐")}")
        println("  ${styled(PRIMARY_BOLD, "│")}  ${styled(BOLD_DEFAULT, "Universe")} ${styled(MUTED, "Orchestrator")}                        ${styled(PRIMARY_BOLD, "│")}")
        println("  ${styled(PRIMARY_BOLD, "│")}                                            ${styled(PRIMARY_BOLD, "│")}")
        println("  ${styled(PRIMARY_BOLD, "│")}  Node:  $nodeName                                ${styled(PRIMARY_BOLD, "│")}")
        println("  ${styled(PRIMARY_BOLD, "│")}  Role:  $role                                  ${styled(PRIMARY_BOLD, "│")}")
        println("  ${styled(PRIMARY_BOLD, "│")}  Hazelcast: $addr                  ${styled(PRIMARY_BOLD, "│")}")
        if (configuration.isMasterNode) {
            val apiAddr = styled(AttributedStyle.DEFAULT.foreground(AttributedStyle.MAGENTA),
                "${configuration.address}:${configuration.apiPort}")
            println("  ${styled(PRIMARY_BOLD, "│")}  API:     $apiAddr                  ${styled(PRIMARY_BOLD, "│")}")
        }
        println("  ${styled(PRIMARY_BOLD, "└────────────────────────────────────────────┘")}")
        println()
        println("  ${styled(MUTED, "Type 'help' for available commands.")}")
        println()
    }

    /**
     * Builds the colored command prompt as an AttributedString for JLine.
     */
    fun prompt(nodeId: String): AttributedString {
        return AttributedStringBuilder()
            .styled(PRIMARY, "universe")
            .styled(MUTED, "@")
            .styled(PRIMARY, nodeId)
            .append(" ")
            .styled(MUTED, "> ")
            .toAttributedString()
    }

    private fun styled(style: AttributedStyle, text: String): String {
        return AttributedStringBuilder().styled(style, text).toString()
    }
}
