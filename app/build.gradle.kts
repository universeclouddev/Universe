//configurations.named("runtimeDownload") {
//    exclude(group = "org.jetbrains.kotlin")
//}

dependencies {
    // api
    implementation(project(":api")) {
        exclude(group = "org.jetbrains.kotlin")
    }
    implementation(project(":extensions:extension-api"))

    // dependency Loader
    compileOnly(project(":loader"))
    compileOnly(libs.dependencyDownload)

    // hazelcast
    runtimeDownload(libs.hazelcast)

    // google
    runtimeDownload(libs.guava)
    runtimeDownload(libs.guice)
    runtimeDownload(libs.gson)

    // pretty log
    runtimeDownload(libs.okio) {
        exclude(group = "org.jetbrains.kotlin")
    }
    runtimeDownload(libs.kotlinx.datetime) {
        exclude(group = "org.jetbrains.kotlin")
    }
    runtimeDownload(libs.bundles.prettyLog) {
        exclude(group = "org.jetbrains.kotlin")
    }

    // cloud
    runtimeDownload(libs.bundles.cloudCommands) {
        exclude(group = "org.jetbrains.kotlin") // disable transitive kotlin
        exclude(group = "org.jetbrains.kotlin", module = "kotlin-reflect") // disable transitive kotlin reflect
    }
}

tasks.shadowJar {
    archiveFileName = "app.jarinjar"
}