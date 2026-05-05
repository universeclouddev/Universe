plugins {
    // Apply the shared build logic from a convention plugin.
    // The shared code is located in `buildSrc/src/main/kotlin/kotlin-jvm.gradle.kts`.
    id("buildsrc.convention.kotlin-jvm")

    // Apply the Application plugin to add support for building an executable JVM application.
    application
    alias(libs.plugins.jib)
}

val git = project.extra["git"] as Map<*, *>
val commitId = git["git.commit.id.abbrev"].toString()
val commitIdFull = git["git.commit.id"].toString()
val branchName = git["git.branch"].toString()

dependencies {

}

application {
    mainClass = "gg.scala.universe.app.AppKt"
}

jib {


    to {
        image = "git.lunarlabs.dev/Scala/universe"
        credHelper.helper = "wincred"
        tags = setOf("dev", commitId, commitIdFull, branchName)
    }
    container {
        creationTime = provider {
            // Retrieve the 'git' extra property and cast it to a Map
            val git = project.extra["git"] as Map<*, *>
            git["git.commit.time"].toString()
        }
    }
}