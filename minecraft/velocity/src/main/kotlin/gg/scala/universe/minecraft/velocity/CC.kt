package gg.scala.universe.minecraft.velocity

import net.kyori.adventure.text.Component
import net.kyori.adventure.text.minimessage.MiniMessage

/**
 * Color code utility for Velocity.
 * Converts `&` color codes and MiniMessage tags to Adventure Components.
 */
object CC {

    private val miniMessage = MiniMessage.miniMessage()

    /**
     * Translates `&` color codes and MiniMessage tags to Adventure Components.
     *
     * Supports:
     * - Standard `&` color codes (`&a`, `&c`, `&6`, etc.)
     * - MiniMessage tags (`<green>`, `<red>`, `<#RRGGBB>`, `<bold>`, etc.)
     */
    fun translate(input: String): Component {
        val mmFormat = ampersandToMiniMessage(input)
        return miniMessage.deserialize(mmFormat)
    }

    /**
     * Converts legacy `&` color codes to MiniMessage format.
     */
    private fun ampersandToMiniMessage(input: String): String {
        val builder = StringBuilder()
        var i = 0
        while (i < input.length) {
            if (input[i] == '&' && i + 1 < input.length) {
                val code = input[i + 1]
                val tag = when (code) {
                    '0' -> "<black>"
                    '1' -> "<dark_blue>"
                    '2' -> "<dark_green>"
                    '3' -> "<dark_aqua>"
                    '4' -> "<dark_red>"
                    '5' -> "<dark_purple>"
                    '6' -> "<gold>"
                    '7' -> "<gray>"
                    '8' -> "<dark_gray>"
                    '9' -> "<blue>"
                    'a', 'A' -> "<green>"
                    'b', 'B' -> "<aqua>"
                    'c', 'C' -> "<red>"
                    'd', 'D' -> "<light_purple>"
                    'e', 'E' -> "<yellow>"
                    'f', 'F' -> "<white>"
                    'k', 'K' -> "<obfuscated>"
                    'l', 'L' -> "<bold>"
                    'm', 'M' -> "<strikethrough>"
                    'n', 'N' -> "<underlined>"
                    'o', 'O' -> "<italic>"
                    'r', 'R' -> "<reset>"
                    else -> "&$code"
                }
                builder.append(tag)
                i += 2
            } else {
                builder.append(input[i])
                i++
            }
        }
        return builder.toString()
    }
}
