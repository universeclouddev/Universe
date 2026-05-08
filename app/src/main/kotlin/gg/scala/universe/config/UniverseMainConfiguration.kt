package gg.scala.universe.config

data class UniverseMainConfiguration(
    val address: String = "127.0.0.1",
    val port: Int = 6000,
    val nodeId: String = "node-1",
    val clusterName: String = "universe-cluster",

    val isMasterNode: Boolean = true,
    val masterAddress: String = "127.0.0.1",
    val masterPort: Int = 6000,
)
