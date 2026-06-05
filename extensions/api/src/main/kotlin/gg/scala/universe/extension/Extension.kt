package gg.scala.universe.extension

interface Extension {
    fun id(): String
    fun version(): String

    /**
     * When true, this extension will only be loaded on master nodes.
     * On wrapper (non-master) nodes it is silently skipped during [ExtensionService.loadExtensions].
     */
    fun masterOnly(): Boolean = false

    /**
     * When false, this extension refuses to be reloaded at runtime.
     * [ExtensionService.reloadExtensions] will skip it and log a warning.
     */
    fun reloadable(): Boolean = true

    fun onLoad()
    fun onUnload()
    fun onReload()
}