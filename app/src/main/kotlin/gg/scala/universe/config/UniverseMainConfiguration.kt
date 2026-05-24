package gg.scala.universe.config

data class UniverseMainConfiguration(
    val address: String = "127.0.0.1",
    val port: Int = 6000,
    val apiPort: Int = 7000,
    val nodeId: String = "node-1",
    val clusterName: String = "universe-cluster",

    val isMasterNode: Boolean = true,
    val masterAddress: String = "127.0.0.1",
    val masterPort: Int = 6000,
    val masterApiPort: Int = 7000,

    val debug: Boolean = false,

    /** Maximum RAM (in MB) this node is allowed to allocate to instances. */
    val maxRamMB: Int = 8192,
    /** Maximum CPU units this node is allowed to allocate to instances. */
    val maxCpu: Int = 400,

    /** Auto-update sources for configurations and templates. */
    val updateSources: List<UpdateSource> = emptyList(),
    val nodeSpecificVariables: Map<String, String> = mutableMapOf("region" to "us-east-1"),

    /**
     * The address Hazelcast binds its server socket to.
     * Use `"0.0.0.0"` in Docker to accept connections on all interfaces.
     * Defaults to [address] for backward compatibility.
     */
    val bindAddress: String = address,

    /**
     * The address advertised to other Hazelcast cluster members.
     * Use your Tailscale IP here when running behind Docker NAT.
     * Defaults to [address] for backward compatibility.
     */
    val publicAddress: String = address,
)
