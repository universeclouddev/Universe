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

    // okio (used by ExtensionService for path handling)
    runtimeDownload(libs.okio) {
        exclude(group = "org.jetbrains.kotlin")
    }

    // cloud
    runtimeDownload(libs.bundles.cloudCommands) {
        exclude(group = "org.jetbrains.kotlin") // disable transitive kotlin
        exclude(group = "org.jetbrains.kotlin", module = "kotlin-reflect") // disable transitive kotlin reflect
    }

    // ktor
    runtimeDownload(libs.bundles.ktor) {
        exclude(group = "org.jetbrains.kotlin")
        exclude(group = "org.jetbrains.kotlin", module = "kotlin-reflect")
    }

    // jline for console tab completion
    runtimeDownload(libs.bundles.jline) {
        exclude(group = "org.jetbrains.kotlin")
    }
}

tasks.shadowJar {
    archiveFileName = "app.jarinjar"
}