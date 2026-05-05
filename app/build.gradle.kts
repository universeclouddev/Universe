plugins {
    // Apply the shared build logic from a convention plugin.
    // The shared code is located in `buildSrc/src/main/kotlin/kotlin-jvm.gradle.kts`.
    id("buildsrc.convention.kotlin-jvm")

    // Apply the Application plugin to add support for building an executable JVM application.
    application
}

dependencies {
    compileOnly(project(":loader"))
    compileOnly(libs.dependencyDownload)
}

application {
    mainClass = "gg.scala.universe.app.AppKt"
}

tasks.shadowJar {
    archiveFileName = "app.jarinjar"
}