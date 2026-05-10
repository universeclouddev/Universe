package gg.scala.universe.command

import com.google.inject.Inject
import com.google.inject.Singleton
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log

/**
 * The console implementation of [CommandSource].
 *
 * All messages sent to this source are forwarded to the console via [cz.lukynka.prettylog.log].
 * The console is always considered to have full permissions.
 */
@Singleton
class ConsoleCommandSource @Inject constructor() : CommandSource {

    override fun sendMessage(message: String) {
        log(message, LogType.INFORMATION)
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
