package gg.scala.universe.hz.task

import com.google.inject.Inject
import com.hazelcast.core.HazelcastInstance
import com.hazelcast.cluster.Member
import gg.scala.universe.console.LogLevel
import gg.scala.universe.hz.nodeName
import gg.scala.universe.console.log
import gg.scala.universe.hz.ClusterStateService
import gg.scala.universe.schema.InstanceInfo
import gg.scala.universe.task.DeployInstanceTask
import gg.scala.universe.task.ExecuteCommandTask
import gg.scala.universe.task.ShutdownNodeTask
import gg.scala.universe.task.StopInstanceTask
import gg.scala.universe.util.json.Serializers

class TaskDispatcher @Inject constructor(
    private val hazelcastInstance: HazelcastInstance,
    private val clusterStateService: ClusterStateService
) {
    private val executorService by lazy {
        hazelcastInstance.getExecutorService("universe-executor")
    }

    fun dispatchDeploy(instanceInfo: InstanceInfo, targetMember: Member) {
        log("Dispatching deploy task for instance ${instanceInfo.id} to node ${targetMember.nodeName()}")
        val task = DeployInstanceTask(
            instanceId = instanceInfo.id,
            configurationName = instanceInfo.configurationName
        )
        submit(task, targetMember)
    }

    fun dispatchStop(instanceId: String, targetMember: Member) {
        log("Dispatching stop task for instance $instanceId to node ${targetMember.nodeName()}")
        val task = StopInstanceTask(instanceId = instanceId)
        submit(task, targetMember)
    }

    fun dispatchExecute(instanceId: String, command: String, targetMember: Member) {
        log("Dispatching execute task for instance $instanceId to node ${targetMember.nodeName()}: $command")
        val task = ExecuteCommandTask(
            instanceId = instanceId,
            command = command
        )
        submit(task, targetMember)
    }

    fun dispatchShutdown(targetMember: Member) {
        log("Dispatching shutdown task to node ${targetMember.nodeName()}")
        val task = ShutdownNodeTask()
        submit(task, targetMember)
    }

    private fun submit(task: Any, targetMember: Member) {
        val payload = Serializers.GSON.toJson(task)
        executorService.submitToMember(
            UniverseCallableTask(payload),
            targetMember
        )
    }
}
