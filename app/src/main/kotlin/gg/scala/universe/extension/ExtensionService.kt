package gg.scala.universe.extension

import com.google.common.reflect.ClassPath
import com.google.inject.Inject
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import gg.scala.universe.app.UniverseApplication
import okio.Path.Companion.toPath

class ExtensionService {

    @Inject private lateinit var app: UniverseApplication

    private val extensionPath = "./extensions".toPath().toNioPath()

    private val extensions = mutableMapOf<String, Extension>()
    private val loadedExtensions = mutableMapOf<String, Extension>()

    fun installExtensions() {
        log("Installing extensions...", LogType.INFORMATION)
        extensionPath.toFile().mkdirs()

        LoaderUtils.loadDirectory(DependencyLoader.classLoader(), extensionPath, "jar")
        ExtensionClassUtils.extensions().forEach { extension ->
            this.extensions[extension.id()] = extension
            app.injector.injectMembers(extension)

            log("Found extension: ${extension.id()} v${extension.version()}", LogType.INFORMATION)
        }
    }

    fun loadExtensions() {
        this.extensions.forEach { try {
            it.value.onLoad()
            this.loadedExtensions[it.key] = it.value
        } catch (ex: Exception) {
            log("Failed to load extension ${it.key}: ${ex.message}", LogType.ERROR)
            log(ex)
        } }
    }

    fun reloadExtensions() {
        this.loadedExtensions.forEach { try {
            it.value.onReload()
        } catch (ex: Exception) {
            log("Failed to reload extension ${it.key}: ${ex.message}", LogType.ERROR)
            log(ex)
        } }
    }

    fun unloadExtensions() {
        this.loadedExtensions.forEach { try {
            it.value.onUnload()
        } catch (ex: Exception) {
            log("Failed to unload extension ${it.key}: ${ex.message}", LogType.ERROR)
            log(ex)
        } }
    }

}

object ExtensionClassUtils {
    fun extensions(): List<Extension> {
        val classPath = ClassPath.from(DependencyLoader.classLoader())

        return classPath.allClasses.asSequence()
            .map { it.name }
            .mapNotNull { if (it.startsWith("META-INF")) null else try {
                Class.forName(it)
            } catch (_: ClassNotFoundException) {
                null
            } catch (_: NoClassDefFoundError) {
                null
            } }
            .mapNotNull { clazz -> if (Extension::class.java.isAssignableFrom(clazz)) try {
                clazz.getConstructor().newInstance() as Extension } catch (_: Exception) {
                null
            } else null }
            .toMutableList()
    }
}