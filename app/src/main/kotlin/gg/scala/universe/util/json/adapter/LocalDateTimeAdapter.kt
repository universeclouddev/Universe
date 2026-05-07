package gg.scala.universe.util.json.adapter

import com.google.gson.*
import java.lang.reflect.Type
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter


class LocalDateTimeAdapter : JsonSerializer<LocalDateTime?>, JsonDeserializer<LocalDateTime?> {
    override fun serialize(time: LocalDateTime?, type: Type?, context: JsonSerializationContext?): JsonElement? {
        if (time == null) return null

        return JsonPrimitive(time.format(formatter))
    }

    @Throws(JsonParseException::class)
    override fun deserialize(json: JsonElement?, typeOfT: Type?, context: JsonDeserializationContext?): LocalDateTime? {
        if (json == null || json.isJsonNull) return null

        return LocalDateTime.parse(json.asString, formatter)
    }

    companion object {
        private val formatter: DateTimeFormatter = DateTimeFormatter.ISO_DATE_TIME
    }
}