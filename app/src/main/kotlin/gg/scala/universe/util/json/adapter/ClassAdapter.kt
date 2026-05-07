package gg.scala.universe.util.json.adapter

import com.google.gson.*
import java.lang.reflect.Type

class ClassAdapter : JsonSerializer<Class<*>?>, JsonDeserializer<Class<*>?> {
    override fun deserialize(element: JsonElement?, type: Type?, context: JsonDeserializationContext?): Class<*>? {
        if (element == null || element.isJsonNull) return null

        try {
            return Class.forName(element.asString)
        } catch (e: ClassNotFoundException) {
            e.printStackTrace()
            return null
        }
    }

    override fun serialize(clazz: Class<*>?, type: Type?, context: JsonSerializationContext?): JsonElement? {
        return if (clazz == null) null else JsonPrimitive(clazz.getName())
    }
}
