package gg.scala.universe.app

import com.google.inject.AbstractModule
import com.google.inject.Provides
import com.google.inject.TypeLiteral
import gg.scala.universe.command.CommandProvider
import gg.scala.universe.command.CommandProviderImpl
import gg.scala.universe.command.CommandSource
import gg.scala.universe.command.DefaultCommandManager
import gg.scala.universe.config.UniverseMainConfiguration
import gg.scala.universe.extension.ExtensionService
import gg.scala.universe.runtime.RuntimeRegistry
import gg.scala.universe.runtime.RuntimeRegistryImpl
import gg.scala.universe.template.TemplateStorageRegistry
import gg.scala.universe.template.TemplateStorageRegistryImpl
import gg.scala.universe.template.TemplateVariableRegistry
import gg.scala.universe.template.TemplateVariableRegistryImpl
import org.incendo.cloud.CommandManager
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class MainGuiceModule : AbstractModule() {
    override fun configure() {
        bind(RuntimeRegistry::class.java).to(RuntimeRegistryImpl::class.java).asEagerSingleton()
        bind(CommandProvider::class.java).to(CommandProviderImpl::class.java).asEagerSingleton()
        bind(object : TypeLiteral<CommandManager<CommandSource>>() {}).to(DefaultCommandManager::class.java).asEagerSingleton()
        bind(TemplateStorageRegistry::class.java).to(TemplateStorageRegistryImpl::class.java).asEagerSingleton()
        bind(TemplateVariableRegistry::class.java).to(TemplateVariableRegistryImpl::class.java).asEagerSingleton()
        bind(ExecutorService::class.java).toInstance(Executors.newFixedThreadPool(4))
    }

    @Provides
    fun application(): UniverseApplication {
        return UniverseApplication.instance
    }

    @Provides
    fun mainConfigurationProvider(): UniverseMainConfiguration {
        return UniverseApplication.instance.mainConfiguration
    }

    @Provides
    fun extensionService(): ExtensionService {
        return UniverseApplication.instance.extensionService
    }

}