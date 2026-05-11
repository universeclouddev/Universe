package gg.scala.universe.util

import java.util.UUID

object InstanceIdGenerator {
    fun generate(): String {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 6)
    }
}
