plugins {
    // Apply the shared build logic from a convention plugin.
    // The shared code is located in `buildSrc/src/main/kotlin/kotlin-jvm.gradle.kts`.
    id("buildsrc.convention.kotlin-jvm")

    application
}

dependencies {
    // Api
    implementation(project(":api"))

    // Dependency Loader
    compileOnly(project(":loader"))
    compileOnly(libs.dependencyDownload)

    // Google
    runtimeDownload(libs.guava)
    runtimeDownload(libs.guice)

    // Cloud
    runtimeDownload(libs.bundles.cloudCommands)
    runtimeDownload(libs.bundles.cloudCommandsApi)
}

application {
    mainClass = "gg.scala.universe.app.AppKt"
}

tasks.shadowJar {
    archiveFileName = "app.jarinjar"
}