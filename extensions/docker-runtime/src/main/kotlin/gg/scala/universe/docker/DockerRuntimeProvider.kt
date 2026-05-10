package gg.scala.universe.docker

import com.github.dockerjava.api.DockerClient
import com.github.dockerjava.api.model.Bind
import com.github.dockerjava.api.model.ExposedPort
import com.github.dockerjava.api.model.HostConfig
import com.github.dockerjava.api.model.PortBinding
import com.github.dockerjava.api.model.Ports
import com.github.dockerjava.api.model.Volume
import com.github.dockerjava.core.DefaultDockerClientConfig
import com.github.dockerjava.core.DockerClientImpl
import com.github.dockerjava.httpclient5.ApacheDockerHttpClient
import cz.lukynka.prettylog.LogType
import cz.lukynka.prettylog.log
import gg.scala.universe.runtime.RuntimeProvider
import java.nio.file.Path
import java.time.Duration
import java.time.Instant
import java.util.Optional
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.stream.Stream

/**
 * [RuntimeProvider] implementation using Docker containers.
 *
 * Each instance runs in a dedicated Docker container. The working directory
 * is bind-mounted into the container. Commands are executed via `docker exec`.
 */
class DockerRuntimeProvider(
    private val config: DockerConfig
) : RuntimeProvider {

    private val dockerClient: DockerClient = createDockerClient()
    private val containerIds = ConcurrentHashMap<String, String>()

    override fun start(instanceId: String, workingDir: Path, port: Int, command: String): ProcessHandle {
        val containerName = "universe-$instanceId"

        // Ensure no stale container with this name exists
        removeContainerIfExists(containerName)

        val imageRef = buildImageRef(config.javaImage)

        // Build port bindings
        val exposedPorts = mutableListOf<ExposedPort>()
        val portBindings = Ports()

        // Always bind the allocated port (maps host port to same container port)
        val allocatedExposed = ExposedPort.tcp(port)
        exposedPorts.add(allocatedExposed)
        portBindings.bind(allocatedExposed, Ports.Binding.bindPort(port))

        // Add extra exposed ports from config
        config.exposedPorts.forEach { ep ->
            val exposed = if (ep.protocol.equals("udp", ignoreCase = true)) {
                ExposedPort.udp(ep.containerPort)
            } else {
                ExposedPort.tcp(ep.containerPort)
            }
            exposedPorts.add(exposed)
            portBindings.bind(exposed, Ports.Binding.empty())
        }

        // Build volume binds
        val binds = mutableListOf<Bind>()
        binds.add(Bind(workingDir.toAbsolutePath().toString(), Volume(config.containerWorkDir)))

        config.volumes.forEach { vol ->
            binds.add(Bind(vol.hostPath, Volume(vol.containerPath), vol.readOnly))
        }

        config.binds.forEach { bindStr ->
            // Format: "hostPath:containerPath" or "hostPath:containerPath:ro"
            val parts = bindStr.split(":")
            when (parts.size) {
                2 -> binds.add(Bind(parts[0], Volume(parts[1])))
                3 -> binds.add(Bind(parts[0], Volume(parts[1]), parts[2] == "ro"))
            }
        }

        val hostConfig = HostConfig.newHostConfig()
            .withBinds(*binds.toTypedArray())
            .withPortBindings(portBindings)
            .withAutoRemove(config.autoRemove)
            .withNetworkMode(config.network)

        val createCmd = dockerClient.createContainerCmd(imageRef)
            .withName(containerName)
            .withWorkingDir(config.containerWorkDir)
            .withCmd("sh", "-c", command)
            .withExposedPorts(*exposedPorts.toTypedArray())
            .withHostConfig(hostConfig)

        if (config.user != null) {
            createCmd.withUser(config.user)
        }

        val createResponse = createCmd.exec()

        dockerClient.startContainerCmd(createResponse.id).exec()
        containerIds[instanceId] = createResponse.id

        log("Started Docker container '$containerName' (id=${createResponse.id}) for instance $instanceId on port $port", LogType.SUCCESS)

        // Return a synthetic ProcessHandle that delegates to the container
        return DockerProcessHandle(createResponse.id, dockerClient)
    }

    override fun stop(instanceId: String) {
        val containerId = containerIds.remove(instanceId) ?: return
        try {
            dockerClient.stopContainerCmd(containerId).withTimeout(config.stopTimeout).exec()
            if (!config.autoRemove) {
                dockerClient.removeContainerCmd(containerId).withForce(true).exec()
            }
            log("Stopped Docker container for instance $instanceId", LogType.INFORMATION)
        } catch (e: Exception) {
            log("Failed to stop Docker container for instance $instanceId: ${e.message}", LogType.ERROR)
        }
    }

    override fun executeCommand(instanceId: String, command: String) {
        val containerId = containerIds[instanceId]
            ?: return log("No Docker container found for instance $instanceId", LogType.WARNING)

        try {
            val exec = dockerClient.execCreateCmd(containerId)
                .withCmd("sh", "-c", command)
                .withAttachStdout(true)
                .withAttachStderr(true)
                .exec()

            dockerClient.execStartCmd(exec.id).exec(com.github.dockerjava.api.async.ResultCallback.Adapter())
            log("Executed command in Docker container for instance $instanceId: $command", LogType.INFORMATION)
        } catch (e: Exception) {
            log("Failed to execute command in Docker container for instance $instanceId: ${e.message}", LogType.ERROR)
        }
    }

    private fun buildImageRef(image: DockerImageConfig): String {
        val repo = image.repository
        val tag = image.tag
        return if (image.registry != null) {
            "${image.registry}/$repo:$tag"
        } else {
            "$repo:$tag"
        }
    }

    private fun removeContainerIfExists(name: String) {
        try {
            dockerClient.listContainersCmd()
                .withShowAll(true)
                .withNameFilter(listOf(name))
                .exec()
                .firstOrNull()
                ?.let {
                    dockerClient.removeContainerCmd(it.id).withForce(true).exec()
                }
        } catch (_: Exception) {
            // ignored
        }
    }

    private fun createDockerClient(): DockerClient {
        val builder = DefaultDockerClientConfig.createDefaultConfigBuilder()

        if (config.dockerHost != null) {
            builder.withDockerHost(config.dockerHost)
        }
        if (config.dockerCertPath != null) {
            builder.withDockerCertPath(config.dockerCertPath)
                .withDockerTlsVerify(true)
        }
        if (config.registryUsername != null) {
            builder.withRegistryUsername(config.registryUsername)
        }
        if (config.registryPassword != null) {
            builder.withRegistryPassword(config.registryPassword)
        }
        if (config.registryEmail != null) {
            builder.withRegistryEmail(config.registryEmail)
        }
        if (config.registryUrl != null) {
            builder.withRegistryUrl(config.registryUrl)
        }

        val dockerConfig = builder.build()

        val httpClient = ApacheDockerHttpClient.Builder()
            .dockerHost(dockerConfig.dockerHost)
            .sslConfig(dockerConfig.sslConfig)
            .maxConnections(100)
            .connectionTimeout(Duration.ofSeconds(30))
            .responseTimeout(Duration.ofSeconds(45))
            .build()

        return DockerClientImpl.getInstance(dockerConfig, httpClient)
    }
}

