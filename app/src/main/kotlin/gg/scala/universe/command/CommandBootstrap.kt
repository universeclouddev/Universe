package gg.scala.universe.command

import com.google.inject.Inject
import com.google.inject.Singleton
import gg.scala.universe.console.log
import gg.scala.universe.console.LogLevel
import gg.scala.universe.command.commands.ApiKeyManagementCommands
import gg.scala.universe.command.commands.ManagementCommands
import gg.scala.universe.command.exception.CommandExceptionHandler
import gg.scala.universe.command.commands.TemplateSyncCommand
import gg.scala.universe.config.UniverseMainConfiguration
import org.jline.reader.Candidate
import org.jline.reader.Completer
import org.jline.reader.EndOfFileException
import org.jline.reader.LineReader
import org.jline.reader.LineReaderBuilder
import org.jline.reader.UserInterruptException
import org.jline.terminal.Terminal
import org.jline.terminal.TerminalBuilder

/**
 * Bootstraps the console input thread using JLine 3 for tab completion,
 * history, and proper terminal handling.
 */
@Singleton
class CommandBootstrap @Inject constructor(
    private val commandProvider: CommandProvider,
    private val consoleSource: ConsoleCommandSource,
    private val configuration: UniverseMainConfiguration,
    private val exceptionHandler: CommandExceptionHandler,
    private val apiKeyManagementCommands: ApiKeyManagementCommands
) {

    private var consoleThread: Thread? = null
    private var terminal: Terminal? = null
    private var lineReader: LineReader? = null
    private var originalOut: java.io.PrintStream? = null
    private var originalErr: java.io.PrintStream? = null

    fun start() {
        commandProvider.register(TemplateSyncCommand::class.java)
        commandProvider.register(ManagementCommands::class.java)
        commandProvider.register(ApiKeyManagementCommands::class.java)

        ConsoleRenderer.printBanner(configuration)

        // Force a proper terminal type when running inside Docker (TERM is often unset or "dumb")
        val termEnv = System.getenv("TERM")
        if (termEnv.isNullOrBlank() || termEnv == "dumb") {
            System.setProperty("org.jline.terminal.type", "xterm-256color")
        }

        terminal = TerminalBuilder.builder()
            .system(true)
            .dumb(true)
            .type("xterm-256color")
            .build()

        val size = terminal?.size
        log("Terminal type: ${terminal?.type}, size: ${size?.columns}x${size?.rows}")

        lineReader = LineReaderBuilder.builder()
            .terminal(terminal)
            .completer(CloudCommandCompleter(commandProvider, consoleSource))
            .build()
            .apply {
                // Combobox-style inline menu completion (cycles with Tab)
                setOpt(LineReader.Option.MENU_COMPLETE)
                setOpt(LineReader.Option.AUTO_MENU)
                setOpt(LineReader.Option.AUTO_MENU_LIST)
                setOpt(LineReader.Option.AUTO_LIST)

                // Compact list: if candidates < 12, show a small list below the line
                setVariable(LineReader.MENU_LIST_MAX, 12)

                // Style the selected menu item (cyan highlight)
                setVariable(LineReader.COMPLETION_STYLE_SELECTION, "fg:cyan,bold")
                setVariable(LineReader.COMPLETION_STYLE_LIST_SELECTION, "fg:cyan,bold")
                // Menu background
                setVariable(LineReader.COMPLETION_STYLE_BACKGROUND, "bg:default")
                setVariable(LineReader.COMPLETION_STYLE_LIST_BACKGROUND, "bg:default")
            }

        // Redirect stdout/stderr through JLine so async logs print above the prompt.
        // In Docker, skip this to avoid TTY deadlock: async logs from Hazelcast/Ktor
        // threads calling printAbove() can stall on the terminal lock when the Docker
        // TTY proxy slows down, freezing the console thread forever.
        val inDocker = isRunningInDocker()
        if (inDocker) {
            log("Running in Docker — skipping JLine stdout capture to avoid TTY deadlock", LogLevel.DEBUG)
        }
        originalOut = System.out
        originalErr = System.err
        if (!inDocker) {
            val jlineOut = createJLinePrintStream(lineReader!!)
            System.setOut(jlineOut)
            System.setErr(jlineOut)
        }

        consoleThread = Thread({
            try {
                while (!Thread.currentThread().isInterrupted) {
                    val line = try {
                        // Convert AttributedString to ANSI string for colored prompt in readLine()
                        val promptStr = ConsoleRenderer.prompt(configuration.nodeId).toAnsi()
                        lineReader?.readLine(promptStr)?.trim()
                    } catch (_: UserInterruptException) {
                        continue
                    } catch (_: EndOfFileException) {
                        break
                    } catch (_: IllegalStateException) {
                        // Terminal closed during shutdown — exit cleanly
                        break
                    }

                    if (line.isNullOrBlank()) {
                        continue
                    }

                    try {
                        commandProvider.execute(consoleSource, line)
                            .exceptionally { throwable ->
                                exceptionHandler.handle(consoleSource, throwable)
                                null
                            }
                    } catch (e: Exception) {
                        exceptionHandler.handle(consoleSource, e)
                    }
                }
            } catch (e: Exception) {
                if (!Thread.currentThread().isInterrupted) {
                    log("Console input error: ${e.message}", LogLevel.ERROR)
                }
            }
        }, "universe-console").apply {
            isDaemon = true
            start()
        }
    }

    fun stop() {
        // Restore original stdout/stderr first so any post-stop logging
        // doesn't attempt to write through the JLine terminal we're about to close.
        val savedOut = originalOut
        val savedErr = originalErr
        try {
            savedOut?.let { System.setOut(it) }
            savedErr?.let { System.setErr(it) }
        } catch (_: Exception) { }
        originalOut = null
        originalErr = null

        try {
            consoleThread?.interrupt()
        } catch (_: Exception) { }
        consoleThread = null

        lineReader = null

        try {
            terminal?.close()
        } catch (_: IllegalStateException) {
            // Terminal already closed — expected during shutdown
        } catch (_: Exception) { }
        terminal = null
    }

    /**
     * Detects whether the process is running inside a Docker container.
     * Checks for the presence of `/.dockerenv` or `docker` in `/proc/self/cgroup`.
     */
    private fun isRunningInDocker(): Boolean {
        return try {
            java.io.File("/.dockerenv").exists() ||
                java.io.File("/proc/self/cgroup").readText().contains("docker")
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Creates a PrintStream that delegates to JLine's printAbove().
     * This ensures async log output appears above the prompt.
     *
     * Buffers raw bytes per line and decodes as UTF-8 to avoid mojibake
     * on multi-byte characters (emoji, ANSI escape sequences, etc.).
     */
    private fun createJLinePrintStream(reader: LineReader): java.io.PrintStream {
        val out = object : java.io.OutputStream() {
            private val buffer = java.io.ByteArrayOutputStream()

            override fun write(b: Int) {
                if (b == '\n'.code) {
                    val bytes = buffer.toByteArray()
                    if (bytes.isNotEmpty()) {
                        val line = String(bytes, Charsets.UTF_8)
                        try {
                            reader.printAbove(line)
                        } catch (_: IllegalStateException) {
                            // Terminal closed — write to original stdout as fallback
                            originalOut?.println(line) ?: kotlin.io.println(line)
                        }
                    }
                    buffer.reset()
                } else {
                    buffer.write(b)
                }
            }
        }
        return java.io.PrintStream(out, true, "UTF-8")
    }
}

/**
 * JLine completer that queries the Cloud command manager for suggestions.
 */
private class CloudCommandCompleter(
    private val commandProvider: CommandProvider,
    private val consoleSource: CommandSource
) : Completer {

    override fun complete(reader: LineReader, line: org.jline.reader.ParsedLine, candidates: MutableList<Candidate>) {
        val buffer = line.line()
        val suggestions = commandProvider.suggest(consoleSource, buffer)
        suggestions.forEach { candidates.add(Candidate(it)) }
    }
}
