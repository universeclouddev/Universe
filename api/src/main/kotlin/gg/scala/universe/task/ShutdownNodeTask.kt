package gg.scala.universe.task

/**
 * Task sent to a Wrapper to gracefully shut down the node.
 * Stops all running instances and exits the JVM.
 */
data class ShutdownNodeTask(
    override val type: String = "shutdown"
) : UniverseTask
