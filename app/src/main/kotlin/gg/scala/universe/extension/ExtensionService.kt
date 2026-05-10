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

    fun getLoadedExtensions(): Map<String, Extension> = loadedExtensions.toMap()
    fun getInstalledExtensions(): Map<String, Extension> = extensions.toMap()

}

object ExtensionClassUtils {

    /**
     * Known third-party dependency packages that should not be scanned for extensions.
     * Prevents noisy static-init logs (e.g. Netty capability checks) and improves startup time.
     */
    private val EXCLUDED_PREFIXES = listOf(
        "io.netty.", "io.ktor.", "io.github.", "io.micrometer.",
        "kotlin.", "kotlinx.",
        "java.", "javax.", "sun.", "com.sun.", "jdk.",
        "com.google.", "com.hazelcast.", "com.fasterxml.",
        "org.jetbrains.", "org.intellij.", "org.apache.", "org.slf4j.", "org.json.",
        "okio.", "dev.vankka.", "cz.lukynka."
    )

    fun extensions(): List<Extension> {
        val classPath = ClassPath.from(DependencyLoader.classLoader())

        return classPath.allClasses.asSequence()
            .map { it.name }
            .filter { name ->
                !name.startsWith("META-INF") && EXCLUDED_PREFIXES.none { name.startsWith(it) }
            }
            .mapNotNull { try {
                // initialize = false prevents triggering static initializers of third-party classes
                // (e.g. Netty capability checks) during the scan phase.
                Class.forName(it, false, DependencyLoader.classLoader())
            } catch (_: ClassNotFoundException) {
                null
            } catch (_: NoClassDefFoundError) {
                null
            } catch (_: ExceptionInInitializerError) {
                null
            } catch (_: LinkageError) {
                null
            } }
            .mapNotNull { clazz -> if (Extension::class.java.isAssignableFrom(clazz)) try {
                clazz.getConstructor().newInstance() as Extension } catch (_: Exception) {
                null
            } else null }
            .toMutableList()
    }
}