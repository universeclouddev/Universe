package gg.scala.universe.db.mongodb

import com.google.inject.Inject
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.db.DatabaseProvider
import gg.scala.universe.db.DatabaseRegistry
import gg.scala.universe.extension.Extension
import gg.scala.universe.schema.ApiKey
import gg.scala.universe.schema.ApiPermission
import com.mongodb.client.MongoClient
import com.mongodb.client.MongoClients
import com.mongodb.client.MongoCollection
import com.mongodb.client.MongoDatabase
import com.mongodb.client.model.Filters
import com.mongodb.client.model.IndexOptions
import com.mongodb.client.model.Indexes
import com.mongodb.client.model.ReplaceOptions
import org.bson.Document

/**
 * MongoDB database provider for storing API keys.
 *
 * Uses [DatabaseConfiguration.host], [port], [database], [username], and [password]
 * to connect to a MongoDB server. Connection string format:
 * mongodb://[username:password@]host[:port]/database
 */
class MongoDatabaseProvider(
    private val host: String,
    private val port: Int,
    private val database: String,
    private val username: String,
    private val password: String
) : DatabaseProvider {

    override val providerKey: String = "mongodb"

    private var client: MongoClient? = null
    private var db: MongoDatabase? = null
    private var collection: MongoCollection<Document>? = null

    override fun connect() {
        val connectionString = if (username.isNotBlank() && password.isNotBlank()) {
            "mongodb://$username:$password@$host:$port/$database"
        } else {
            "mongodb://$host:$port/$database"
        }
        log("Connecting to MongoDB at $host:$port/$database")
        client = MongoClients.create(connectionString)
        db = client!!.getDatabase(database)
        collection = db!!.getCollection("api_keys")

        // Ensure indexes
        collection!!.createIndex(Indexes.ascending("key_id"), IndexOptions().unique(true))
        collection!!.createIndex(Indexes.ascending("token"), IndexOptions().unique(true))

        log("MongoDB database connected successfully")
    }

    override fun disconnect() {
        try {
            client?.close()
            log("MongoDB database disconnected")
        } catch (e: Exception) {
            log("Error closing MongoDB connection: ${e.message}", LogLevel.WARNING)
        }
        client = null
        db = null
        collection = null
    }

    override fun isConnected(): Boolean {
        return try {
            client != null
        } catch (_: Exception) {
            false
        }
    }

    override fun getApiKeyByToken(token: String): ApiKey? {
        val doc = collection!!.find(Filters.eq("token", token)).first() ?: return null
        return doc.toApiKey()
    }

    override fun getApiKeyById(keyId: String): ApiKey? {
        val doc = collection!!.find(Filters.eq("key_id", keyId)).first() ?: return null
        return doc.toApiKey()
    }

    override fun saveApiKey(apiKey: ApiKey) {
        val doc = Document()
            .append("key_id", apiKey.keyId)
            .append("token", apiKey.token)
            .append("permission", apiKey.permission.name)

        collection!!.replaceOne(
            Filters.eq("key_id", apiKey.keyId),
            doc,
            ReplaceOptions().upsert(true)
        )
    }

    override fun deleteApiKey(keyId: String) {
        collection!!.deleteOne(Filters.eq("key_id", keyId))
    }

    override fun listApiKeys(): List<ApiKey> {
        return collection!!.find().map { it.toApiKey() }.toList()
    }

    private fun Document.toApiKey(): ApiKey {
        return ApiKey(
            keyId = getString("key_id"),
            token = getString("token"),
            permission = ApiPermission.valueOf(getString("permission"))
        )
    }
}
