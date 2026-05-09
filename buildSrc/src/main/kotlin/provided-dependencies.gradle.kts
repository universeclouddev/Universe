plugins {
    `java-library` // Required for compileOnlyApi
    `maven-publish`
}

// 1. Create the custom 'provided' configuration
val provided by configurations.creating {
    isTransitive = true
}

// Make it available for the current project's compilation
configurations.compileOnly.get().extendsFrom(provided)

// FIX FOR MULTI-MODULE: Make it available for dependent subprojects' compilation!
configurations.named("compileOnlyApi").configure {
    extendsFrom(provided)
}

// 2. Wrap the extraction and publishing in afterEvaluate
afterEvaluate {
    val providedDependencies = configurations["provided"].dependencies.mapNotNull { dep ->
        if (dep.group != null && dep.name != "unspecified") {
            val isTrans = (dep as? ModuleDependency)?.isTransitive ?: true
            val excludes = (dep as? ModuleDependency)?.excludeRules?.map {
                Pair(it.group ?: "*", it.module ?: "*")
            } ?: emptyList()

            mapOf(
                "group" to dep.group,
                "name" to dep.name,
                "version" to dep.version,
                "isTransitive" to isTrans,
                "excludes" to excludes
            )
        } else null
    }.toList()

    publishing {

        // This configureEach block targets any MavenPublication you create in the project
        publications.withType<MavenPublication>().configureEach {
            pom.withXml {
                val root = asNode()

                // Find the dependencies node, or create it if it's missing
                var dependenciesNode = root.children().filterIsInstance<groovy.util.Node>().firstOrNull {
                    it.name().toString().endsWith("dependencies")
                }
                if (dependenciesNode == null) {
                    dependenciesNode = root.appendNode("dependencies")
                }

                // Get all current dependency nodes added by Gradle
                val existingDependencyNodes = dependenciesNode.children().filterIsInstance<groovy.util.Node>()

                providedDependencies.forEach { depData ->
                    val group = depData["group"] as String
                    val name = depData["name"] as String
                    val version = depData["version"] as String?
                    val isTransitive = depData["isTransitive"] as Boolean

                    @Suppress("UNCHECKED_CAST")
                    val excludes = depData["excludes"] as List<Pair<String, String>>

                    // Check if Gradle already automatically added this dependency to the POM
                    val existingNode = existingDependencyNodes.firstOrNull { node ->
                        val nodeGroup = node.children().filterIsInstance<groovy.util.Node>()
                            .find { it.name().toString().endsWith("groupId") }?.text()
                        val nodeName = node.children().filterIsInstance<groovy.util.Node>()
                            .find { it.name().toString().endsWith("artifactId") }?.text()

                        nodeGroup == group && nodeName == name
                    }

                    if (existingNode != null) {
                        // It exists! Gradle added it (likely as 'compile'). Let's overwrite the scope to 'provided'
                        val scopeNode = existingNode.children().filterIsInstance<groovy.util.Node>()
                            .find { it.name().toString().endsWith("scope") }

                        if (scopeNode != null) {
                            scopeNode.setValue("provided")
                        } else {
                            existingNode.appendNode("scope", "provided")
                        }
                    } else {
                        // It doesn't exist in the POM yet, so we manually append it
                        val dependencyNode = dependenciesNode.appendNode("dependency")
                        dependencyNode.appendNode("groupId", group)
                        dependencyNode.appendNode("artifactId", name)

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