package gg.scala.universe.discord

import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import net.dv8tion.jda.api.EmbedBuilder
import org.incendo.cloud.annotations.Argument
import org.incendo.cloud.annotations.Command
import org.incendo.cloud.annotations.CommandDescription
import org.incendo.cloud.discord.jda6.JDAInteraction
import java.awt.Color
import java.time.Instant

class DiscordCommands(
    private val extension: DiscordExtension
) {

    @Command("status")
    @CommandDescription("Show cluster status")
    fun status(interaction: JDAInteraction) {
        if (!hasRole(interaction)) return

        val instances = extension.getClusterDataProvider()?.getActiveInstances() ?: emptyList()
        val configs = extension.getClusterDataProvider()?.getConfigurations() ?: emptyList()

        val embed = EmbedBuilder()
            .setTitle("Universe Cluster Status")
            .setColor(Color(extension.getConfig()?.embedColor ?: 5814783))
            .setTimestamp(Instant.now())
            .addField("Active Instances", "${instances.size}", true)
            .addField("Configurations", "${configs.size}", true)
            .addField("Status", "Online", true)

        interaction.replyCallback()?.replyEmbeds(embed.build())?.queue()
    }

    @Command("instances")
    @CommandDescription("List all active instances")
    fun instances(interaction: JDAInteraction) {
        if (!hasRole(interaction)) return

        interaction.replyCallback()?.deferReply()?.queue { hook ->
            extension.getScheduler()?.execute {
                val instances = extension.getClusterDataProvider()?.getActiveInstances() ?: emptyList()

                if (instances.isEmpty()) {
                    hook.sendMessageEmbeds(
                        createErrorEmbed("No Instances", "There are no active instances in the cluster.")
                    ).queue()
                    return@execute
                }

                val embed = EmbedBuilder()
                    .setTitle("Active Instances")
                    .setColor(Color(extension.getConfig()?.embedColor ?: 5814783))
                    .setTimestamp(Instant.now())

                instances.forEach { instance ->
                    val state = instance.state.name
                    embed.addField(
                        instance.configurationName,
                        "**ID:** `${instance.id}`\n**State:** $state\n**Address:** `${instance.hostAddress}:${instance.allocatedPort}`\n**Runtime:** ${instance.runtime}",
                        false
                    )
                }

                hook.sendMessageEmbeds(embed.build()).queue()
            }
        }
    }

    @Command("configurations")
    @CommandDescription("List all configurations")
    fun configurations(interaction: JDAInteraction) {
        if (!hasRole(interaction)) return

        interaction.replyCallback()?.deferReply()?.queue { hook ->
            extension.getScheduler()?.execute {
                val configs = extension.getClusterDataProvider()?.getConfigurations() ?: emptyList()

                if (configs.isEmpty()) {
                    hook.sendMessageEmbeds(
                        createErrorEmbed("No Configurations", "There are no configurations defined.")
                    ).queue()
                    return@execute
                }

                val embed = EmbedBuilder()
                    .setTitle("Configurations")
                    .setColor(Color(extension.getConfig()?.embedColor ?: 5814783))
                    .setTimestamp(Instant.now())

                configs.forEach { config ->
                    embed.addField(
                        config.name,
                        "**Runtime:** ${config.runtime}\n**RAM:** ${config.ramMB}MB\n**CPU:** ${config.cpu}%",
                        true
                    )
                }

                hook.sendMessageEmbeds(embed.build()).queue()
            }
        }
    }

    @Command("instance <id>")
    @CommandDescription("Get details for a specific instance")
    fun instanceDetails(
        interaction: JDAInteraction,
        @Argument("id") instanceId: String
    ) {
        if (!hasRole(interaction)) return

        interaction.replyCallback()?.deferReply()?.queue { hook ->
            extension.getScheduler()?.execute {
                val instance = extension.getClusterDataProvider()?.getAllInstances()?.find { it.id == instanceId }

                if (instance == null) {
                    hook.sendMessageEmbeds(
                        createErrorEmbed("Instance Not Found", "No instance found with ID `$instanceId`")
                    ).queue()
                    return@execute
                }

                val embed = EmbedBuilder()
                    .setTitle("Instance: ${instance.configurationName}")
                    .setColor(Color(extension.getConfig()?.embedColor ?: 5814783))
                    .setTimestamp(Instant.now())
                    .addField("ID", "`${instance.id}`", true)
                    .addField("State", instance.state.name, true)
                    .addField("Runtime", instance.runtime, true)
                    .addField("Address", "`${instance.hostAddress}:${instance.allocatedPort}`", true)
                    .addField("RAM", "${instance.allocatedRamMB}MB", true)
                    .addField("CPU", "${instance.allocatedCpu}%", true)
                    .addField("Wrapper Node", instance.wrapperNodeId, true)

                hook.sendMessageEmbeds(embed.build()).queue()
            }
        }
    }

    @Command("start <configuration>")
    @CommandDescription("Start a new instance")
    fun start(
        interaction: JDAInteraction,
        @Argument("configuration") configuration: String
    ) {
        if (!hasRole(interaction)) return

        interaction.replyCallback()?.deferReply()?.queue { hook ->
            extension.getScheduler()?.execute {
                hook.sendMessageEmbeds(
                    createInfoEmbed("Start Requested", "Instance start requested for configuration `$configuration`. Check the master console for status.")
                ).queue()
            }
        }
    }

    @Command("stop <id>")
    @CommandDescription("Stop an instance")
    fun stop(
        interaction: JDAInteraction,
        @Argument("id") instanceId: String
    ) {
        if (!hasRole(interaction)) return

        interaction.replyCallback()?.deferReply()?.queue { hook ->
            extension.getScheduler()?.execute {
                hook.sendMessageEmbeds(
                    createInfoEmbed("Stop Requested", "Instance stop requested for `$instanceId`. Check the master console for status.")
                ).queue()
            }
        }
    }

    @Command("execute <id> <command>")
    @CommandDescription("Execute a command on an instance")
    fun execute(
        interaction: JDAInteraction,
        @Argument("id") instanceId: String,
        @Argument("command") command: String
    ) {
        if (!hasRole(interaction)) return

        interaction.replyCallback()?.deferReply()?.queue { hook ->
            extension.getScheduler()?.execute {
                hook.sendMessageEmbeds(
                    createInfoEmbed("Command Executed", "Command `$command` sent to instance `$instanceId`.")
                ).queue()
            }
        }
    }

    // ---- Role Checking ----

    private fun hasRole(interaction: JDAInteraction): Boolean {
        val config = extension.getConfig() ?: return true
        if (config.allowedRoleIds.isEmpty()) return true

        val member = interaction.interactionEvent()?.member
        if (member == null) {
            interaction.replyCallback()
                ?.replyEmbeds(createErrorEmbed("Access Denied", "Could not verify your roles."))
                ?.setEphemeral(true)
                ?.queue()
            return false
        }

        val userRoleIds = member.roles.map { it.id }.toSet()
        if (!config.isRoleAllowed(userRoleIds)) {
            interaction.replyCallback()
                ?.replyEmbeds(createErrorEmbed("Access Denied", "You do not have permission to use this command."))
                ?.setEphemeral(true)
                ?.queue()
            return false
        }

        return true
    }

    // ---- Helpers ----

    private fun createErrorEmbed(title: String, description: String) = EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(Color.RED)
        .setTimestamp(Instant.now())
        .build()

    private fun createInfoEmbed(title: String, description: String) = EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(Color(extension.getConfig()?.embedColor ?: 5814783))
        .setTimestamp(Instant.now())
        .build()
}
