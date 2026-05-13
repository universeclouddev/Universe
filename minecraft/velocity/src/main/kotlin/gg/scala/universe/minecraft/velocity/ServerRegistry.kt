package gg.scala.universe.minecraft.velocity

import com.velocitypowered.api.proxy.ProxyServer
import com.velocitypowered.api.proxy.server.ServerInfo
import org.slf4j.Logger
import java.net.InetSocketAddress

class ServerRegistry(
    private val proxy: ProxyServer,
    private val logger: Logger
) {
    /**
     * Registers a server with Velocity. If a server with the same name
     * already exists, it is unregistered first to allow address updates.
     */
    fun register(name: String, address: String, port: Int) {
        val existing = proxy.getServer(name)
        if (existing.isPresent) {
            val oldInfo = existing.get().serverInfo
            if (oldInfo.address == InetSocketAddress.createUnresolved(address, port)) {
                return // Already registered with same address
            }
            proxy.unregisterServer(oldInfo)
            logger.info("Updated Universe server: $name -> $address:$port")
        } else {
            logger.info("Registered Universe server: $name -> $address:$port")
        }

        val info = ServerInfo(name, InetSocketAddress.createUnresolved(address, port))
        proxy.registerServer(info)
    }

    /**
     * Unregisters a server from Velocity.
     */
    fun unregister(name: String) {
        val existing = proxy.getServer(name)
        if (existing.isPresent) {
            proxy.unregisterServer(existing.get().serverInfo)
            logger.info("Unregistered Universe server: $name")
        }
    }

    /**
     * Returns the names of all currently registered Universe servers.
     */
    fun getRegisteredNames(): List<String> {
        return proxy.allServers.map { it.serverInfo.name }
    }
}
