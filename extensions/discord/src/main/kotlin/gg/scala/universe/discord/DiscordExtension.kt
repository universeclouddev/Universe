package gg.scala.universe.discord

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.inject.Inject
import gg.scala.universe.cluster.ClusterDataProvider
import gg.scala.universe.console.LogLevel
import gg.scala.universe.extension.Extension
import gg.scala.universe.console.log
import net.dv8tion.jda.api.JDA
import net.dv8tion.jda.api.JDABuilder
import net.dv8tion.jda.api.entities.Activity
import net.dv8tion.jda.api.requests.GatewayIntent
import net.dv8tion.jda.api.utils.ChunkingFilter
import net.dv8tion.jda.api.utils.MemberCachePolicy
import net.dv8tion.jda.api.utils.cache.CacheFlag
import org.incendo.cloud.discord.jda6.JDA6CommandManager
import org.incendo.cloud.discord.jda6.JDAInteraction
import org.incendo.cloud.execution.ExecutionCoordinator
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

class DiscordExtension : Extension {

    @Inject
    private var clusterDataProvider: ClusterDataProvider? = null

    private val gson: Gson = GsonBuilder().setPrettyPrinting().create()
    private var jda: JDA? = null
    private var commandManager: JDA6CommandManager<JDAInteraction>? = null
    private var scheduler: ScheduledExecutorService? = null
    private var config: DiscordConfig? = null

    override fun id(): String = "discord"
    override fun version(): String = "0.0.1"
    override fun masterOnly(): Boolean = true

    override fun onLoad() {
        config = loadConfig()

        if (config?.token.isNullOrEmpty() || config?.token == "YOUR_BOT_TOKEN_HERE") {
            log("Discord extension: No valid token configured. Set token in ./extensions/discord/config.json", LogLevel.WARNING)
            return
        }

        scheduler = Executors.newScheduledThreadPool(2)

        // Create Cloud JDA6 command manager
        val cmdManager = JDA6CommandManager(
            ExecutionCoordinator.asyncCoordinator(),
            JDAInteraction.InteractionMapper.identity()
        )
        commandManager = cmdManager

        // Parse annotated commands
        val annotationParser = org.incendo.cloud.annotations.AnnotationParser(
            cmdManager,
            JDAInteraction::class.java
        )
        annotationParser.parse(DiscordCommands(this))

        val intents = parseIntents(config!!.intents)
        jda = JDABuilder.createDefault(config!!.token, intents)
            .setActivity(Activity.watching("Universe Cluster"))
            .setChunkingFilter(ChunkingFilter.ALL)
            .disableCache(CacheFlag.VOICE_STATE, CacheFlag.EMOJI, CacheFlag.STICKER, CacheFlag.SOUNDBOARD_SOUNDS, CacheFlag.SCHEDULED_EVENTS)
            .setMemberCachePolicy(MemberCachePolicy.ALL)
            .addEventListeners(commandManager!!.createListener())
            .build()

        log("Discord extension loaded! Bot is online.", LogLevel.SUCCESS)
    }

    override fun onUnload() {
        jda?.shutdown()
        jda?.awaitShutdown(10, TimeUnit.SECONDS)
        scheduler?.shutdown()
        scheduler?.awaitTermination(5, TimeUnit.SECONDS)
        jda = null
        commandManager = null
        scheduler = null
        log("Discord extension unloaded.", LogLevel.SUCCESS)
    }

    override fun onReload() {
        onUnload()
        onLoad()
        log("Discord extension reloaded.", LogLevel.SUCCESS)
    }

    fun getConfig(): DiscordConfig? = config
    fun getJDA(): JDA? = jda
    fun getCommandManager(): JDA6CommandManager<JDAInteraction>? = commandManager
    fun getScheduler(): ScheduledExecutorService? = scheduler
    fun getClusterDataProvider(): ClusterDataProvider? = clusterDataProvider

    private fun loadConfig(): DiscordConfig {
        val configFile = File("extensions/discord/config.json")
        if (!configFile.exists()) {
            val defaultConfig = javaClass.getResourceAsStream("/config.json")?.bufferedReader()?.use { it.readText() }
                ?: defaultConfigJson()
            configFile.parentFile.mkdirs()
            configFile.writeText(defaultConfig)
        }

        return try {
            gson.fromJson(configFile.readText(), DiscordConfig::class.java)
        } catch (e: Exception) {
            log("Discord extension: Failed to load config.json: ${e.message}", LogLevel.ERROR)
            DiscordConfig()
        }
    }

    private fun parseIntents(intentNames: List<String>): Set<GatewayIntent> {
        return intentNames.mapNotNull { name ->
            try {
                GatewayIntent.valueOf(name)
            } catch (_: IllegalArgumentException) {
                log("Discord extension: Unknown intent '$name'", LogLevel.WARNING)
                null
            }
        }.toSet() + GatewayIntent.GUILD_MESSAGES
    }

    private fun defaultConfigJson(): String = """
    {
      "token": "YOUR_BOT_TOKEN_HERE",
      "guildId": "",
      "statusChannelId": "",
      "logChannelId": "",
      "embedColor": 5814783,
      "allowedRoleIds": [],
      "intents": ["MESSAGE_CONTENT", "GUILD_MESSAGES", "GUILD_MEMBERS"]
    }
    """.trimIndent()
}

data class DiscordConfig(
    val token: String = "",
    val guildId: String = "",
    val statusChannelId: String = "",
    val logChannelId: String = "",
    val embedColor: Int = 5814783,
    val allowedRoleIds: List<String> = emptyList(),
    val intents: List<String> = listOf("MESSAGE_CONTENT", "GUILD_MESSAGES", "GUILD_MEMBERS")
) {
    /** Returns true if no roles are configured (open access) or if the user has at least one allowed role. */
    fun isRoleAllowed(roleIds: Set<String>): Boolean {
        if (allowedRoleIds.isEmpty()) return true
        return roleIds.any { it in allowedRoleIds }
    }
}
