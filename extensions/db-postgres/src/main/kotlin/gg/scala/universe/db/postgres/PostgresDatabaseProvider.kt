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
        val table = DSL.name("api_keys")
        dsl!!.createTableIfNotExists(table)
            .column(DSL.name("key_id"), SQLDataType.VARCHAR(64).nullable(false))
            .column(DSL.name("token"), SQLDataType.VARCHAR(256).nullable(false))
            .column(DSL.name("permission"), SQLDataType.VARCHAR(16).nullable(false))
            .constraints(
                DSL.constraint("pk_api_keys").primaryKey(DSL.name("key_id")),
                DSL.constraint("uk_api_keys_token").unique(DSL.name("token"))
            )
            .execute()
    }

    override fun getApiKeyByToken(token: String): ApiKey? {
        return dsl!!.selectFrom(DSL.name("api_keys"))
            .where(DSL.field(DSL.name("token")).eq(token))
            .fetchOne()
            ?.toApiKey()
    }

    override fun getApiKeyById(keyId: String): ApiKey? {
        return dsl!!.selectFrom(DSL.name("api_keys"))
            .where(DSL.field(DSL.name("key_id")).eq(keyId))
            .fetchOne()
            ?.toApiKey()
    }

    override fun saveApiKey(apiKey: ApiKey) {
        val table = DSL.table(DSL.name("api_keys"))
        val keyIdField = DSL.field(DSL.name("key_id"))
        val tokenField = DSL.field(DSL.name("token"), String::class.java)
        val permField = DSL.field(DSL.name("permission"), String::class.java)
        dsl!!.insertInto(table)
            .set(keyIdField, apiKey.keyId)
            .set(tokenField, apiKey.token)
            .set(permField, apiKey.permission.name)
            .onConflict(keyIdField)
            .doUpdate()
            .set(tokenField, apiKey.token)
            .set(permField, apiKey.permission.name)
            .execute()
    }

    override fun deleteApiKey(keyId: String) {
        dsl!!.deleteFrom(DSL.table(DSL.name("api_keys")))
            .where(DSL.field(DSL.name("key_id")).eq(keyId))
            .execute()
    }

    override fun listApiKeys(): List<ApiKey> {
        return dsl!!.selectFrom(DSL.name("api_keys"))
            .fetch()
            .map { it.toApiKey() }
    }

    private fun org.jooq.Record.toApiKey(): ApiKey {
        return ApiKey(
            keyId = get(DSL.name("key_id"), String::class.java),
            token = get(DSL.name("token"), String::class.java),
            permission = ApiPermission.valueOf(get(DSL.name("permission"), String::class.java))
        )
    }
}
