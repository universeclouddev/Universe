package gg.scala.universe.config

/**
 * Unified database configuration used by all database providers.
 *
 * All fields are present regardless of provider so the file serves as
 * self-documenting reference. Unused fields are ignored by the active provider.
 *
 * @param provider Database provider key: "h2" (default), "mysql", or extension-provided keys.
 * @param url For H2: the database file name (e.g. "universe.db"). For others: ignored.
 * @param host For MySQL: the database host (e.g. "localhost"). For H2: ignored.
 * @param port For MySQL: the database port (default 3306). For H2: ignored.
 * @param database For MySQL: the database/schema name (e.g. "universe"). For H2: ignored.
 * @param username Database username.
 * @param password Database password.
 */
data class DatabaseConfiguration(
    val provider: String = "h2",
    val url: String = "universe.db",
    val host: String = "localhost",
    val port: Int = 3306,
    val database: String = "universe",
    val username: String = "sa",
    val password: String = ""
)
