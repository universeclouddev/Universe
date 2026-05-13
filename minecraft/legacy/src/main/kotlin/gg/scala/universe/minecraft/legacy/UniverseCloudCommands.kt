package gg.scala.universe.minecraft.legacy

import gg.scala.universe.minecraft.api.UniverseAPI
import org.bukkit.Bukkit
import org.bukkit.command.CommandSender
import org.incendo.cloud.annotations.Command
import org.incendo.cloud.annotations.Permission

class UniverseCloudCommands(private val api: UniverseAPI) {

    @Command("universe")
    @Permission("universe.command")
    fun universe(sender: CommandSender) {
        val status = if (api.isConnected()) "&aCONNECTED" else "&cDISCONNECTED"
        sender.sendMessage(CC.translate("&6[Universe] &fConnection status: $status"))
        sender.sendMessage(CC.translate("&7Use &a/universe info &7for detailed status."))
    }

    @Command("universe status")
    @Permission("universe.command.status")
    fun status(sender: CommandSender) {
        val status = if (api.isConnected()) "&aCONNECTED" else "&cDISCONNECTED"
        sender.sendMessage(CC.translate("&6[Universe] &fConnection status: $status"))
    }

    @Command("universe info")
    @Permission("universe.command.info")
    fun info(sender: CommandSender) {
        val info = api.getInstanceManager().getInstance(api.getInstanceId() ?: "").join()
        if (info == null || !info.isPresent) {
            sender.sendMessage(CC.translate("&6[Universe] &cFailed to fetch instance info from master."))
            return
        }

        val instance = info.get()
        sender.sendMessage(CC.translate("&6===== Universe Instance Info ====="))
        sender.sendMessage(CC.translate("&7ID: &f${instance.id}"))
        sender.sendMessage(CC.translate("&7Config: &f${instance.configurationName}"))
        sender.sendMessage(CC.translate("&7State: &f${instance.state}"))
        sender.sendMessage(CC.translate("&7Address: &f${instance.hostAddress}:${instance.allocatedPort}"))
        sender.sendMessage(CC.translate("&7Players: &f${Bukkit.getOnlinePlayers().size}/${Bukkit.getMaxPlayers()}"))
    }

    @Command("universe players")
    @Permission("universe.command.players")
    fun players(sender: CommandSender) {
        val online = Bukkit.getOnlinePlayers()
        sender.sendMessage(CC.translate("&6[Universe] &fOnline players: &a${online.size}&f/&a${Bukkit.getMaxPlayers()}"))
        if (online.isNotEmpty()) {
            val names = online.joinToString(", ") { it.name }
            sender.sendMessage(CC.translate("&7$names"))
        }
    }
}
