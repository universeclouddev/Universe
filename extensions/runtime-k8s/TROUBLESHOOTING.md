# K8s Extension Troubleshooting

## `UnknownHostException: kubernetes.default.svc`
- Universe tried auto-discovery (in-cluster config) and failed. Make sure `KUBECONFIG` is set or `kubeConfigPath` is configured.

## `UnknownHostException: host.docker.internal`
- You are on Linux Docker and forgot the `extra_hosts` line in docker-compose. Add it and recreate the container.

## Connection refused to `host.docker.internal:6443`
- The K8s API server is not listening on the host's `0.0.0.0:6443`. For minikube, run `minikube tunnel` or start minikube with `--driver=docker`.

## Certificate errors after URL rewrite
- The TLS certificate was issued for `127.0.0.1`, not `host.docker.internal`. Set `masterUrl` in the K8s config to skip auto-detection, or regenerate the cluster certificate to include `host.docker.internal` as a SAN.

## Pods immediately exit with `Phase: Failed, Reason: Error`
- **Local mode:** Make sure `hostDataPath` is set correctly in `./extensions/k8s/config.json` so the instance working directory is mounted into the pod.
- **Cloud mode (S3 init):** Check init container logs:
  ```bash
  kubectl logs <pod-name> -c init-template-<group>-<name>
  ```
  Common causes: missing S3 credentials, wrong bucket/region, template zip doesn't exist.
- **Cloud mode (shared PVC):** Check that the PVC is bound (`kubectl get pvc universe-data`). If it's `Pending`, your cluster may not have a default StorageClass that supports `ReadWriteMany`. Use `kubectl describe pvc universe-data` to see why.
- **Cloud mode (emptyDir):** The pod's working directory is empty. You need to either enable S3 init containers, mount a shared PVC, or bake files into the container image.

## Init containers fail with "Unable to locate credentials"
- The S3 extension config (`./extensions/s3/config.json`) is missing, unreadable, or lacks credentials.
- Verify the file exists and contains `accessKey` and `secretKey`.
- For in-cluster setups, the file should be at `/data/extensions/s3/config.json` inside the Universe pod.

## Init containers fail with "NoSuchKey" or 404
- The template zip doesn't exist in S3 at the expected key.
- Expected key format: `<prefix><group>/<name>.zip` (default prefix is `templates/`)
- Example: `s3://my-bucket/templates/minecraft/lobby.zip`

## Pods stuck in `Pending` or `ImagePullBackOff`
- Check that the `image` you specified exists in a registry the cluster can reach
- If using a private registry, configure `imagePullSecrets` on the namespace
- For the S3 init image (`amazon/aws-cli:latest`), ensure your cluster has outbound internet access or use a private mirror

## `java.nio.ByteBuffer.cleaner(): unavailable` / `sun.misc.Unsafe unavailable`
- This is a harmless Netty initialization message that appears when running inside Docker. Netty catches the exception internally and falls back to a different buffer cleaner.
- If you want to suppress it, **rebuild your Docker image** with the latest Universe JAR (the entrypoint now includes `--add-exports=java.base/sun.misc=ALL-UNNAMED`).

## Security Note

The kubeconfig file mounted into the container typically contains cluster admin credentials. Ensure your `docker-compose.yml` and data directory have appropriate file permissions.
