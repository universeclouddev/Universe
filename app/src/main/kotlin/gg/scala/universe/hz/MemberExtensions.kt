package gg.scala.universe.hz

import com.hazelcast.cluster.Member

/**
 * Returns the human-readable node name for a Hazelcast member.
 * Falls back to the UUID if no nodeId attribute is set.
 */
fun Member.nodeName(): String {
    return this.getAttribute("nodeId") ?: this.uuid.toString()
}
