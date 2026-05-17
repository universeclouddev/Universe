package gg.scala.universe.db

import gg.scala.universe.config.DatabaseConfiguration
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.schema.ApiKey
import gg.scala.universe.schema.ApiPermission
import org.jooq.DSLContext
import org.jooq.impl.DSL
import org.jooq.impl.SQLDataType
import java.sql.Connection
import java.sql.DriverManager

/**
 * Embedded H2 database provider using jOOQ Kotlin extensions for type-safe SQL.
 *
 * Uses the [DatabaseConfiguration.url] field as the database file name.
 * The file is created under `./data/` if a relative path is given.
 */
class H2DatabaseProvider(private val config: DatabaseConfiguration) : DatabaseProvider {

    override val providerKey: String = "h2"

    private var connection: Connection? = null
    private var dsl: DSLContext? = null

    override fun connect() {
        val url = buildJdbcUrl()
        log("Connecting to H2 database at $url")
        connection = DriverManager.getConnection(url, config.username, config.password)
        dsl = DSL.using(connection)
        createSchema()
        log("H2 database connected successfully")
    }

    override fun disconnect() {
        try {
            connection?.close()
            log("H2 database disconnected")
        } catch (e: Exception) {
            log("Error closing H2 connection: ${e.message}", LogLevel.WARNING)
        }
        connection = null
        dsl = null
    }

    override fun isConnected(): Boolean {
        return connection?.isClosed == false
    }

    private fun buildJdbcUrl(): String {
        val dbPath = if (config.url.startsWith("/") || config.url.contains(":")) {
            config.url
        } else {
            "./data/${config.url}"
        }
        return "jdbc:h2:file:$dbPath;MODE=MySQL;DB_CLOSE_DELAY=-1"
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

    // ─── API Key Operations ───

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
        dsl!!.mergeInto(table)
            .using(dsl!!.selectOne())
            .on(keyIdField.eq(apiKey.keyId))
            .whenMatchedThenUpdate()
            .set(tokenField, apiKey.token)
            .set(permField, apiKey.permission.name)
            .whenNotMatchedThenInsert(DSL.field(DSL.name("key_id")), tokenField, permField)
            .values(apiKey.keyId, apiKey.token, apiKey.permission.name)
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
