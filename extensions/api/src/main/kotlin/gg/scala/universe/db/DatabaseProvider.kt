package gg.scala.universe.db

import gg.scala.universe.schema.ApiKey

/**
 * Abstraction for database backends used by Universe.
 *
 * Extensions can register their own implementations (e.g., MongoDB, PostgreSQL)
 * via [DatabaseRegistry]. The core ships with H2 (default) and MySQL providers.
 */
interface DatabaseProvider {
    /** Unique provider key, e.g. "h2", "mysql", "mongodb". */
    val providerKey: String

    /** Establishes the database connection. Called once during startup. */
    fun connect()

    /** Closes the database connection. Called during shutdown. */
    fun disconnect()

    /** Returns true if the connection is active. */
    fun isConnected(): Boolean

    // ─── API Key Operations ───

    /** Retrieves an API key by its token string. */
    fun getApiKeyByToken(token: String): ApiKey?

    /** Retrieves an API key by its key ID. */
    fun getApiKeyById(keyId: String): ApiKey?

    /** Persists a new or updated API key. */
    fun saveApiKey(apiKey: ApiKey)

    /** Removes an API key. */
    fun deleteApiKey(keyId: String)

    /** Lists all stored API keys. */
    fun listApiKeys(): List<ApiKey>
}
