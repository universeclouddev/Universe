package gg.scala.universe.util.json.adapter

import com.google.gson.*
import java.lang.reflect.Type
import java.util.*

class UUIDAdapter : JsonSerializer<UUID?>, JsonDeserializer<UUID?> {
    @Throws(JsonParseException::class)
    override fun deserialize(element: JsonElement?, type: Type, context: JsonDeserializationContext): UUID? {
        if (element == null || element.isJsonNull) return null
        return try {
            UUID.fromString(element.asString)
        } catch (e: IllegalArgumentException) {
            null
        }
    }

    override fun serialize(uuid: UUID?, type: Type, context: JsonSerializationContext): JsonElement? {
        if (uuid == null) return null

        return JsonPrimitive(uuid.toString())
    }
}
