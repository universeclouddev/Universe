# Database Configuration

Universe supports pluggable database backends for storing API keys and other persistent data.
The database backend is configured via `./database.json` and follows the same registry pattern as [RuntimeProvider](../app/src/main/kotlin/gg/scala/universe/runtime/RuntimeProvider.kt) and [TemplateStorageProvider](../extensions/api/src/main/kotlin/gg/scala/universe/template/TemplateStorageProvider.kt).

All built-in providers use [jOOQ](https://www.jooq.org/) for type-safe SQL building without code generation.

## Configuration File

Create `./database.json` in the working directory:

```json
{
  "provider": "h2",
  "url": "universe.db",
  "host": "localhost",
  "port": 3306,
  "database": "universe",
  "username": "sa",
  "password": ""
}
```

All fields are present regardless of provider so the file serves as self-documenting reference.
Fields that are not used by the active provider are simply ignored.

### Field Reference

| Field      | Description                                                              |
|------------|--------------------------------------------------------------------------|
| `provider` | Database provider key. Built-ins: `h2` (default), `mysql`. Extensions: `postgres`, `mongodb`, `redis`. |
| `url`      | **H2 only**: Database file name (e.g. `universe.db`). Created under `./data/`. |
| `host`     | **MySQL only**: Database server hostname (e.g. `localhost`).             |
| `port`     | **MySQL only**: Database server port (default `3306`).                   |
| `database` | **MySQL only**: Schema / database name (e.g. `universe`).                |
| `username` | Database username.                                                       |
| `password` | Database password.                                                       |

## Built-in Providers

### H2 (Default)

Embedded file-based database. Zero external dependencies. Best for single-node or development setups.

```json
{
  "provider": "h2",
  "url": "universe.db",
  "host": "localhost",
  "port": 3306,
  "database": "universe",
  "username": "sa",
  "password": ""
}
```

The file is created at `./data/universe.db` (relative to the working directory).  
H2 runs in MySQL compatibility mode (`MODE=MySQL`) so the same SQL works for both providers.

### MySQL

Connects to a remote MySQL or MariaDB server via TCP.

```json
{
  "provider": "mysql",
  "url": "universe.db",
  "host": "db.example.com",
  "port": 3306,
  "database": "universe",
  "username": "universe",
  "password": "changeme"
}
```

The MySQL provider uses the MariaDB JDBC driver (`org.mariadb.jdbc:mariadb-java-client`) for better compatibility with both MySQL and MariaDB servers.

### PostgreSQL (Extension)

Connects to a remote PostgreSQL server via TCP. Place the `extension-db-postgres` JAR in the `extensions/` directory.

```json
{
  "provider": "postgres",
  "url": "universe.db",
  "host": "db.example.com",
  "port": 5432,
  "database": "universe",
  "username": "universe",
  "password": "changeme"
}
```

### MongoDB (Extension)

Connects to a MongoDB server. Place the `extension-db-mongodb` JAR in the `extensions/` directory.

```json
{
  "provider": "mongodb",
  "url": "universe.db",
  "host": "db.example.com",
  "port": 27017,
  "database": "universe",
  "username": "universe",
  "password": "changeme"
}
```

### Redis (Extension)

Connects to a Redis server for ultra-fast key lookups. Place the `extension-db-redis` JAR in the `extensions/` directory.

```json
{
  "provider": "redis",
  "url": "universe.db",
  "host": "localhost",
  "port": 6379,
  "database": "universe",
  "username": "",
  "password": ""
}
```

## Custom Providers (Extensions)

Extensions can register their own database providers via [DatabaseRegistry](../extensions/api/src/main/kotlin/gg/scala/universe/db/DatabaseRegistry.kt).

1. Implement [DatabaseProvider](../extensions/api/src/main/kotlin/gg/scala/universe/db/DatabaseProvider.kt).
2. Register it in your extension's `onLoad()`:

```kotlin
class MongoExtension @Inject constructor(
    private val registry: DatabaseRegistry
) : Extension {
    override fun id() = "mongodb"
    override fun version() = "1.0.0"

    override fun onLoad() {
        registry.register("mongodb", MongoDatabaseProvider(config))
    }

    override fun onUnload() {}
    override fun onReload() {}
}
```

3. Set `provider` in `database.json` to your custom key:

```json
{
  "provider": "mongodb",
  ...
}
```

## Schema

The core automatically creates the `api_keys` table on startup:

```sql
CREATE TABLE IF NOT EXISTS api_keys (
    key_id     VARCHAR(64) PRIMARY KEY,
    token      VARCHAR(256) NOT NULL UNIQUE,
    permission VARCHAR(16)  NOT NULL
);
```

You can manage keys via the REST API or console commands (future).
