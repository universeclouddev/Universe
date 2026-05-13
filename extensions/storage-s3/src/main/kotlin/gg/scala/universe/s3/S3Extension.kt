package gg.scala.universe.s3

import com.google.inject.Inject
import gg.scala.universe.console.LogLevel
import gg.scala.universe.console.log
import gg.scala.universe.extension.Extension
import gg.scala.universe.template.TemplateStorageRegistry

/**
 * Extension bootstrap for the S3 template storage backend.
 *
 * Registers [S3TemplateStorage] with the [TemplateStorageRegistry]
 * on load and unregisters it on unload.
 */
class S3Extension : Extension {

    override fun id(): String = "storage-s3"
    override fun version(): String = "1.0.0"

    @Inject
    private lateinit var templateStorageRegistry: TemplateStorageRegistry

    @Inject
    private lateinit var s3TemplateStorage: S3TemplateStorage

    override fun onLoad() {
        templateStorageRegistry.register(s3TemplateStorage)
        log("S3 template storage extension loaded (bucket=${s3TemplateStorage.bucket})", LogLevel.SUCCESS)
    }

    override fun onUnload() {
        templateStorageRegistry.unregister(s3TemplateStorage.storageKey)
        s3TemplateStorage.close()
        log("S3 template storage extension unloaded")
    }

    override fun onReload() {
        onUnload()
        onLoad()
        log("S3 template storage extension reloaded")
    }
}
