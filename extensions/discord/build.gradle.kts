dependencies {
    implementation(project(":extensions:extension-api"))
    implementation(kotlin("stdlib"))

    // JDA for Discord bot
    implementation(libs.jda)

    // Cloud commands for Discord
    implementation(libs.cloudAnnotations)
    implementation(libs.cloudCoreApi)

    // Shade Gson (relocated)
    implementation(libs.gson)
}

tasks {
    shadowJar {
        archiveClassifier.set("")
        archiveVersion.set("")

        // Relocate shaded libraries
        relocate("com.google.gson", "gg.scala.universe.libs.gson")
        relocate("org.incendo.cloud", "gg.scala.universe.libs.cloud")
        relocate("kotlin", "gg.scala.universe.libs.kotlin") {
            exclude("kotlin/Metadata.class")
            exclude("kotlin/metadata/**")
        }
        relocate("kotlinx", "gg.scala.universe.libs.kotlinx")
        relocate("net.dv8tion.jda", "gg.scala.universe.libs.jda")
        relocate("com.iwebpp", "gg.scala.universe.libs.iwebpp")
        relocate("com.neovisionaries", "gg.scala.universe.libs.neovisionaries")
        relocate("okhttp3", "gg.scala.universe.libs.okhttp3")
        relocate("okio", "gg.scala.universe.libs.okio")
        relocate("org.apache.commons.collections4", "gg.scala.universe.libs.commons4")
        relocate("org.jetbrains.annotations", "gg.scala.universe.libs.jetbrains.annotations")
        relocate("org.slf4j", "gg.scala.universe.libs.slf4j")
        relocate("com.fasterxml.jackson", "gg.scala.universe.libs.jackson")
    }

    build {
        dependsOn(shadowJar)
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_25
    }
}
