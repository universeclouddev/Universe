package gg.scala.universe.example

import gg.scala.universe.console.LogLevel
import gg.scala.universe.extension.Extension
import gg.scala.universe.console.log

class ExampleExtension : Extension {
    override fun id(): String = "example-extension"
    override fun version(): String = "0.0.1"

    override fun onLoad() {
        log("ExampleExtension loaded!", LogLevel.SUCCESS)
    }

    override fun onUnload() {
        log("ExampleExtension unloaded!", LogLevel.SUCCESS)
    }

    override fun onReload() {
        log("ExampleExtension reloaded!", LogLevel.SUCCESS)
    }
}