import dev.vankka.dependencydownload.DependencyManager
import dev.vankka.dependencydownload.path.DirectoryDependencyPathProvider
import dev.vankka.dependencydownload.repository.MavenRepository
import dev.vankka.dependencydownload.resource.DependencyDownloadResource
import java.net.URL
import java.nio.file.Paths
import java.util.concurrent.Executors

object DependencyLoader {
    private val EXECUTOR = Executors.newCachedThreadPool()
    private val MANAGER = DependencyManager(
        DirectoryDependencyPathProvider(Paths.get("./librairies"))
    )
    private val REPOSITORIES = mutableListOf(
        "https://maven-central-eu.storage-download.googleapis.com/maven2/",
        "https://maven-central.storage-download.googleapis.com/maven2/",
        "https://repo.mincats.eu/public",
        "https://repo.mincats.eu/mirrors",
        "https://jitpack.io",
    )
    private val APPENDER = Appender(Thread.currentThread(), Any())

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

    private fun processDependencies(resource: DependencyDownloadResource) {
        MANAGER.loadResource(resource)
        val repos = REPOSITORIES.map { MavenRepository(it) }

        MANAGER.downloadAll(EXECUTOR, repos).join()
        MANAGER.relocateAll(EXECUTOR).join()
        MANAGER.loadAll(EXECUTOR, APPENDER).join()
    }
}