/**
 * A synthetic [ProcessHandle] that delegates lifecycle operations to a Docker container.
 */
private class DockerProcessHandle(
    private val containerId: String,
    private val dockerClient: DockerClient
) : ProcessHandle {

    override fun pid(): Long {
        // Docker container IDs are hex strings, not numeric PIDs.
        // We hash the first 8 chars to produce a stable synthetic PID.
        return containerId.take(8).toLongOrNull(16) ?: 0L
    }

    override fun parent(): Optional<ProcessHandle> = Optional.empty()
    override fun children(): Stream<ProcessHandle> = Stream.empty()
    override fun descendants(): Stream<ProcessHandle> = Stream.empty()
    override fun info(): ProcessHandle.Info = object : ProcessHandle.Info {
        override fun command(): Optional<String> = Optional.of("docker:$containerId")
        override fun commandLine(): Optional<String> = Optional.of("docker:$containerId")
        override fun arguments(): Optional<Array<String>> = Optional.empty()
        override fun startInstant(): Optional<Instant> = Optional.empty()
        override fun totalCpuDuration(): Optional<Duration> = Optional.empty()
        override fun user(): Optional<String> = Optional.empty()
    }

    override fun onExit(): CompletableFuture<ProcessHandle> {
        val future = CompletableFuture<ProcessHandle>()
        future.complete(this)
        return future
    }

    override fun supportsNormalTermination(): Boolean = true

    override fun destroy(): Boolean {
        return try {
            dockerClient.stopContainerCmd(containerId).withTimeout(10).exec()
            true
        } catch (_: Exception) {
            false
        }
    }

    override fun destroyForcibly(): Boolean {
        return try {
            dockerClient.killContainerCmd(containerId).exec()
            true
        } catch (_: Exception) {
            false
        }
    }

    override fun isAlive(): Boolean {
        return try {
            val container = dockerClient.inspectContainerCmd(containerId).exec()
            container.state.running ?: false
        } catch (_: Exception) {
            false
        }
    }

    override fun compareTo(other: ProcessHandle): Int {
        return pid().compareTo(other.pid())
    }
}
