import dev.vankka.dependencydownload.DependencyManager
import dev.vankka.dependencydownload.path.DirectoryDependencyPathProvider
import dev.vankka.dependencydownload.repository.MavenRepository
import dev.vankka.dependencydownload.resource.DependencyDownloadResource
import java.net.URL
import java.net.URLClassLoader
import java.nio.file.Paths
import java.util.concurrent.Executors

object DependencyLoader {
    private val EXECUTOR = Executors.newCachedThreadPool()
    private val REPOSITORIES = mutableListOf(
        "https://maven-central-eu.storage-download.googleapis.com/maven2/",
        "https://maven-central.storage-download.googleapis.com/maven2/",
        "https://repo.mincats.eu/public",
        "https://repo.mincats.eu/mirrors",
        "https://jitpack.io",
    )

    private var MAIN_THREAD = Thread.currentThread()
    private val APPENDER = Appender(MAIN_THREAD, Any())

    fun addRepository(repo: String) {
        REPOSITORIES.add(repo)
    }

    fun fromRawContent(content: String) {
        val resource = DependencyDownloadResource.parse(content)
        processDependencies(resource)
    }

    fun fromResource(url: URL) {
        val resource = DependencyDownloadResource.parse(url)
        processDependencies(resource)
    }

    private fun manager() = DependencyManager(
        DirectoryDependencyPathProvider(Paths.get("./libraries"))
    )

    fun classLoader(): URLClassLoader {
        if (this.MAIN_THREAD.contextClassLoader is URLClassLoader) {
            return this.MAIN_THREAD.contextClassLoader as URLClassLoader
        }

        val newLoader = URLClassLoader(arrayOf(), MAIN_THREAD.contextClassLoader)
        MAIN_THREAD.contextClassLoader = newLoader
        return newLoader
    }

    private fun processDependencies(resource: DependencyDownloadResource) {
        val manager = manager()
        manager.loadResource(resource)
        val repos = REPOSITORIES.map { MavenRepository(it) }

        manager.downloadAll(EXECUTOR, repos).join()
//        manager.relocateAll(EXECUTOR).join()
        manager.loadAll(EXECUTOR, APPENDER).join()
    }
}