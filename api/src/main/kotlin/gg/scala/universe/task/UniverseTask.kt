package gg.scala.universe.task

/**
 * Marker interface for all task types that can be dispatched
 * from the Master to a Wrapper via Hazelcast IExecutorService.
 */
interface UniverseTask {
    val type: String
}
