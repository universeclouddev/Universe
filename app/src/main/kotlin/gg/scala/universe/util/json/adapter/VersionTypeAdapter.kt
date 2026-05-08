package gg.scala.universe.util.json.adapter

import gg.scala.universe.util.json.Version
import com.google.gson.*
import com.google.gson.reflect.TypeToken
import com.google.gson.stream.JsonReader
import com.google.gson.stream.JsonWriter

class VersionTypeAdapter : TypeAdapterFactory {
    override fun <T : Any> create(gson: Gson, type: TypeToken<T>): TypeAdapter<T>? {
        val rawType = type.rawType
        val delegate = gson.getDelegateAdapter(this, type)
        val elementAdapter = gson.getAdapter(JsonElement::class.java)

        // Capture class version
        val classVersion = rawType.getAnnotation(Version::class.java)?.value ?: 0

        if (classVersion <= 0) {
            return null
        }

        return object : TypeAdapter<T>() {
            override fun write(out: JsonWriter, value: T?) {
                val tree = delegate.toJsonTree(value)

                // Only attempt to add versioning if it's actually a JSON Object
                if (tree.isJsonObject) {
                    val jsonObject = tree.asJsonObject
                    if (classVersion > 0) {
                        jsonObject.addProperty("__version", classVersion)
                    }
                    elementAdapter.write(out, jsonObject)
                } else {
                    // If it's a primitive (UUID, String, etc.) or Array, write it as-is
                    elementAdapter.write(out, tree)
                }
            }

            override fun read(reader: JsonReader): T? {
                val jsonElement = elementAdapter.read(reader)
                if (jsonElement.isJsonNull) return null

                // Only process versioning logic if we are dealing with an object
                if (jsonElement.isJsonObject) {
                    val jsonObject = jsonElement.asJsonObject
                    val jsonVersion = jsonObject.get("__version")?.asInt ?: 0

                    val result = delegate.fromJsonTree(jsonObject)

                    if (result != null) {
                        fillNewerFields(result, jsonVersion, gson)
                    }
                    return result
                }

                // Otherwise, just return the standard deserialization
                return delegate.fromJsonTree(jsonElement)
            }

            private fun fillNewerFields(result: T, jsonVersion: Int, gson: Gson) {
                rawType.declaredFields.forEach { field ->
                    val fieldVersion = field.getAnnotation(Version::class.java)?.value ?: 0
                    
                    // If the field is newer than the JSON version, it likely came back null
                    if (fieldVersion > jsonVersion) {
                        field.isAccessible = true
                        if (field.get(result) == null) {
                            // Instantiate a "fresh" instance for the field
                            val fieldInstance = gson.fromJson("{}", field.type)
                            field.set(result, fieldInstance)
                        }
                    }
                }
            }
        }
    }
}