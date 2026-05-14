dependencies {
    compileOnly(project(":api"))
    compileOnly(project(":extensions:extension-api"))
    runtimeDownload(libs.gson)
}
