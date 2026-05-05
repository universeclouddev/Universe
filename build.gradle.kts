import com.gorylenko.GenerateGitPropertiesTask
import org.gradle.kotlin.dsl.build
import org.gradle.kotlin.dsl.invoke
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    `maven-publish`
    `java-library`
    kotlin("jvm")
    alias(libs.plugins.shadow)
    alias(libs.plugins.gitProperties)
}

kotlin {
    jvmToolchain(25)
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_23)
    }
}

allprojects {
    version = "0.0.1"
    group = "gg.scala.universe"

    repositories {
        mavenCentral()

        configureScalaRepository()
        configureScalaRepository(dev = true)

        maven("https://repo.mincats.eu/mirrors/")
    }
}

subprojects {
    apply(plugin = "idea")
    apply(plugin = "org.jetbrains.kotlin.jvm")
    apply(plugin = "maven-publish")

    apply(plugin = rootProject.libs.plugins.shadow.get().pluginId)
    apply(plugin = rootProject.libs.plugins.gitProperties.get().pluginId)

    dependencies {
        compileOnly(kotlin("stdlib"))
    }

    configure<com.gorylenko.GitPropertiesPluginExtension> {
        gitPropertiesName = "git.properties"
        keys = listOf(
            "git.branch",
            "git.build.time",
            "git.build.version",
            "git.commit.id.abbrev",
            "git.commit.id",
            "git.commit.time",
            "git.tags",
            "git.closest.tag.name",
            "git.closest.tag.commit.count"
        )
        dateFormat = "yyyy-MM-dd-HH:mm:ss"
        dateFormatTimeZone = "UTC"
        extProperty = "git"
    }

    tasks.withType<GenerateGitPropertiesTask> {
        outputs.upToDateWhen { false }
    }

    val git = project.extra["git"] as Map<*, *>
    val commitId = git["git.commit.id.abbrev"].toString()
    val commitIdFull = git["git.commit.id"].toString()
    val branchName = git["git.branch"].toString()

    val versionWithGit = "${project.version}-$commitId-$branchName"
}


fun RepositoryHandler.configureScalaRepository(dev: Boolean = false) {
    maven("${property("artifactory_contextUrl")}/gradle-${if (dev) "dev" else "release"}") {
        name = "scala"
        credentials {
            username = property("artifactory_user").toString()
            password = property("artifactory_password").toString()
        }
    }
}
