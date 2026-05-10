// https://docs.gradle.org/current/userguide/settings_file_basics.html
// Learn more about structuring projects with Gradle - https://docs.gradle.org/8.7/userguide/multi_project_builds.html

dependencyResolutionManagement {
    // Use Maven Central as the default repository (where Gradle will download dependencies) in all subprojects.
    @Suppress("UnstableApiUsage")
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

plugins {
    // Use the Foojay Toolchains plugin to automatically download JDKs required by subprojects.
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "universe"

registerSubProjects(
    root = "extensions",
    prefix = "extension",
    subProjects = arrayOf("api", "example", "runtime-docker", "storage-s3")
//    subProjects = arrayOf("api", "loader", "processor", "runtime"),
)

include(":loader")
include(":app")
include(":api")
//
private fun registerSubProjects(root: String, prefix: String? = null, vararg subProjects: String) {
    val subProjectNamePrefix = if (prefix.isNullOrBlank()) "" else "$prefix-"
    subProjects.forEach {
        val projectPath = "$root:$it"
        include(projectPath)
        project(":$projectPath").name = "$subProjectNamePrefix$it"
    }
}
