package gg.scala.universe.minecraft.modern

import gg.scala.universe.minecraft.api.UniverseAPI
import org.bukkit.Bukkit
import org.incendo.cloud.annotations.Command
import org.incendo.cloud.annotations.Permission
import org.incendo.cloud.paper.util.sender.Source

class UniverseCloudCommands(private val api: UniverseAPI) {

    @Command("universe")
    @Permission("universe.command")
    fun universe(source: Source) {
        val status = if (api.isConnected()) "<green>CONNECTED" else "<red>DISCONNECTED"
        source.source().sendMessage(CC.translate("<gold>[Universe] <white>Connection status: $status"))
        source.source().sendMessage(CC.translate("<gray>Use <green>/universe info <gray>for detailed status."))
    }

    @Command("universe status")
    @Permission("universe.command.status")
    fun status(source: Source) {
        val status = if (api.isConnected()) "<green>CONNECTED" else "<red>DISCONNECTED"
        source.source().sendMessage(CC.translate("<gold>[Universe] <white>Connection status: $status"))
    }

    @Command("universe info")
    @Permission("universe.command.info")
    fun info(source: Source) {
        val info = api.getInstanceManager().getInstance(api.getInstanceId() ?: "").join()
        if (info == null || !info.isPresent) {
            source.source().sendMessage(CC.translate("<gold>[Universe] <red>Failed to fetch instance info from master."))
            return
        }

        val instance = info.get()
        source.source().sendMessage(CC.translate("<gold>===== Universe Instance Info ====="))
        source.source().sendMessage(CC.translate("<gray>ID: <white>${instance.id}"))
        source.source().sendMessage(CC.translate("<gray>Config: <white>${instance.configurationName}"))
        source.source().sendMessage(CC.translate("<gray>State: <white>${instance.state}"))
        source.source().sendMessage(CC.translate("<gray>Address: <white>${instance.hostAddress}:${instance.allocatedPort}"))
        source.source().sendMessage(CC.translate("<gray>Players: <white>${Bukkit.getOnlinePlayers().size}/${Bukkit.getMaxPlayers()}"))
        source.source().sendMessage(CC.translate("<gray>TPS: <white>${String.format("%.2f", getTPS())}"))
    }

    @Command("universe players")
    @Permission("universe.command.players")
    fun players(source: Source) {
        val online = Bukkit.getOnlinePlayers()
        source.source().sendMessage(CC.translate("<gold>[Universe] <white>Online players: <green>${online.size}<white>/<green>${Bukkit.getMaxPlayers()}"))
        if (online.isNotEmpty()) {
            val names = online.joinToString(", ") { it.name }
            source.source().sendMessage(CC.translate("<gray>$names"))
        }
    }

    @Command("universe tps")
    @Permission("universe.command.tps")
    fun tps(source: Source) {
        val tps = getTPS()
        val color = when {
            tps >= 18.0 -> "<green>"
            tps >= 15.0 -> "<yellow>"
            else -> "<red>"
        }
        source.source().sendMessage(CC.translate("<gold>[Universe] <white>Server TPS: ${color}${String.format("%.2f", tps)}"))
    }

    private fun getTPS(): Double {
        return try {
            Bukkit.getTPS()[0]
        } catch (_: Exception) {
            20.0
        }
    }
}
