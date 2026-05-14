dependencies {
    compileOnly(project(":api"))
    compileOnly(project(":extensions:extension-api"))
    runtimeDownload(libs.micrometer.core)
    runtimeDownload(libs.micrometer.registry.influx)
    runtimeDownload(libs.influxdb.client)
}
