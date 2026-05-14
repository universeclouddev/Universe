dependencies {
    compileOnly(project(":api"))
    compileOnly(project(":extensions:extension-api"))
    runtimeDownload(libs.bundles.k8s)
}
