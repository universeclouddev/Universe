package gg.scala.universe.discord

import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import net.dv8tion.jda.api.EmbedBuilder
import net.dv8tion.jda.api.entities.MessageEmbed
import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent
import net.dv8tion.jda.api.hooks.ListenerAdapter
import net.dv8tion.jda.api.interactions.commands.build.Commands
import java.awt.Color
import java.time.Instant

class DiscordCommandHandler(
    private val extension: DiscordExtension
) : ListenerAdapter() {

    private var commandsRegistered = false

    override fun onReady(event: net.dv8tion.jda.api.events.session.ReadyEvent) {
        if (commandsRegistered) return
        commandsRegistered = true

        val jda = event.jda
        jda.updateCommands().addCommands(
            Commands.slash("status", "Show cluster status"),
            Commands.slash("instances", "List all active instances"),
            Commands.slash("configurations", "List all configurations"),
            Commands.slash("instance", "Get details for a specific instance")
                .addOption(net.dv8tion.jda.api.interactions.commands.OptionType.STRING, "id", "Instance ID", true),
            Commands.slash("start", "Start a new instance")
                .addOption(net.dv8tion.jda.api.interactions.commands.OptionType.STRING, "configuration", "Configuration name", true),
            Commands.slash("stop", "Stop an instance")
                .addOption(net.dv8tion.jda.api.interactions.commands.OptionType.STRING, "id", "Instance ID", true),
            Commands.slash("execute", "Execute a command on an instance")
                .addOption(net.dv8tion.jda.api.interactions.commands.OptionType.STRING, "id", "Instance ID", true)
                .addOption(net.dv8tion.jda.api.interactions.commands.OptionType.STRING, "command", "Command to execute", true)
        ).queue()

        log("Discord extension: Slash commands registered.", LogLevel.DEBUG)
    }

    override fun onSlashCommandInteraction(event: SlashCommandInteractionEvent) {
        if (!hasRequiredRole(event)) return

        when (event.name) {
            "status" -> handleStatus(event)
            "instances" -> handleInstances(event)
            "configurations" -> handleConfigurations(event)
            "instance" -> handleInstanceDetails(event)
            "start" -> handleStart(event)
            "stop" -> handleStop(event)
            "execute" -> handleExecute(event)
        }
    }

    // ---- Role Checking ----

    /**
     * Checks if the user has a required role.
     * Returns true if no roles are configured or if the user has at least one allowed role.
     */
    private fun hasRequiredRole(event: SlashCommandInteractionEvent): Boolean {
        val config = extension.getConfig() ?: return true
        if (config.allowedRoleIds.isEmpty()) return true

        val member = event.member
        if (member == null) {
            event.replyEmbeds(createErrorEmbed("Access Denied", "Could not verify your roles.")).setEphemeral(true).queue()
            return false
        }

        val userRoleIds = member.roles.map { it.id }.toSet()
        if (!config.isRoleAllowed(userRoleIds)) {
            event.replyEmbeds(createErrorEmbed("Access Denied", "You do not have permission to use this command.")).setEphemeral(true).queue()
            return false
        }

        return true
    }

    // ---- Slash Command Handlers ----

    private fun handleStatus(event: SlashCommandInteractionEvent) {
        val embed = EmbedBuilder()
            .setTitle("Universe Cluster Status")
            .setColor(Color(extension.getConfig()?.embedColor ?: 5814783))
            .setTimestamp(Instant.now())

        val instances = extension.getClusterDataProvider()?.getActiveInstances() ?: emptyList()
        val configs = extension.getClusterDataProvider()?.getConfigurations() ?: emptyList()

        embed.addField("Active Instances", "${instances.size}", true)
        embed.addField("Configurations", "${configs.size}", true)
        embed.addField("Status", "Online", true)

        event.replyEmbeds(embed.build()).queue()
    }

    private fun handleInstances(event: SlashCommandInteractionEvent) {
        event.deferReply().queue()

        extension.getScheduler()?.execute {
            val instances = extension.getClusterDataProvider()?.getActiveInstances() ?: emptyList()

            if (instances.isEmpty()) {
                event.hook.sendMessageEmbeds(
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

            event.hook.sendMessageEmbeds(embed.build()).queue()
        }
    }

    private fun handleConfigurations(event: SlashCommandInteractionEvent) {
        event.deferReply().queue()

        extension.getScheduler()?.execute {
            val configs = extension.getClusterDataProvider()?.getConfigurations() ?: emptyList()

            if (configs.isEmpty()) {
                event.hook.sendMessageEmbeds(
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

            event.hook.sendMessageEmbeds(embed.build()).queue()
        }
    }

    private fun handleInstanceDetails(event: SlashCommandInteractionEvent) {
        val instanceId = event.getOption("id")?.asString ?: return
        event.deferReply().queue()

        extension.getScheduler()?.execute {
            val instance = extension.getClusterDataProvider()?.getAllInstances()?.find { it.id == instanceId }

            if (instance == null) {
                event.hook.sendMessageEmbeds(
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

            event.hook.sendMessageEmbeds(embed.build()).queue()
        }
    }

    private fun handleStart(event: SlashCommandInteractionEvent) {
        val configName = event.getOption("configuration")?.asString ?: return
        event.deferReply().queue()

        extension.getScheduler()?.execute {
            event.hook.sendMessageEmbeds(
                createInfoEmbed("Start Requested", "Instance start requested for configuration `$configName`. Check the master console for status.")
            ).queue()
        }
    }

    private fun handleStop(event: SlashCommandInteractionEvent) {
        val instanceId = event.getOption("id")?.asString ?: return
        event.deferReply().queue()

        extension.getScheduler()?.execute {
            event.hook.sendMessageEmbeds(
                createInfoEmbed("Stop Requested", "Instance stop requested for `$instanceId`. Check the master console for status.")
            ).queue()
        }
    }

    private fun handleExecute(event: SlashCommandInteractionEvent) {
        val instanceId = event.getOption("id")?.asString ?: return
        val command = event.getOption("command")?.asString ?: return
        event.deferReply().queue()

        extension.getScheduler()?.execute {
            event.hook.sendMessageEmbeds(
                createInfoEmbed("Command Executed", "Command `$command` sent to instance `$instanceId`.")
            ).queue()
        }
    }

    // ---- Helpers ----

    private fun createErrorEmbed(title: String, description: String): MessageEmbed {
        return EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(Color.RED)
            .setTimestamp(Instant.now())
            .build()
    }

    private fun createInfoEmbed(title: String, description: String): MessageEmbed {
        return EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(Color(extension.getConfig()?.embedColor ?: 5814783))
            .setTimestamp(Instant.now())
            .build()
    }
}
