package gg.scala.universe.runtime

import java.nio.file.Path

/**
 * Cross-platform shell invocation for [ProcessRuntimeProvider] and similar runtimes.
 */
object ShellCommand {

    val isWindows: Boolean =
        System.getProperty("os.name").lowercase().contains("windows")

    /**
     * Builds a [ProcessBuilder] that runs [command] through the platform shell.
     */
    fun processBuilder(command: String, workingDir: Path): ProcessBuilder {
        val builder = if (isWindows) {
            ProcessBuilder("cmd.exe", "/c", command)
        } else {
            ProcessBuilder("bash", "-c", command)
        }
        return builder.directory(workingDir.toFile())
    }
}
