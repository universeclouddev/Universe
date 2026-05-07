package gg.scala.universe.util.json.adapter

import gg.scala.universe.util.json.`interface`.PostProcessable
import com.google.gson.Gson
import com.google.gson.TypeAdapter
import com.google.gson.TypeAdapterFactory
import com.google.gson.reflect.TypeToken
import com.google.gson.stream.JsonReader
import com.google.gson.stream.JsonWriter

class PostProcessAdapter : TypeAdapterFactory {
    override fun <T> create(gson: Gson, type: TypeToken<T>): TypeAdapter<T>? {
        val delegate = gson.getDelegateAdapter(this, type)
        if (!PostProcessable::class.java.isAssignableFrom(type.rawType)) {
            return null
        }

        return object : TypeAdapter<T>() {
            override fun write(out: JsonWriter?, value: T) {
                delegate.write(out, value)
            }

            override fun read(`in`: JsonReader?): T {
                val obj = delegate.read(`in`)

                if (obj is PostProcessable) {
                    obj.postProcess()
                }

                return obj
            }
        }
    }
}