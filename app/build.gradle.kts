plugins {
    application
}

dependencies {
    // api
    implementation(project(":api"))

    // dependency Loader
    compileOnly(project(":loader"))
    compileOnly(libs.dependencyDownload)

    // google
    runtimeDownload(libs.guava)
    runtimeDownload(libs.guice)

    // pretty log
    runtimeDownload(libs.okio)
    runtimeDownload(libs.kotlinx.datetime)
    runtimeDownload(libs.bundles.prettyLog)

    // cloud
    runtimeDownload(libs.bundles.cloudCommands)
}

application {
    mainClass = "gg.scala.universe.app.AppKt"
}

tasks.shadowJar {
    archiveFileName = "app.jarinjar"
}