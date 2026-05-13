tasks.named("build") {
    group = "build"
    description = "Builds all minecraft subprojects"

    // Tell the :minecraft:build task to depend on the build task of all its children
    dependsOn(subprojects.map { it.tasks.named("build") })

    // If you specifically want to ensure your custom copy/shadow tasks run:
    // dependsOn(subprojects.map { it.tasks.named("copyToRootTarget") })
}