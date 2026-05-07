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
package gg.scala.universe.command.exception

/**
 * This exception is used when argument parsers need to hard fail the argument parsing because there is a syntax error.
 * The message of the exception is sent to the user therefore it should be translated and formatted correctly.
 * 
 * 
 * Note: The [ArgumentNotAvailableException.fillInStackTrace] method is empty, therefore the creation of this
 * exception is not heavy, and it can be used frequently.
 * 
 * @since 4.0
 */
class ArgumentNotAvailableException(message: String) : RuntimeException(message) {
    /**
     * Returns the own instance of this exception without filling the stacktrace, as the stacktrace is not needed for this
     * exception.
     *
     * @return this instance for chaining.
     */
    override fun fillInStackTrace(): Throwable {
        return this
    }
}
