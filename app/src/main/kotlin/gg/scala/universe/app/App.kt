package gg.scala.universe.app

import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log

fun run() {
    log("Starting Universe", LogType.INFORMATION)
    UniverseApplication()
}

class UniverseApplication {
    init {
        instance = this


    }

    companion object {
        lateinit var instance: UniverseApplication
    }
}