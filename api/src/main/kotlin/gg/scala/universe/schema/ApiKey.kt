package gg.scala.universe.schema

/**
 * Represents an API key for authenticating REST API requests.
 *
 * @param keyId Human-readable identifier for the key (e.g., "master-key", "wrapper-1").
 * @param token The actual bearer token used in the Authorization header.
 * @param permission Access level granted by this key.
 */
data class ApiKey(
    val keyId: String,
    val token: String,
    val permission: ApiPermission
)

enum class ApiPermission {
    /** Full access to all endpoints, including admin and instance management. */
    ALL,

    /** Read-only access to public endpoints (status, list, info). */
    PUBLIC
}
