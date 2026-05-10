package gg.scala.universe.s3

import com.google.inject.Inject
import com.google.inject.Singleton
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import gg.scala.universe.template.TemplateStorageProvider
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.GetObjectRequest
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request
import software.amazon.awssdk.services.s3.model.PutObjectRequest
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.net.URI
import java.nio.file.Files
import java.nio.file.Path
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream
import kotlin.io.path.exists
import kotlin.io.path.isDirectory

/**
 * S3-backed implementation of [TemplateStorageProvider].
 *
 * Downloads and uploads template zip archives to an S3-compatible bucket.
 * Config is loaded from [S3ConfigLoader] at construction time.
 */
@Singleton
class S3TemplateStorage @Inject constructor() : TemplateStorageProvider {

    private val config: S3Config = S3ConfigLoader.load()
    private val client: S3Client = buildClient(config)
    private val templatesDir = Path.of("./templates")

    override val storageKey: String = "s3"

    /** Exposed for extension logging. */
    val bucket: String = config.bucket

    /**
     * Downloads `templates/<group>/<name>.zip` from the configured S3 bucket
     * and extracts it to `./templates/<group>/<name>/`.
     *
     * @return `true` if the download and extraction succeeded.
     */
    override fun downloadTemplate(group: String, name: String): Boolean {
        val key = "${config.prefix}${group}/${name}.zip"
        val targetDir = templatesDir.resolve(group).resolve(name)

        return try {
            log("Downloading template $group/$name from S3 (key=$key)", LogType.INFORMATION)

            val responseBytes = client.getObjectAsBytes(
                GetObjectRequest.builder()
                    .bucket(config.bucket)
                    .key(key)
                    .build()
            )

            unzipDirectory(responseBytes.asByteArray(), targetDir)

            log("Downloaded and extracted template $group/$name from S3", LogType.SUCCESS)
            true
        } catch (e: Exception) {
            log("Failed to download template $group/$name from S3: ${e.message}", LogType.ERROR)
            false
        }
    }

    /**
     * Zips `./templates/<group>/<name>/` and uploads it to the configured S3 bucket
     * as `templates/<group>/<name>.zip`.
     *
     * @return `true` if the zip and upload succeeded.
     */
    override fun uploadTemplate(group: String, name: String): Boolean {
        val sourceDir = templatesDir.resolve(group).resolve(name)
        if (!sourceDir.exists() || !sourceDir.isDirectory()) {
            log("Template directory not found: $sourceDir", LogType.WARNING)
            return false
        }

        val key = "${config.prefix}${group}/${name}.zip"

        return try {
            log("Uploading template $group/$name to S3 (key=$key)", LogType.INFORMATION)

            val zipBytes = zipDirectory(sourceDir)

            client.putObject(
                PutObjectRequest.builder()
                    .bucket(config.bucket)
                    .key(key)
                    .contentType("application/zip")
                    .build(),
                RequestBody.fromBytes(zipBytes)
            )

            log("Uploaded template $group/$name to S3", LogType.SUCCESS)
            true
        } catch (e: Exception) {
            log("Failed to upload template $group/$name to S3: ${e.message}", LogType.ERROR)
            false
        }
    }

    /**
     * Lists templates in the given group by scanning the S3 prefix.
     *
     * @param group The template group name.
     * @return List of template names in the group.
     */
    override fun listTemplates(group: String): List<String> {
        val prefix = "${config.prefix}${group}/"
        val templates = mutableListOf<String>()

        try {
            val response = client.listObjectsV2(
                ListObjectsV2Request.builder()
                    .bucket(config.bucket)
                    .prefix(prefix)
                    .build()
            )

            response.contents().forEach { obj ->
                val key = obj.key()
                if (key.endsWith(".zip")) {
                    val relative = key.removePrefix(prefix)
                    val name = relative.substringBefore("/").substringBefore(".")
                    if (name.isNotBlank() && !templates.contains(name)) {
                        templates.add(name)
                    }
                }
            }
        } catch (e: Exception) {
            log("Failed to list templates in group $group from S3: ${e.message}", LogType.ERROR)
        }

        return templates
    }

    /**
     * Closes the underlying S3 client. Should be called when the extension is unloaded.
     */
    fun close() {
        try {
            client.close()
        } catch (e: Exception) {
            log("Failed to close S3 client: ${e.message}", LogType.ERROR)
        }
    }

    private fun buildClient(config: S3Config): S3Client {
        val builder = S3Client.builder()
            .region(Region.of(config.region))

        if (config.endpoint != null) {
            builder.endpointOverride(URI.create(config.endpoint))
        }

        if (config.accessKey != null && config.secretKey != null) {
            val credentials = AwsBasicCredentials.create(config.accessKey, config.secretKey)
            builder.credentialsProvider(StaticCredentialsProvider.create(credentials))
        }

        return builder.build()
    }

    /**
     * Recursively zips the contents of [source] into a [ByteArray].
     */
    private fun zipDirectory(source: Path): ByteArray {
        val output = ByteArrayOutputStream()
        ZipOutputStream(output).use { zos ->
            Files.walk(source).use { stream ->
                stream.forEach { path ->
                    if (path.isDirectory()) {
                        return@forEach
                    }

                    val relative = source.relativize(path).toString().replace("\\", "/")
                    zos.putNextEntry(ZipEntry(relative))
                    Files.copy(path, zos)
                    zos.closeEntry()
                }
            }
        }
        return output.toByteArray()
    }

    /**
     * Extracts [zipBytes] into [target], creating directories as needed.
     * Guards against zip-slip path traversal attacks.
     */
    private fun unzipDirectory(zipBytes: ByteArray, target: Path) {
        ByteArrayInputStream(zipBytes).use { bais ->
            ZipInputStream(bais).use { zis ->
                var entry = zis.nextEntry
                while (entry != null) {
                    val entryPath = target.resolve(entry.name).normalize()
                    if (!entryPath.startsWith(target)) {
                        log("Skipping zip entry with path traversal: ${entry.name}", LogType.WARNING)
                        entry = zis.nextEntry
                        continue
                    }

                    if (entry.isDirectory) {
                        Files.createDirectories(entryPath)
                    } else {
                        Files.createDirectories(entryPath.parent)
                        Files.copy(zis, entryPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING)
                    }
                    zis.closeEntry()
                    entry = zis.nextEntry
                }
            }
        }
    }
}
