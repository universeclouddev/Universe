package gg.scala.universe.api

import com.google.inject.AbstractModule
import gg.scala.universe.command.CommandSource
import gg.scala.universe.command.ConsoleCommandSource

class ApiGuiceModule : AbstractModule() {
    override fun configure() {
        bind(CommandSource::class.java).to(ConsoleCommandSource::class.java).asEagerSingleton()
    }
}
