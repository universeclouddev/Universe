package gg.scala.universe.minecraft.bungee

import net.md_5.bungee.api.ProxyServer
import net.md_5.bungee.api.chat.TextComponent
import net.md_5.bungee.api.event.PostLoginEvent
import net.md_5.bungee.api.plugin.Listener
import net.md_5.bungee.event.EventHandler

/**
 * Handles automatic player connection to servers based on configuration type
 * and server selection strategy.
 */
class AutoConnectListener(
    private val proxy: ProxyServer,
    private val config: AutoConnectConfig,
    private val poller: BungeeInstancePoller
) : Listener {

    @EventHandler
    fun onPostLogin(event: PostLoginEvent) {
        if (!config.enabled) return

        val targetConfig = config.configurationType
        if (targetConfig.isBlank()) return

        val player = event.player

        // Find available servers matching the target configuration
        val availableServers = poller.getInstancesByConfiguration(targetConfig)
        if (availableServers.isEmpty()) {
            player.sendMessage(
                TextComponent(
                    "§e[Universe] §7No servers available for configuration '$targetConfig'."
                )
            )
            return
        }

        // Select server based on strategy
        val selected = config.strategy.select(availableServers)
        if (selected == null) {
            player.sendMessage(
                TextComponent(
                    "§e[Universe] §7All servers for '$targetConfig' are currently full."
                )
            )
            return
        }

        val serverInfo = proxy.servers[selected.configurationName]
        if (serverInfo == null) {
            player.sendMessage(
                TextComponent(
                    "§e[Universe] §7Server '$selected.configurationName' is not registered."
                )
            )
            return
        }

        player.sendMessage(
            TextComponent(
                "§e[Universe] §7Connecting you to $selected.configurationName..."
            )
        )
        player.connect(serverInfo)
    }
}
