## Description

<!-- Provide a clear and concise description of what this PR does. -->

## YouTrack Ticket

<!-- Reference the YouTrack ticket ID if avaliable. Format: LUNA-XXX -->
<!-- Example: LUNA-42 -->

## Type of Change

<!-- Check all that apply -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Extension addition (new extension module)
- [ ] Documentation update
- [ ] Refactor (no functional changes)
- [ ] Build / CI change
- [ ] Dependency update

## Module(s) Affected

<!-- List the modules changed by this PR -->
<!-- Example: :app, :api, :extensions:runtime-docker -->

- [ ] `:api`
- [ ] `:app`
- [ ] `:loader`
- [ ] `:extensions:extension-api`
- [ ] `:extensions:runtime-docker`
- [ ] `:extensions:runtime-k8s`
- [ ] `:extensions:storage-s3`
- [ ] `:extensions:db-postgres`
- [ ] `:extensions:db-mongodb`
- [ ] `:extensions:db-redis`
- [ ] `:extensions:metrics-prometheus`
- [ ] `:extensions:metrics-influxdb`
- [ ] `:extensions:gitops`
- [ ] `:extensions:argocd`
- [ ] `:extensions:discord`
- [ ] `:extensions:tailscale`
- [ ] `:minecraft:minecraft-api`
- [ ] `:minecraft:minecraft-modern`
- [ ] `:minecraft:minecraft-legacy`
- [ ] `:minecraft:minecraft-velocity`
- [ ] `:minecraft:minecraft-bungee`
- [ ] `:minecraft:minecraft-folia`
- [ ] Build / CI

## Testing

<!-- Describe the tests you ran and how to reproduce them -->

### Test Commands

```bash
# Example: ./gradlew :app:test
# Example: ./gradlew build
```

### Manual Testing Steps

<!-- If applicable, describe manual testing steps -->

1. 
2. 
3. 

## Checklist

### Code Quality

- [ ] My code follows the project's Kotlin JVM 25 standards
- [ ] I have used Google Guice for dependency injection (no static singletons for DI)
- [ ] I have used Gson for serialization (no other JSON libraries)
- [ ] I have used the version catalog (`libs.versions.toml`) for all dependencies
- [ ] I have added `@author Luna` and `@date` to any new classes
- [ ] I have only commented complicated code sections (not every line)
- [ ] I have avoided `/*` in KDoc comments (used `/(*)` instead)

### Extension Rules (if applicable)

- [ ] My extension does NOT depend on the `:app` module
- [ ] My extension only depends on `:api` and `:extensions:extension-api`
- [ ] My extension self-registers via Guice-injected registries in `onLoad()`
- [ ] My extension follows the naming convention (`runtime-*`, `storage-*`, etc.)
- [ ] The core Wrapper code does NOT reference Docker directly (uses `RuntimeProvider` interface)

### Architecture

- [ ] I have used Kotlin Coroutines for file I/O and Ktor HTTP calls (no blocking Hazelcast threads)
- [ ] Hazelcast tasks are serialized as Gson-serialized JSON strings
- [ ] Instance IDs are 6-character alphanumeric strings (not full UUIDs)
- [ ] All user-facing CLI output uses the `Console` system (not SLF4J directly)

### Commit Hygiene

- [ ] My commit messages are lowercase and prefixed (`feat:`, `fix:`, `refractor:`, `chore:`)
- [ ] My commit messages reference the YouTrack ticket ID (e.g., `LUNA-42: ...`)
- [ ] I have not committed any files that shouldn't be committed (no secrets, no IDE files)
- [ ] I have not included any internal/AI attribution in commit messages or this PR

## Screenshots / Output

<!-- If applicable, add screenshots or console output to demonstrate the change -->

## Additional Notes

<!-- Any additional context, concerns, or follow-up items -->
