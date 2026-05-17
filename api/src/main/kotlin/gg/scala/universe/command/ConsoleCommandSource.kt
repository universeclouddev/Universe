package gg.scala.universe.command

import com.google.inject.Inject
import com.google.inject.Singleton
import gg.scala.universe.console.Console
import gg.scala.universe.console.log

/**
 * The console implementation of [CommandSource].
 *
 * All messages sent to this source are forwarded to the console via [Console.println].
 * The console is always considered to have full permissions.
 */
@Singleton
class ConsoleCommandSource @Inject constructor() : CommandSource {

    override fun sendMessage(message: String) {
        log(message, icon = false)
    }

    override fun sendMessage(vararg messages: String) {
        messages.forEach { sendMessage(it) }
    }

    override fun sendMessage(messages: MutableCollection<String>) {
        messages.forEach { sendMessage(it) }
    }

    override fun checkPermission(permission: String): Boolean {
        return true
    }
}
