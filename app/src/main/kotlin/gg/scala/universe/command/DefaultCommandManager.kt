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

import org.incendo.cloud.CloudCapability
import org.incendo.cloud.CommandManager
import org.incendo.cloud.execution.ExecutionCoordinator
import org.incendo.cloud.internal.CommandRegistrationHandler
import org.incendo.cloud.meta.CommandMeta
import org.incendo.cloud.meta.SimpleCommandMeta
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Constructs the default implementation of the [CommandManager]. Applying asynchronous command executing using
 * a thread pool with 4 threads.
 */
//@Singleton
internal class DefaultCommandManager(executor: ExecutorService = Executors.newFixedThreadPool(4))
    : CommandManager<CommandSource>(
        ExecutionCoordinator.builder<CommandSource>()
            .parsingExecutor(executor)
            .executionSchedulingExecutor(executor)
            .build(),
        CommandRegistrationHandler.nullCommandRegistrationHandler()
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
