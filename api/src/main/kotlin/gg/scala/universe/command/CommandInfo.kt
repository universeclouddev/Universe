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

import java.util.*
import kotlin.Any
import kotlin.Boolean
import kotlin.Int
import kotlin.NullPointerException


/**
 * Represents a command information object which holds all information for a single command that is registered on a
 * node.
 * 
 * 
 * The command info has one main identification point. It's identified by the name of the command. The command
 * represented by the command info is always the root of the command. Subcommands don't have an own command info, every
 * needed information is stored in the root command info. The usage contains the syntax for every possible command, here
 * are subcommands included too.
 * 
 * @param name        the root name of the command.
 * @param aliases     all aliases of the root command.
 * @param permission  the permission that is needed to execute the command.
 * @param description the description of the command which is used for the help command.
 * @param docsUrl     the url to the documentation of the command.
 * @param usage       the correct syntax usages for each sub command.
 * @since 4.0
 */
@JvmRecord
data class CommandInfo(
    val name: String,
    val aliases: MutableSet<String>,
    val permission: String,
    val description: String,
    val docsUrl: String?,
    val usage: MutableList<String>
) {
    /**
    * Joins the name of the registered command and the specified aliases into one String seperated by the separator.
    *
    * @param separator the separator to join with.
    * @return the joined String with the name and all aliases.
    * @throws NullPointerException if separator is null.
    */
    fun joinNameToAliases(separator: String): String {
        var result = this.name
        if (!this.aliases.isEmpty()) {
            result += separator + this.aliases.joinToString(separator)
        }

        return result
    }
}
