package gg.scala.universe.db.postgres

import com.google.inject.Inject
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.db.DatabaseProvider
import gg.scala.universe.db.DatabaseRegistry
import gg.scala.universe.extension.Extension
import gg.scala.universe.schema.ApiKey
import gg.scala.universe.schema.ApiPermission
import org.jooq.DSLContext
import org.jooq.impl.DSL
import org.jooq.impl.SQLDataType
import java.sql.Connection
import java.sql.DriverManager

/**
 * PostgreSQL database provider using jOOQ Kotlin extensions for type-safe SQL.
 *
 * Uses [DatabaseConfiguration.host], [port], [database], [username], and [password]
 * to establish a TCP connection to a PostgreSQL server.
 */
class PostgresDatabaseProvider(
    private val host: String,
    private val port: Int,
    private val database: String,
    private val username: String,
    private val password: String
) : DatabaseProvider {

    override val providerKey: String = "postgres"

    private var connection: Connection? = null
    private var dsl: DSLContext? = null

    override fun connect() {
        val url = "jdbc:postgresql://$host:$port/$database"
        log("Connecting to PostgreSQL database at $url")
        connection = DriverManager.getConnection(url, username, password)
        dsl = DSL.using(connection)
        createSchema()
        log("PostgreSQL database connected successfully")
    }

    override fun disconnect() {
        try {
            connection?.close()
            log("PostgreSQL database disconnected")
        } catch (e: Exception) {
            log("Error closing PostgreSQL connection: ${e.message}", LogLevel.WARNING)
        }
        connection = null
        dsl = null
    }

    override fun isConnected(): Boolean {
        return connection?.isClosed == false
    }

    private fun createSchema() {
        dsl!!.createTableIfNotExists("api_keys")
            .column("key_id", SQLDataType.VARCHAR(64).nullable(false))
            .column("token", SQLDataType.VARCHAR(256).nullable(false))
            .column("permission", SQLDataType.VARCHAR(16).nullable(false))
            .constraints(
                DSL.constraint("pk_api_keys").primaryKey("key_id"),
                DSL.constraint("uk_api_keys_token").unique("token")
            )
            .execute()
    }

    override fun getApiKeyByToken(token: String): ApiKey? {
        return dsl!!.selectFrom("api_keys")
            .where(DSL.field("token").eq(token))
            .fetchOne()
            ?.toApiKey()
    }

    override fun getApiKeyById(keyId: String): ApiKey? {
        return dsl!!.selectFrom("api_keys")
            .where(DSL.field("key_id").eq(keyId))
            .fetchOne()
            ?.toApiKey()
    }

    override fun saveApiKey(apiKey: ApiKey) {
        dsl!!.insertInto(DSL.table("api_keys"))
            .set(DSL.field("key_id", String::class.java), apiKey.keyId)
            .set(DSL.field("token", String::class.java), apiKey.token)
            .set(DSL.field("permission", String::class.java), apiKey.permission.name)
            .onConflict(DSL.field("key_id"))
            .doUpdate()
            .set(DSL.field("token", String::class.java), apiKey.token)
            .set(DSL.field("permission", String::class.java), apiKey.permission.name)
            .execute()
    }

    override fun deleteApiKey(keyId: String) {
        dsl!!.deleteFrom(DSL.table("api_keys"))
            .where(DSL.field("key_id").eq(keyId))
            .execute()
    }

    override fun listApiKeys(): List<ApiKey> {
        return dsl!!.selectFrom("api_keys")
            .fetch()
            .map { it.toApiKey() }
    }

    private fun org.jooq.Record.toApiKey(): ApiKey {
        return ApiKey(
            keyId = get("key_id", String::class.java),
            token = get("token", String::class.java),
            permission = ApiPermission.valueOf(get("permission", String::class.java))
        )
    }
}
