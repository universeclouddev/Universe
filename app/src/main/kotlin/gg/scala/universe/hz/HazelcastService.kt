package gg.scala.universe.hz

import com.google.inject.Inject
import com.hazelcast.config.Config as HazelcastConfig
import com.hazelcast.core.Hazelcast
import com.hazelcast.core.HazelcastInstance
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import gg.scala.universe.config.UniverseMainConfiguration

class HazelcastService {
    @Inject lateinit var configuration: UniverseMainConfiguration

    lateinit var hzInstance: HazelcastInstance

    fun start() {
        val hzConfig = HazelcastConfig()
        hzConfig.clusterName = configuration.clusterName
        hzConfig.jetConfig.isEnabled = true

        // Network
        val pubAddress = "${configuration.address}:${configuration.port}"
        val network = hzConfig.networkConfig
        network.port = configuration.port
        network.isPortAutoIncrement = false // do not auto increment - we want to fail if the port is already in use (indicates a config issue)
        network.publicAddress = pubAddress

        // Discovery
        val join = network.join
        join.autoDetectionConfig.isEnabled = false
        join.multicastConfig.isEnabled = false

        val tcpIpConfig = join.tcpIpConfig
        tcpIpConfig.isEnabled = true

        if (configuration.isMasterNode) {
            tcpIpConfig.addMember("127.0.0.1")

            log("🚀 Starting Deployer in MASTER mode on port ${network.port}...", LogType.INFORMATION)
        } else {
            val masterAddress = "${configuration.masterAddress}:${configuration.masterPort}"
            tcpIpConfig.addMember(masterAddress)
            hzConfig.isLiteMember = true

            log("📡 Starting Deployer in WRAPPER mode, connecting to Master at $masterAddress...", LogType.INFORMATION)
        }

        // Set node ID as a member attribute so it can be read by other members
        hzConfig.memberAttributeConfig.setAttribute("nodeId", configuration.nodeId)

        this.hzInstance = Hazelcast.newHazelcastInstance(hzConfig)
    }
}