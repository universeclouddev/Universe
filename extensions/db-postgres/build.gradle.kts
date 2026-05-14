dependencies {
    compileOnly(project(":api"))
    compileOnly(project(":extensions:extension-api"))
    compileOnly(libs.jooq)
    compileOnly(libs.jooq.kotlin)
    runtimeDownload(libs.postgres)
}
