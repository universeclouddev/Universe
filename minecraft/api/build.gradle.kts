java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(8)
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_1_8
    }
}
