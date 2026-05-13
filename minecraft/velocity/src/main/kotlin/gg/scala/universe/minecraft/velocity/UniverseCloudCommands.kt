package gg.scala.universe.minecraft.velocity

import com.velocitypowered.api.command.CommandSource
import com.velocitypowered.api.proxy.Player
import com.velocitypowered.api.proxy.ProxyServer
import gg.scala.universe.minecraft.api.UniverseAPI
import org.incendo.cloud.annotations.Argument
import org.incendo.cloud.annotations.Command
import org.incendo.cloud.annotations.Permission

class UniverseCloudCommands(
    private val proxy: ProxyServer,
    private val api: UniverseAPI
) {

    @Command("universe")
    @Permission("universe.command")
    fun universe(source: CommandSource) {
        val status = if (api.isConnected()) "<green>CONNECTED" else "<red>DISCONNECTED"
        source.sendMessage(CC.translate("<gold>[Universe] <white>Connection status: $status"))
        source.sendMessage(CC.translate("<gray>Use <green>/universe servers <gray>to list backends."))
    }

    @Command("universe servers")
    @Permission("universe.command.servers")
    fun servers(source: CommandSource) {
        val instances = api.getInstanceManager().getInstances().join()
        if (instances.isEmpty()) {
            source.sendMessage(CC.translate("<gold>[Universe] <red>No Universe instances are currently online."))
            return
        }

        source.sendMessage(CC.translate("<gold>[Universe] <white>Registered Universe servers:"))
        instances.forEach { instance ->
            val stateColor = when (instance.state) {
                "ONLINE" -> "<green>"
                "OFFLINE" -> "<yellow>"
                else -> "<red>"
            }
            val playerInfo = if (instance.maxPlayers > 0) {
                " <gray>[<white>${instance.players}/${instance.maxPlayers}<gray>]"
            } else {
                ""
            }
            source.sendMessage(CC.translate(
                "  <gray>- <white>${instance.id} <gray>(${instance.configurationName}) ${stateColor}${instance.state}${playerInfo}<gray> @ ${instance.hostAddress}:${instance.allocatedPort}"
            ))
        }
    }

    @Command("universe refresh")
    @Permission("universe.command.refresh")
    fun refresh(source: CommandSource) {
        api.getInstanceManager().getInstances()
        source.sendMessage(CC.translate("<gold>[Universe] <green>Refreshed server registry from Universe master."))
    }

    @Command("universe info <server>")
    @Permission("universe.command.info")
    fun info(source: CommandSource, @Argument("server") serverName: String) {
        val opt = api.getInstanceManager().getInstance(serverName).join()
        if (opt == null || !opt.isPresent) {
            source.sendMessage(CC.translate("<gold>[Universe] <red>No instance found with ID '$serverName'."))
            return
        }

        val instance = opt.get()
        source.sendMessage(CC.translate("<gold>===== Universe Server Info ====="))
        source.sendMessage(CC.translate("<gray>ID: <white>${instance.id}"))
        source.sendMessage(CC.translate("<gray>Config: <white>${instance.configurationName}"))
        source.sendMessage(CC.translate("<gray>State: <white>${instance.state}"))
        source.sendMessage(CC.translate("<gray>Address: <white>${instance.hostAddress}:${instance.allocatedPort}"))
        if (instance.maxPlayers > 0) {
            source.sendMessage(CC.translate("<gray>Players: <white>${instance.players}/${instance.maxPlayers}"))
        }
    }

    @Command("universe send <player> <server>")
    @Permission("universe.command.send")
    fun sendPlayer(
        source: CommandSource,
        @Argument("player") playerName: String,
        @Argument("server") serverName: String
    ) {
        val targetPlayer = proxy.getPlayer(playerName).orElse(null)
        if (targetPlayer == null) {
            source.sendMessage(CC.translate("<gold>[Universe] <red>Player '$playerName' is not online."))
            return
        }

        val server = proxy.getServer(serverName).orElse(null)
        if (server == null) {
            source.sendMessage(CC.translate("<gold>[Universe] <red>Server '$serverName' is not registered."))
            return
        }

        targetPlayer.createConnectionRequest(server).connect().thenAccept { result ->
            if (result.isSuccessful) {
                source.sendMessage(CC.translate("<gold>[Universe] <green>Sent ${targetPlayer.username} to $serverName."))
            } else {
                source.sendMessage(CC.translate("<gold>[Universe] <red>Failed to connect ${targetPlayer.username} to $serverName."))
            }
        }
    }

    @Command("universe status")
    @Permission("universe.command.status")
    fun status(source: CommandSource) {
        val connected = api.isConnected()
        val status = if (connected) "<green>CONNECTED" else "<red>DISCONNECTED"
        source.sendMessage(CC.translate("<gold>[Universe] <white>Connection status: $status"))
    }
}
