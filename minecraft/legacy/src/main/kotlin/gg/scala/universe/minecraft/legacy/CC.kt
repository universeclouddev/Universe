package gg.scala.universe.minecraft.legacy

import org.bukkit.ChatColor

/**
 * Color code utility for legacy Bukkit/Spigot.
 * Converts `&` color codes to `§` (section sign).
 */
object CC {

    fun translate(input: String): String {
        return ChatColor.translateAlternateColorCodes('&', input)
    }

    fun translateList(input: List<String>): List<String> {
        return input.map { translate(it) }
    }
}
