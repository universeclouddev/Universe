package gg.scala.universe.docker

data class DockerImageConfig(
    val repository: String = "azul/zulu-openjdk",
    val tag: String = "17-jre-headless",
    val registry: String? = null,
    val platform: String? = null
)

data class DockerVolumeConfig(
    val hostPath: String,
    val containerPath: String,
    val readOnly: Boolean = false
)

data class DockerPortConfig(
    val containerPort: Int,
    val protocol: String = "tcp"
)

data class DockerConfig(
    val factoryName: String = "docker-jvm",
    val network: String? = "host",
    val javaImage: DockerImageConfig = DockerImageConfig(),
    val volumes: List<DockerVolumeConfig> = emptyList(),
    val binds: List<String> = emptyList(),
    val exposedPorts: List<DockerPortConfig> = emptyList(),
    val dockerHost: String? = "unix:///var/run/docker.sock",
    val dockerCertPath: String? = null,
    val registryUsername: String? = null,
    val registryEmail: String? = null,
    val registryPassword: String? = null,
    val registryUrl: String? = null,
    val user: String? = null,
    val containerWorkDir: String = "/app",
    val autoRemove: Boolean = true,
    val stopTimeout: Int = 10
)
