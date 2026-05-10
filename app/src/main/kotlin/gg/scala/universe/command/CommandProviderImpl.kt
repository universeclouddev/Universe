package gg.scala.universe.command

import com.google.inject.Inject
import com.google.inject.Singleton
import gg.scala.universe.app.UniverseApplication
import org.incendo.cloud.CommandManager
import org.incendo.cloud.annotations.AnnotationParser
import org.incendo.cloud.kotlin.coroutines.annotations.installCoroutineSupport
import org.incendo.cloud.meta.CommandMeta
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap

/**
 * Default implementation of [CommandProvider] that wraps a Cloud [CommandManager]
 * to handle command parsing, execution, and registration.
 */
@Singleton
class CommandProviderImpl @Inject constructor(
    private val commandManager: CommandManager<CommandSource>
) : CommandProvider {

    private val annotationParser = AnnotationParser(
        commandManager,
        CommandSource::class.java
    ) { CommandMeta.empty() }

    init {
        annotationParser.installCoroutineSupport()
    }

    private val registeredCommands = ConcurrentHashMap.newKeySet<CommandInfo>()

    override fun suggest(source: CommandSource, input: String): MutableList<String> {
        return commandManager.suggestionFactory()
            .suggest(source, input)
            .thenApply { suggestions ->
                suggestions.list().map { it.suggestion() }.toMutableList()
            }
            .join()
    }

    override fun execute(source: CommandSource, input: String): CompletableFuture<*> {
        return commandManager.commandExecutor().executeCommand(source, input)
    }

    override fun register(commandClass: Class<*>) {
        val instance = UniverseApplication.instance.injector.getInstance(commandClass)
        register(instance)
    }

    override fun register(command: Any) {
        val parsedCommands = annotationParser.parse(command)
        if (parsedCommands.isEmpty()) {
            return
        }

        val cloudCommand = parsedCommands.first()
        val components = cloudCommand.components()
        if (components.isEmpty()) {
            return
        }

        val name = components.first().name().lowercase()
        val permission = cloudCommand.commandPermission().permissionString()

        val info = CommandInfo(
            name = name,
            aliases = mutableSetOf(),
            permission = permission,
            description = "",
            docsUrl = null,
            usage = mutableListOf()
        )

        registeredCommands.add(info)
    }

    override fun unregister(name: String) {
        val lowerName = name.lowercase()
        val iterator = registeredCommands.iterator()
        while (iterator.hasNext()) {
            val info = iterator.next()
            if (info.name.lowercase() == lowerName || info.aliases.any { it.lowercase() == lowerName }) {
                commandManager.deleteRootCommand(info.name)
                iterator.remove()
                break
            }
        }
    }

    override fun unregister(classLoader: ClassLoader) {
        // Minimal implementation; classloader tracking can be added later
    }

    override fun command(name: String): CommandInfo {
        val lowerName = name.lowercase()
        return registeredCommands.find {
            it.name.lowercase() == lowerName || it.aliases.any { a -> a.lowercase() == lowerName }
        } ?: throw NullPointerException("No command found with name: $name")
    }

    override fun commands(): Collection<CommandInfo> {
        return registeredCommands.toList()
    }
}
