import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.URL
import java.net.URLClassLoader
import java.nio.file.Files
import java.nio.file.Path
import java.util.jar.JarFile
import java.util.stream.Collectors
import kotlin.io.path.extension
import kotlin.io.path.isDirectory
import kotlin.io.path.isRegularFile

object LoaderUtils {

    /**
     * Reads the text content of a file located INSIDE the jarinjar.
     */
    fun readInternalText(jarPath: Path, resourcePath: String): String? {
        return try {
            JarFile(jarPath.toFile()).use { jar ->
                val entry = jar.getJarEntry(resourcePath) ?: return null
                jar.getInputStream(entry).use { stream ->
                    BufferedReader(InputStreamReader(stream))
                        .lines()
                        .collect(Collectors.joining("\n"))
                }
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Finds and appends all files in a filesystem directory to the classpath.
     * @param directory The path to the folder
     * @param extension Optional filter (e.g., "jar")
     */
    fun loadDirectory(loader: ClassLoader, directory: Path, extension: String? = null) {
        if (!Files.exists(directory) || !directory.isDirectory()) return

        Files.list(directory).use { stream ->
            stream.filter { file ->
                extension == null || file.extension.equals(extension, ignoreCase = true)
            }.forEach { file ->
                loadFile(loader, file)
            }
        }
    }

    /**
     * Appends a specific filesystem file to the classpath and returns its URL.
     */
    fun loadFile(loader: ClassLoader, filePath: Path): URL? {
        if (!Files.exists(filePath) || !filePath.isRegularFile()) return null

        val url = filePath.toUri().toURL()

        readInternalText(filePath, "dependencies.txt")?.let {
            DependencyLoader.fromRawContent(it)
        }
        appendToClassloader(loader, url)
        return url
    }

    /**
     * Logic for injecting the URL into the ClassLoader.
     */
    fun appendToClassloader(loader: ClassLoader, url: URL) {
        try {
            val method = URLClassLoader::class.java.getDeclaredMethod("addURL", URL::class.java)
            method.isAccessible = true
            method.invoke(loader, url)
            // println("Successfully loaded: $url")
        } catch (e: Exception) {
            println("Failed to append $url to classpath: ${e.message}")
        }
    }
}