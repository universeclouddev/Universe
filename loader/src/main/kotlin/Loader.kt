import dev.vankka.dependencydownload.classpath.ClasspathAppender
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.URL
import java.net.URLClassLoader
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.util.jar.JarFile
import java.util.stream.Collectors

fun main() {
    // Disable Netty native OpenSSL to avoid PrettyLog null-throwable incompatibility
    // in OpenSslX509TrustManagerWrapper logger.debug(msg, null) calls on Java 25.
    System.setProperty("io.netty.handler.ssl.noOpenSsl", "true")

    val resourceUrl = Loader::class.java.getResource("dependencies.txt")
        ?: error("Could not find dependencies.txt on the classpath! Check resource packaging.")

    DependencyLoader.fromResource(resourceUrl)
    Loader()
}

internal class Appender(val mainThread: Thread, val lock: Any) : ClasspathAppender {
    override fun appendFileToClasspath(path: Path) {
        synchronized(lock) {
            val classLoader = DependencyLoader.classLoader()

            try {
                val method = URLClassLoader::class.java.getDeclaredMethod("addURL", URL::class.java)
                method.isAccessible = true
                method.invoke(classLoader, path.toUri().toURL())
//                println(" - $path")
            } catch (e: Exception) {
                println("Failed to append file to classpath: $path, ${e.message}")
            }
        }
    }
}

private class Loader {
    init {
        val loader = DependencyLoader.classLoader()

        try {
            // 1. Extract and process the jarinjar
            val (jarPath, jarUrl) = extractJar(loader, "app.jarinjar")

            // Read dependencies.txt from INSIDE the extracted JAR
            val depContent = LoaderUtils.readInternalText(jarPath, "dependencies.txt")
            if (depContent != null) {
                DependencyLoader.fromRawContent(depContent)
            }

//            // 2. Load all jars from a local "modules" folder on the disk
//            val modulesDir = Path.of("./modules")
//            LoaderUtils.loadDirectory(loader, modulesDir, "jar")
//
//            // 3. Load a specific config or external library file
//            val externalLib = Path.of("./libs/extra-api.jar")
//            LoaderUtils.loadFile(loader, externalLib)

            // 4. Finally, append the main app JAR and run
            LoaderUtils.appendToClassloader(loader, jarUrl)

            loader.loadClass("gg.scala.universe.app.AppKt")
                .getDeclaredMethod("run")
                .invoke(null)

        } catch (e: Exception) {
            throw UnsupportedOperationException("Failed to initialize loader", e)
        }
    }

    private fun readAndLoadInternalDependencies(jarPath: Path) {
        JarFile(jarPath.toFile()).use { jar ->
            val entry = jar.getJarEntry("dependencies.txt")
            if (entry != null) {
                jar.getInputStream(entry).use { stream ->
                    val content = BufferedReader(InputStreamReader(stream))
                        .lines()
                        .collect(Collectors.joining("\n"))

                    DependencyLoader.fromRawContent(content)
                }
            }
        }
    }

    //Courtesy of Luckperms
    private fun extractJar(loader: ClassLoader, jarResourcePath: String): Pair<Path, URL> {
        val jarInJar = loader.getResource(jarResourcePath)
            ?: throw IllegalStateException("Could not locate jar-in-jar: $jarResourcePath")

        val path = Files.createTempFile("app-jarinjar", ".jar.tmp")
        path.toFile().deleteOnExit()

        jarInJar.openStream().use { input ->
            Files.copy(input, path, StandardCopyOption.REPLACE_EXISTING)
        }

        return Pair(path, path.toUri().toURL())
    }
}