package gg.scala.universe.command

import com.google.inject.Inject
import com.google.inject.Singleton
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import gg.scala.universe.command.commands.ManagementCommands
import gg.scala.universe.command.commands.TemplateSyncCommand
import java.io.BufferedReader
import java.io.InputStreamReader

/**
 * Bootstraps the console input thread and registers all command classes.
 */
@Singleton
class CommandBootstrap @Inject constructor(
    private val commandProvider: CommandProvider,
    private val consoleSource: ConsoleCommandSource
) {

    private var consoleThread: Thread? = null

    fun start() {
        commandProvider.register(TemplateSyncCommand::class.java)
        commandProvider.register(ManagementCommands::class.java)

        consoleThread = Thread({
            val reader = BufferedReader(InputStreamReader(System.`in`))
            try {
                while (!Thread.currentThread().isInterrupted) {
                    val line = reader.readLine() ?: break

                    if (line.equals("stop", ignoreCase = true) || line.equals("exit", ignoreCase = true)) {
                        log("Shutdown requested via console", LogType.INFORMATION)
                        Runtime.getRuntime().exit(0)
                    }

                    try {
                        commandProvider.execute(consoleSource, line)
                            .exceptionally { throwable ->
                                log("Error executing command: ${throwable.message}", LogType.ERROR)
                                null
                            }
                    } catch (e: Exception) {
                        log("Error executing command: ${e.message}", LogType.ERROR)
                    }
                }
            } catch (e: Exception) {
                if (!Thread.currentThread().isInterrupted) {
                    log("Console input error: ${e.message}", LogType.ERROR)
                }
            }
        }, "universe-console").apply {
            isDaemon = true
            start()
        }
    }

    fun stop() {
        consoleThread?.interrupt()
        consoleThread = null
    }
}
