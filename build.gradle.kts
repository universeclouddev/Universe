import com.gorylenko.GenerateGitPropertiesTask
import dev.vankka.dependencydownload.task.GenerateDependencyDownloadResourceTask
import org.gradle.kotlin.dsl.build
import org.gradle.kotlin.dsl.invoke
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    `maven-publish`
    `java-library`
    kotlin("jvm")
    alias(libs.plugins.shadow)
    alias(libs.plugins.gitProperties)

    id("dev.vankka.dependencydownload.plugin") version "2.0.0" apply false
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
    apply(plugin = "dev.vankka.dependencydownload.plugin")

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

        dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"
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

    tasks {
        build {
            dependsOn(shadowJar)
        }

        compileJava {
            options.encoding = "UTF-8"
        }

        compileKotlin {

        }

        val rootName = rootProject.name
        val projName = project.name
        val projVersion = project.version.toString()
        val targetDir = rootProject.layout.projectDirectory.dir(".built")
        val archiveFile = shadowJar.flatMap { it.archiveFile }

        register<Copy>("copyToRootTarget") {
            from(archiveFile)
            into(targetDir)

            // Rename the file during the copy process
            rename { "${rootName}-${projName}-${projVersion}.jar" }
            dependsOn(shadowJar)
        }

        assemble {
            finalizedBy("copyToRootTarget")
        }

        val generateDependencies = register<GenerateDependencyDownloadResourceTask>("generateDependencies") {
            configuration.set(configurations.getByName("runtimeDownload"))
            includeShadowJarRelocations.set(true)
            hashingAlgorithm.set("SHA-256")
            file.set("dependencies.txt")
        }

        jar {
            dependsOn(generateDependencies)
        }

        shadowJar {
            dependsOn(generateDependencies)
        }
    }

    val provided by configurations.creating {
        isTransitive = true
    }

    configurations.compileOnly.get().extendsFrom(provided)

    // 1. Wrap the extraction and publishing in afterEvaluate
    // This forces Gradle to wait until bukkit/build.gradle.kts.kts has populated the dependencies
    afterEvaluate {
        val providedDependencies = configurations["provided"].dependencies.mapNotNull { dep ->
            // Notice: dep.version != null is removed here so BOM dependencies (Fawe) aren't dropped!
            if (dep.group != null && dep.name != "unspecified") {
                val isTrans = (dep as? ModuleDependency)?.isTransitive ?: true
                val excludes = (dep as? ModuleDependency)?.excludeRules?.map {
                    Pair(it.group ?: "*", it.module ?: "*")
                } ?: emptyList()

                // Store as a simple detached map
                mapOf(
                    "group" to dep.group,
                    "name" to dep.name,
                    "version" to dep.version, // Nullable!
                    "isTransitive" to isTrans,
                    "excludes" to excludes
                )
            } else null
        }.toList()

        // 2. Put the publishing block INSIDE afterEvaluate so it uses the populated list
        publishing {
            repositories.configureScalaRepository(dev = branchName != "main")
            publications {
                create<MavenPublication>("maven") {
                    from(components["java"])

                    pom.withXml {
                        val root = asNode()

                        // Find or create the <dependencies> XML node
                        var dependenciesNode = root.children().filterIsInstance<groovy.util.Node>().firstOrNull {
                            it.name().toString().endsWith("dependencies")
                        }

                        if (dependenciesNode == null) {
                            dependenciesNode = root.appendNode("dependencies")
                        }

                        // 3. Use our safely extracted list
                        providedDependencies.forEach { depData ->
                            val group = depData["group"] as String
                            val name = depData["name"] as String
                            val version = depData["version"] as String? // Cast as String? for BOM compatibility
                            val isTransitive = depData["isTransitive"] as Boolean

                            @Suppress("UNCHECKED_CAST")
                            val excludes = depData["excludes"] as List<Pair<String, String>>

                            val dependencyNode = dependenciesNode.appendNode("dependency")
                            dependencyNode.appendNode("groupId", group)
                            dependencyNode.appendNode("artifactId", name)

                            // Only write the version tag if it actually exists
                            if (version != null) {
                                dependencyNode.appendNode("version", version)
                            }

                            dependencyNode.appendNode("scope", "provided")

                            // Translate Gradle exclusions/transitivity to Maven exclusions
                            if (!isTransitive) {
                                val exclusionsNode = dependencyNode.appendNode("exclusions")
                                val exclusionNode = exclusionsNode.appendNode("exclusion")
                                exclusionNode.appendNode("groupId", "*")
                                exclusionNode.appendNode("artifactId", "*")
                            } else if (excludes.isNotEmpty()) {
                                val exclusionsNode = dependencyNode.appendNode("exclusions")
                                excludes.forEach { (exclGroup, exclModule) ->
                                    val exclusionNode = exclusionsNode.appendNode("exclusion")
                                    exclusionNode.appendNode("groupId", exclGroup)
                                    exclusionNode.appendNode("artifactId", exclModule)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
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
