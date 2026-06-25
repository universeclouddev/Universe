name: Feature Request
description: Suggest a new feature or enhancement for Universe
title: "[feat]: "
labels: ["enhancement", "needs-triage"]
body:
  - type: markdown
    attributes:
      value: |
        Have an idea to improve Universe? We'd love to hear it. Please provide as much context as possible.

  - type: input
    id: youtrack
    attributes:
      label: YouTrack Ticket
      description: Link to the corresponding YouTrack ticket (if applicable)
      placeholder: "LUNA-XXX"
    validations:
      required: false

  - type: dropdown
    id: area
    attributes:
      label: Feature Area
      description: Which area does this feature relate to?
      options:
        - "Core Orchestrator (:app)"
        - "Shared API (:api)"
        - "Extension System"
        - "Runtime Providers (Docker, K8s, tmux, screen)"
        - "Template System"
        - "REST API / Ktor"
        - "Console Commands (Cloud v2)"
        - "Cluster Communication (Hazelcast)"
        - "Minecraft Plugins"
        - "Build / CI"
        - "Documentation"
        - "Other"
    validations:
      required: true

  - type: textarea
    id: problem
    attributes:
      label: Problem Statement
      description: Is your feature request related to a problem? Describe it.
      placeholder: "I'm always frustrated when..."
    validations:
      required: true

  - type: textarea
    id: solution
    attributes:
      label: Proposed Solution
      description: Describe the solution you'd like. Include API design, interface changes, or architectural notes if applicable.
      placeholder: "I would like to see..."
    validations:
      required: true

  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives Considered
      description: Have you considered any alternative solutions or workarounds?
    validations:
      required: false

  - type: textarea
    id: context
    attributes:
      label: Additional Context
      description: Add any other context, mockups, or references to similar features in other projects (e.g., CloudNet, SimpleCloud).
    validations:
      required: false

  - type: dropdown
    id: breaking
    attributes:
      label: Breaking Change?
      description: Would this feature introduce a breaking change to the public API?
      options:
        - "No"
        - "Yes"
        - "Unsure"
    validations:
      required: true

  - type: checkboxes
    id: contribution
    attributes:
      label: Contribution
      options:
        - label: I am willing to implement this feature myself
          required: false
        - label: I have checked that this feature does not already exist
          required: true
