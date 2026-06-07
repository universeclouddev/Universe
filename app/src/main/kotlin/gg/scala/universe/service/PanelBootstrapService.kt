package gg.scala.universe.service

import com.google.inject.Inject
import com.google.inject.Singleton
import gg.scala.universe.config.UniverseMainConfiguration
import gg.scala.universe.console.log
import gg.scala.universe.db.DatabaseProvider
import gg.scala.universe.schema.ApiKey
import gg.scala.universe.schema.ApiPermission
import java.util.UUID

/**
 * Ensures a dedicated ALL-permission API key exists for the admin panel.
 * Created automatically on first master start so users never run `key create` manually.
 */
@Singleton
class PanelBootstrapService @Inject constructor(
    private val database: DatabaseProvider,
    private val configuration: UniverseMainConfiguration,
) {
    fun ensurePanelKey(): ApiKey {
        val existing = database.getApiKeyById(PANEL_KEY_ID)
        if (existing != null) return existing

        val token = generateToken()
        val apiKey = ApiKey(PANEL_KEY_ID, token, ApiPermission.ALL)
        database.saveApiKey(apiKey)
        log("Created panel API key (id: $PANEL_KEY_ID) for the admin UI")
        return apiKey
    }

    fun getPanelKey(): ApiKey? = database.getApiKeyById(PANEL_KEY_ID)

    fun bootstrapAllowed(): Boolean {
        return configuration.allowPanelBootstrap
    }

    fun publicApiUrl(): String {
        val host = if (configuration.address == "0.0.0.0") "127.0.0.1" else configuration.address
        return "http://$host:${configuration.apiPort}"
    }

    private fun generateToken(): String = "unv_" + UUID.randomUUID().toString().replace("-", "")

    companion object {
        const val PANEL_KEY_ID = "panel"
    }
}
