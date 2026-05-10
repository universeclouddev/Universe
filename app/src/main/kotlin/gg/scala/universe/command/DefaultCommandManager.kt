/*
 * Copyright 2019-present CloudNetService team & contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package gg.scala.universe.command

import com.google.inject.Inject
import com.google.inject.Singleton
import org.incendo.cloud.CloudCapability
import org.incendo.cloud.Command
import org.incendo.cloud.CommandManager
import org.incendo.cloud.component.CommandComponent
import org.incendo.cloud.execution.ExecutionCoordinator
import org.incendo.cloud.internal.CommandRegistrationHandler
import org.incendo.cloud.meta.CommandMeta
import org.incendo.cloud.meta.SimpleCommandMeta
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService

/**
 * In-memory command registration handler that stores commands for local execution.
 */
class UniverseCommandRegistrationHandler : CommandRegistrationHandler<CommandSource> {
    private val commands = ConcurrentHashMap.newKeySet<Command<CommandSource>>()

    override fun registerCommand(command: Command<CommandSource>): Boolean {
        return commands.add(command)
    }

    override fun unregisterRootCommand(rootCommand: CommandComponent<CommandSource>) {
        commands.removeIf { cmd ->
            cmd.components().firstOrNull()?.name() == rootCommand.name()
        }
    }

    fun getCommands(): Collection<Command<CommandSource>> = commands.toList()
}

/**
 * Constructs the default implementation of the [CommandManager]. Applying asynchronous command executing using
 * a thread pool with 4 threads.
 */
@Singleton
internal class DefaultCommandManager @Inject constructor(executor: ExecutorService)
    : CommandManager<CommandSource>(
        ExecutionCoordinator.builder<CommandSource>()
            .parsingExecutor(executor)
            .executionSchedulingExecutor(executor)
            .build(),
        UniverseCommandRegistrationHandler()
    ) {

    init {
        this.registerCapability(CloudCapability.StandardCapabilities.ROOT_COMMAND_DELETION)
    }

    override fun hasPermission(sender: CommandSource, permission: String): Boolean {
        return sender.checkPermission(permission)
    }

    override fun createDefaultCommandMeta(): CommandMeta {
        return SimpleCommandMeta.empty()
    }
}
