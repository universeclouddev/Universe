name: Bug Report
description: Report a bug in the Universe orchestrator
title: "[bug]: "
labels: ["bug", "needs-triage"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to report a bug. Please fill in as much detail as possible.

  - type: input
    id: youtrack
    attributes:
      label: YouTrack Ticket
      description: Link to the corresponding YouTrack ticket (if applicable)
      placeholder: "LUNA-XXX"
    validations:
      required: false

  - type: dropdown
    id: module
    attributes:
      label: Affected Module
      description: Which module does this bug affect?
      options:
        - ":app (Core Orchestrator)"
        - ":api (Shared API)"
        - ":loader (Bootstrap)"
        - ":extensions:runtime-docker"
        - ":extensions:runtime-k8s"
        - ":extensions:storage-s3"
        - ":extensions:db-postgres"
        - ":extensions:db-mongodb"
        - ":extensions:db-redis"
        - ":extensions:metrics-prometheus"
        - ":extensions:metrics-influxdb"
        - ":extensions:gitops"
        - ":extensions:argocd"
        - ":extensions:discord"
        - ":extensions:tailscale"
        - ":minecraft:minecraft-modern"
        - ":minecraft:minecraft-legacy"
        - ":minecraft:minecraft-velocity"
        - ":minecraft:minecraft-bungee"
        - ":minecraft:minecraft-folia"
        - ":minecraft:minecraft-api"
        - "Build / CI"
        - "Other"
    validations:
      required: true

  - type: input
    id: version
    attributes:
      label: Universe Version
      description: What version of Universe are you running?
      placeholder: "0.0.1"
    validations:
      required: true

  - type: input
    id: jvm
    attributes:
      label: JVM Version
      description: Output of `java -version`
      placeholder: "openjdk 25.0.x"
    validations:
      required: true

  - type: input
    id: os
    attributes:
      label: Operating System
      description: OS and version
      placeholder: "Ubuntu 24.04 LTS / Windows 11 / macOS 15.x"
    validations:
      required: true

  - type: textarea
    id: description
    attributes:
      label: What happened?
      description: Describe the bug clearly and concisely.
      placeholder: "When I start a wrapper node, the instance fails to..."
    validations:
      required: true

  - type: textarea
    id: reproduction
    attributes:
      label: Steps to Reproduce
      description: How can we reproduce this issue?
      placeholder: |
        1. Configure config.json with...
        2. Run `java -jar universe.jar`
        3. Execute command...
        4. See error
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
      description: What should have happened instead?
    validations:
      required: true

  - type: textarea
    id: logs
    attributes:
      label: Relevant Log Output
      description: Paste any relevant console output or log snippets. Use code blocks (```) for formatting.
      render: shell

  - type: textarea
    id: config
    attributes:
      label: Configuration (if relevant)
      description: Share relevant parts of config.json or instance configuration (redact sensitive data).
      render: json

  - type: checkboxes
    id: terms
    attributes:
      label: Verification
      options:
        - label: I am running the latest version
          required: false
        - label: I have searched existing issues and this has not been reported
          required: true
