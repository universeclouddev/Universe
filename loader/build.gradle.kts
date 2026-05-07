plugins {
    application
    alias(libs.plugins.jib)
}

application {
    mainClass.set("LoaderKt")
}

dependencies {
    implementation(libs.dependencyDownload)
    implementation("me.lucko:jar-relocator:1.7")
    implementation("org.ow2.asm:asm:9.9.1")
    implementation("org.ow2.asm:asm-commons:9.9.1")

    implementation(kotlin("stdlib"))
}

tasks {
    shadowJar {
//        exclude("**/*.kotlin_metadata")
        archiveFileName.set("universe.jar")

        project(":app")?.let {
            dependsOn(it.tasks.shadowJar)
        }

        from(project(":app").tasks.shadowJar)
    }
}

tasks.jib {
    dependsOn(tasks.shadowJar)
}

jib {
    to {
        image = "git.lunarlabs.dev/scala/universe"
        setTags(provider {
            val git = project.extra["git"] as Map<*, *>
            val commitId = git["git.commit.id.abbrev"].toString()
            val commitIdFull = git["git.commit.id"].toString()
            val branchName = git["git.branch"].toString()

            setOf("dev", commitId, commitIdFull, branchName)
        })

        auth {
            username = System.getenv("REGISTRY_USER") ?: ""
            password = System.getenv("REGISTRY_PASS") ?: ""
        }
    }
    container {
        entrypoint = listOf(
            "java",
            "--add-opens=java.base/java.time=ALL-UNNAMED",
            "--add-opens=java.base/java.net=ALL-UNNAMED",
            "--enable-native-access=ALL-UNNAMED",
            "-jar", "/app/universe.jar"
        )

        creationTime = provider {
            // Retrieve the 'git' extra property and cast it to a Map
            val git = project.extra["git"] as Map<*, *>
            git["git.commit.time"].toString()
        }

        workingDirectory = "/data"

        labels = mapOf(
            "org.opencontainers.image.source" to "https://git.lunarlabs.dev/scala/universe"
        )

        // Tell Jib to copy the ShadowJar into the /app directory of the image
        extraDirectories {
            paths {
                path {
                    setFrom(tasks.shadowJar.get().archiveFile.get().asFile.parentFile)
                    into = "/app"
                    includes = listOf(tasks.shadowJar.get().archiveFileName.get())
                }
            }
        }
    }
}