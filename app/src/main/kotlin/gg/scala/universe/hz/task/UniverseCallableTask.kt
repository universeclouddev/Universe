package gg.scala.universe.hz.task

import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.app.UniverseApplication
import java.util.concurrent.Callable

class UniverseCallableTask(private val payload: String) : Callable<String>, java.io.Serializable {
    override fun call(): String {
        log("Received task payload: $payload", LogLevel.DEBUG)
        val task = TaskDeserializer.deserialize(payload)
        val taskRouter = UniverseApplication.instance.injector.getInstance(TaskRouter::class.java)
        taskRouter.route(task)
        return "ack"
    }
}
