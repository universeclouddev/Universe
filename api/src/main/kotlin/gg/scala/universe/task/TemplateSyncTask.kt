package gg.scala.universe.task

import gg.scala.universe.util.json.Serializers

/**
 * Task sent to a Wrapper to sync a template.
 * When [templateZipBytes] is null, it represents a sync request.
 * When non-null, it contains the actual zip data payload.
 */
data class TemplateSyncTask(
    val group: String,
    val name: String,
    val templateZipBytes: ByteArray? = null,
    override val type: String = "template_sync"
) : UniverseTask {
    fun toJson(): String = Serializers.GSON.toJson(this)

    companion object {
        fun fromJson(json: String): TemplateSyncTask =
            Serializers.GSON.fromJson(json, TemplateSyncTask::class.java)
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as TemplateSyncTask

        if (group != other.group) return false
        if (name != other.name) return false
        if (!templateZipBytes.contentEquals(other.templateZipBytes)) return false
        if (type != other.type) return false

        return true
    }

    override fun hashCode(): Int {
        var result = group.hashCode()
        result = 31 * result + name.hashCode()
        result = 31 * result + (templateZipBytes?.contentHashCode() ?: 0)
        result = 31 * result + type.hashCode()
        return result
    }
}
