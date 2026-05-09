package gg.scala.universe.example

import cz.lukynka.prettylog.LogType
import gg.scala.universe.extension.Extension
import cz.lukynka.prettylog.log

class ExampleExtension : Extension {
    override fun id(): String = "example-extension"
    override fun version(): String = "0.0.1"

    override fun onLoad() {
        log("ExampleExtension loaded!", LogType.SUCCESS)
    }

    override fun onUnload() {
        log("ExampleExtension unloaded!", LogType.SUCCESS)
    }

    override fun onReload() {
        log("ExampleExtension reloaded!", LogType.SUCCESS)
    }
}