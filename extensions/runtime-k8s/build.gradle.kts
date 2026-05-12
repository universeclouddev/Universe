dependencies {
    runtimeDownload(libs.bundles.k8s)
    compileOnly(project(":extensions:extension-storage-s3"))
}
