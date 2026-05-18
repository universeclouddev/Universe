package gg.scala.universe.minecraft.velocity

import com.velocitypowered.api.event.Subscribe
import com.velocitypowered.api.event.player.PlayerChooseInitialServerEvent
import com.velocitypowered.api.proxy.ProxyServer
import com.velocitypowered.api.proxy.server.RegisteredServer
import net.kyori.adventure.text.Component
import net.kyori.adventure.text.format.NamedTextColor
import java.util.Optional
import java.util.concurrent.CompletableFuture

/**
 * Handles automatic player connection to servers based on configuration type
 * and server selection strategy.
 *
 * Velocity uses [PlayerChooseInitialServerEvent] which fires before the player
 * is assigned their initial server. We override the choice with our selected server.
 */
class AutoConnectListener(
    private val proxy: ProxyServer,
    private val config: AutoConnectConfig,
    private val poller: InstancePoller
) {

    @Subscribe
    fun onChooseInitialServer(event: PlayerChooseInitialServerEvent) {
        if (!config.enabled) return

        val targetConfig = config.configurationType
        if (targetConfig.isBlank()) return

        val player = event.player

        // Find available servers matching the target configuration
        val availableServers = poller.getInstancesByConfiguration(targetConfig)
        if (availableServers.isEmpty()) {
            player.sendMessage(
                Component.text()
                    .color(NamedTextColor.YELLOW)
                    .append(Component.text("[Universe] "))
                    .color(NamedTextColor.GRAY)
                    .append(Component.text("No servers available for configuration '$targetConfig'."))
                    .build()
            )
            return
        }

        // Select server based on strategy
        val selected = config.strategy.select(availableServers)
        if (selected == null) {
            player.sendMessage(
                Component.text()
                    .color(NamedTextColor.YELLOW)
                    .append(Component.text("[Universe] "))
                    .color(NamedTextColor.GRAY)
                    .append(Component.text("All servers for '$targetConfig' are currently full."))
                    .build()
            )
            return
        }

        // Velocity registers servers by instance ID, so we need to find the RegisteredServer
        val serverOpt = proxy.getServer(selected.id)
        if (serverOpt.isEmpty) {
            player.sendMessage(
                Component.text()
                    .color(NamedTextColor.YELLOW)
                    .append(Component.text("[Universe] "))
                    .color(NamedTextColor.GRAY)
                    .append(Component.text("Server '${selected.id}' is not registered."))
                    .build()
            )
            return
        }

        player.sendMessage(
            Component.text()
                .color(NamedTextColor.YELLOW)
                .append(Component.text("[Universe] "))
                .color(NamedTextColor.GRAY)
                .append(Component.text("Connecting you to ${selected.configurationName}..."))
                .build()
        )

        // Override the initial server choice
        event.setInitialServer(serverOpt.orElse(null))
    }
}
