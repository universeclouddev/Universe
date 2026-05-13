package gg.scala.universe.hz

import com.google.inject.Inject
import com.hazelcast.config.Config as HazelcastConfig
import com.hazelcast.core.Hazelcast
import com.hazelcast.core.HazelcastInstance
import gg.scala.universe.config.UniverseMainConfiguration
import gg.scala.universe.console.log
import org.slf4j.LoggerFactory

class HazelcastService {
    private val logger = LoggerFactory.getLogger(HazelcastService::class.java)

    @Inject lateinit var configuration: UniverseMainConfiguration

    lateinit var hzInstance: HazelcastInstance

    fun start() {
        // Force Hazelcast to use SLF4J so it respects our Logback level controls

        val hzConfig = HazelcastConfig()
        hzConfig.clusterName = configuration.clusterName
        hzConfig.jetConfig.isEnabled = true

        // set hazelcast logging to slf4j to respect our logback configuration
        System.setProperty("hazelcast.logging.type", "slf4j")
        hzConfig.setProperty("hazelcast.logging.type", "slf4j")

        // disable auto shutdown hook - we'll manage shutdown ourselves to ensure proper cleanup
        hzConfig.setProperty("hazelcast.shutdownhook.enabled", "false")

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

            log("Starting Universe in MASTER mode on port ${network.port}")
        } else {
            val masterAddress = "${configuration.masterAddress}:${configuration.masterPort}"
            tcpIpConfig.addMember(masterAddress)
            hzConfig.isLiteMember = true

            log("Starting Universe in WRAPPER mode, connecting to Master at $masterAddress")
        }

        // Set node ID as a member attribute so it can be read by other members
        hzConfig.memberAttributeConfig.setAttribute("nodeId", configuration.nodeId)
        hzConfig.memberAttributeConfig.setAttribute("maxRamMB", configuration.maxRamMB.toString())
        hzConfig.memberAttributeConfig.setAttribute("maxCpu", configuration.maxCpu.toString())

        this.hzInstance = Hazelcast.newHazelcastInstance(hzConfig)
    }
}