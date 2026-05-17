package gg.scala.universe.minecraft.bungee

import gg.scala.universe.minecraft.api.UniverseAPI
import net.md_5.bungee.api.ChatColor
import net.md_5.bungee.api.ProxyServer
import net.md_5.bungee.api.CommandSender
import org.incendo.cloud.annotations.Argument
import org.incendo.cloud.annotations.Command
import org.incendo.cloud.annotations.CommandDescription
import org.incendo.cloud.annotations.Permission

class UniverseCloudCommands(
    private val proxy: ProxyServer,
    private val api: UniverseAPI
) {

    @Command("universe")
    @Permission("universe.command")
    @CommandDescription("Check Universe connection status")
    fun sendStatus(sender: CommandSender) {
        val connected = api.isConnected()
        val status = if (connected) "${ChatColor.GREEN}Connected" else "${ChatColor.RED}Disconnected"
        sender.sendMessage("${ChatColor.GOLD}[Universe] ${ChatColor.GRAY}Status: $status")
    }

    @Command("universe status")
    @Permission("universe.command.status")
    @CommandDescription("View detailed connection status")
    fun sendDetailedStatus(sender: CommandSender) {
        val connected = api.isConnected()
        val status = if (connected) "${ChatColor.GREEN}Connected" else "${ChatColor.RED}Disconnected"
        sender.sendMessage("${ChatColor.GOLD}[Universe] ${ChatColor.GRAY}Detailed Status:")
        sender.sendMessage("${ChatColor.GRAY}  Master URL: ${ChatColor.WHITE}${api.getMasterUrl()}")
        sender.sendMessage("${ChatColor.GRAY}  Instance ID: ${ChatColor.WHITE}${api.getInstanceId()}")
        sender.sendMessage("${ChatColor.GRAY}  Connection: $status")
    }

    @Command("universe servers")
    @Permission("universe.command.servers")
    @CommandDescription("List all Universe instances")
    fun sendServers(sender: CommandSender) {
        val servers = proxy.servers
        sender.sendMessage("${ChatColor.GOLD}[Universe] ${ChatColor.GRAY}Registered Instances (${servers.size}):")
        servers.forEach { (name, info) ->
            sender.sendMessage("${ChatColor.GRAY}  - ${ChatColor.WHITE}$name ${ChatColor.GRAY}at ${info.address}")
        }
    }

    @Command("universe refresh")
    @Permission("universe.command.refresh")
    @CommandDescription("Force refresh instance list")
    fun sendRefresh(sender: CommandSender) {
        sender.sendMessage("${ChatColor.GOLD}[Universe] ${ChatColor.GRAY}Refreshing instance list...")
        sender.sendMessage("${ChatColor.GOLD}[Universe] ${ChatColor.GRAY}Next poll will occur at the scheduled interval")
    }

    @Command("universe send <player> <server>")
    @Permission("universe.command.send")
    @CommandDescription("Send a player to a Universe instance")
    fun sendPlayer(
        sender: CommandSender,
        @Argument("player") playerName: String,
        @Argument("server") serverName: String
    ) {
        val player = proxy.getPlayer(playerName)
        if (player == null) {
            sender.sendMessage("${ChatColor.RED}[Universe] ${ChatColor.GRAY}Player '$playerName' not found")
            return
        }

        val server = proxy.servers[serverName]
        if (server == null) {
            sender.sendMessage("${ChatColor.RED}[Universe] ${ChatColor.GRAY}Server '$serverName' not found")
            return
        }

        player.connect(server)
        sender.sendMessage("${ChatColor.GOLD}[Universe] ${ChatColor.GRAY}Sending $playerName to $serverName")
    }
}
