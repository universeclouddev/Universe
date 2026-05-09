plugins {
    base
}

subprojects {
    dependencies {
        if (project.name.startsWith("extension-")) {
            compileOnly(project(":api"))

            if (!project.name.equals("extension-api")) {
                compileOnly(project(":extensions:extension-api"))
            }
        }
    }
}

tasks.named("build") {
    group = "build"
    description = "Builds all extension subprojects"

    // Tell the :extensions:build task to depend on the build task of all its children
    dependsOn(subprojects.map { it.tasks.named("build") })

    // If you specifically want to ensure your custom copy/shadow tasks run:
    // dependsOn(subprojects.map { it.tasks.named("copyToRootTarget") })
}

