package gg.scala.universe.hz

import com.hazelcast.cluster.MembershipEvent
import com.hazelcast.cluster.MembershipListener
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import gg.scala.universe.schema.InstanceState

class ResilienceMembershipListener(
    private val clusterStateService: ClusterStateService
) : MembershipListener {

    override fun memberAdded(membershipEvent: MembershipEvent) {
        log("Wrapper joined: ${membershipEvent.member.uuid}", LogType.INFORMATION)
    }

    override fun memberRemoved(membershipEvent: MembershipEvent) {
        val memberUuid = membershipEvent.member.uuid.toString()
        log("Wrapper disconnected: $memberUuid", LogType.WARNING)

        val affectedInstances = clusterStateService.getInstancesByWrapper(memberUuid)
        if (affectedInstances.isEmpty()) {
            log("No instances were running on disconnected wrapper $memberUuid", LogType.INFORMATION)
            return
        }

        affectedInstances.forEach { instance ->
            log("Marking instance ${instance.id} as OFFLINE (was on wrapper $memberUuid)", LogType.WARNING)
            clusterStateService.updateInstanceState(instance.id, InstanceState.OFFLINE)
        }

        log("Marked ${affectedInstances.size} instance(s) as OFFLINE", LogType.WARNING)
    }

}
