package gg.scala.universe.hz.task

import com.google.gson.JsonParser
import gg.scala.universe.task.DeployInstanceTask
import gg.scala.universe.task.ExecuteCommandTask
import gg.scala.universe.task.ShutdownNodeTask
import gg.scala.universe.task.StopInstanceTask
import gg.scala.universe.task.TemplateSyncTask
import gg.scala.universe.task.UniverseTask
import gg.scala.universe.util.json.Serializers

object TaskDeserializer {
    fun deserialize(payload: String): UniverseTask {
        val jsonObject = JsonParser.parseString(payload).asJsonObject
        val type = jsonObject.get("type")?.asString
            ?: error("Missing 'type' field in task payload")

        return when (type) {
            "deploy" -> Serializers.GSON.fromJson(payload, DeployInstanceTask::class.java)
            "stop" -> Serializers.GSON.fromJson(payload, StopInstanceTask::class.java)
            "execute" -> Serializers.GSON.fromJson(payload, ExecuteCommandTask::class.java)
            "template_sync" -> Serializers.GSON.fromJson(payload, TemplateSyncTask::class.java)
            "shutdown" -> Serializers.GSON.fromJson(payload, ShutdownNodeTask::class.java)
            else -> error("Unknown task type: $type")
        }
    }
}
