package gg.scala.universe.task

/**
 * Task sent to a Wrapper to execute a command in a running instance.
 */
data class ExecuteCommandTask(
    val instanceId: String,
    val command: String,
    override val type: String = "execute"
) : UniverseTask
