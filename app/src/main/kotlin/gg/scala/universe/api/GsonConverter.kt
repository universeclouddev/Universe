package gg.scala.universe.api

import gg.scala.universe.util.json.Serializers
import io.ktor.http.ContentType
import io.ktor.http.content.TextContent
import io.ktor.http.withCharset
import io.ktor.serialization.ContentConverter
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.util.reflect.TypeInfo
import io.ktor.util.reflect.reifiedType
import io.ktor.utils.io.ByteReadChannel
import io.ktor.utils.io.charsets.Charset
import io.ktor.utils.io.jvm.javaio.toInputStream

class GsonConverter : ContentConverter {
    override suspend fun serialize(
        contentType: ContentType,
        charset: Charset,
        typeInfo: TypeInfo,
        value: Any?
    ): io.ktor.http.content.OutgoingContent {
        return TextContent(Serializers.GSON.toJson(value), contentType.withCharset(Charsets.UTF_8))
    }

    override suspend fun deserialize(
        charset: Charset,
        typeInfo: TypeInfo,
        content: ByteReadChannel
    ): Any? {
        val reader = content.toInputStream().reader(charset)
        return Serializers.GSON.fromJson(reader, typeInfo.reifiedType)
    }
}

fun Application.configureSerialization() {
    install(ContentNegotiation) {
        register(ContentType.Application.Json, GsonConverter())
    }
}
