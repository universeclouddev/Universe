package gg.scala.universe.extension

interface Extension {
    fun id(): String
    fun version(): String

    fun onLoad()
    fun onUnload()
    fun onReload()
}