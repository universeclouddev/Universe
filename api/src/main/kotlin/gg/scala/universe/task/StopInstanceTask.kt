package gg.scala.universe.task

/**
 * Task sent to a Wrapper to stop a running instance.
 */
data class StopInstanceTask(
    val instanceId: String,
    override val type: String = "stop"
) : UniverseTask
