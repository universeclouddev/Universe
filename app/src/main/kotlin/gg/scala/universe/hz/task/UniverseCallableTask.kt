package gg.scala.universe.hz.task

import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import gg.scala.universe.app.UniverseApplication
import java.util.concurrent.Callable

class UniverseCallableTask(private val payload: String) : Callable<String>, java.io.Serializable {
    override fun call(): String {
        log("Received task payload: $payload", LogType.INFORMATION)
        val task = TaskDeserializer.deserialize(payload)
        val taskRouter = UniverseApplication.instance.injector.getInstance(TaskRouter::class.java)
        taskRouter.route(task)
        return "ack"
    }
}
