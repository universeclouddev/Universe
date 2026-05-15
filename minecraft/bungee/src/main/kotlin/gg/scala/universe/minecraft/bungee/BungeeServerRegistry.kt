package gg.scala.universe.minecraft.bungee

import net.md_5.bungee.api.ProxyServer
import net.md_5.bungee.api.config.ServerInfo
import java.net.InetSocketAddress
import java.util.logging.Logger

class BungeeServerRegistry(private val logger: Logger) {

    private val proxy = ProxyServer.getInstance()

    fun register(name: String, address: String, port: Int) {
        val existing = proxy.servers[name]
        if (existing != null) {
            if (existing.address.address.hostAddress != address || existing.address.port != port) {
                logger.info("Updating Universe server $name: ${existing.address} -> $address:$port")
                proxy.servers.remove(name)
            } else {
                return // Already registered with correct address
            }
        }

        val socketAddress = InetSocketAddress(address, port)
        val serverInfo = proxy.constructServerInfo(name, socketAddress, "Universe instance", false)
        proxy.servers[name] = serverInfo
        logger.info("Registered Universe server: $name at $address:$port")
    }

    fun unregister(name: String) {
        val removed = proxy.servers.remove(name)
        if (removed != null) {
            logger.info("Unregistered Universe server: $name")
        }
    }

    fun getRegisteredServers(): Map<String, ServerInfo> {
        return proxy.servers.filter { (name, _) ->
            // Filter to only Universe-managed servers (those we registered)
            name.startsWith("universe-") || isUniverseServer(name)
        }
    }

    private fun isUniverseServer(name: String): Boolean {
        // Check if this server was registered by us by looking at the motd
        val server = proxy.servers[name]
        return server?.motd?.contains("Universe instance") == true
    }
}
