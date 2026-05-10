package gg.scala.universe.task

/**
 * Task sent to a Wrapper to deploy (start) a new instance.
 */
data class DeployInstanceTask(
    val instanceId: String,
    val configurationName: String,
    override val type: String = "deploy"
) : UniverseTask
