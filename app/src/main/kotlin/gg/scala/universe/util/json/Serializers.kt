package gg.scala.universe.util.json

import gg.scala.universe.util.json.adapter.ClassAdapter
import gg.scala.universe.util.json.adapter.ExclusionStrategyAdapter
import gg.scala.universe.util.json.adapter.LocalDateTimeAdapter
import gg.scala.universe.util.json.adapter.PostProcessAdapter
import gg.scala.universe.util.json.adapter.UUIDAdapter
import gg.scala.universe.util.json.adapter.VersionTypeAdapter
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.LongSerializationPolicy
//import org.bson.json.JsonMode
//import org.bson.json.JsonWriterSettings
//import org.bson.json.StrictJsonWriter
//import org.bson.types.ObjectId
import java.time.LocalDateTime
import java.util.*

object Serializers {
    @JvmField var GSON: Gson = GsonBuilder()
        .registerTypeAdapter(UUID::class.java, UUIDAdapter())
        .registerTypeAdapter(LocalDateTime::class.java, LocalDateTimeAdapter())
        .registerTypeAdapter(Class::class.java, ClassAdapter())
        .setLongSerializationPolicy(LongSerializationPolicy.STRING)
        .setExclusionStrategies(ExclusionStrategyAdapter())
        .registerTypeAdapterFactory(PostProcessAdapter())
        .registerTypeAdapterFactory(VersionTypeAdapter())
        .setPrettyPrinting()
        .serializeNulls()
        .create()


//    @JvmField val JSON_WRITER_SETTINGS: JsonWriterSettings = JsonWriterSettings.builder()
//        .objectIdConverter { objectId: ObjectId, strictJsonWriter: StrictJsonWriter ->
//            strictJsonWriter.writeString(
//                objectId.toHexString()
//            )
//        }
//        .int64Converter { value: Long, writer: StrictJsonWriter -> writer.writeNumber(value.toString()) }
//        .outputMode(JsonMode.RELAXED)
//        .build()

    @JvmStatic
    fun registerTypeAdapter(baseClass: Class<*>, typeAdapter: Any) {
        useGsonBuilderThenRebuild {
            registerTypeAdapter(baseClass, typeAdapter)
        }
    }

    @JvmStatic
    fun useGsonBuilderThenRebuild(builder: GsonBuilder.() -> GsonBuilder) {
        GSON = builder(GSON.newBuilder()).create()
    }
}