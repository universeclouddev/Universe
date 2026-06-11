name: Extension Proposal
description: Propose a new extension for the Universe extension system
title: "[ext]: "
labels: ["extension", "needs-triage"]
body:
  - type: markdown
    attributes:
      value: |
        Want to build a new extension for Universe? Fill this out so we can review the proposal before implementation.

        Extensions must follow the naming convention: `runtime-*`, `storage-*`, `db-*`, `metrics-*`, etc.
        Extensions must only depend on `:api` and `:extensions:extension-api` — never on `:app`.

  - type: input
    id: youtrack
    attributes:
      label: YouTrack Ticket
      description: Link to the corresponding YouTrack ticket (if applicable)
      placeholder: "LUNA-XXX"
    validations:
      required: false

  - type: input
    id: name
    attributes:
      label: Extension Name
      description: Proposed module name (must follow naming convention)
      placeholder: "extensions:runtime-nomad"
    validations:
      required: true

  - type: dropdown
    id: category
    attributes:
      label: Extension Category
      options:
        - "runtime-* (Runtime Provider)"
        - "storage-* (Template Storage)"
        - "db-* (Database Provider)"
        - "metrics-* (Metrics Export)"
        - "Other"
    validations:
      required: true

  - type: textarea
    id: description
    attributes:
      label: What does this extension do?
      description: Describe the extension's purpose and what problem it solves.
    validations:
      required: true

  - type: textarea
    id: interfaces
    attributes:
      label: Interfaces to Implement
      description: Which interfaces will this extension implement? (e.g., `RuntimeProvider`, `TemplateStorageProvider`)
      placeholder: |
        - RuntimeProvider (start, stop, pipeStdin)
        - HealthCheckProvider
    validations:
      required: true

  - type: textarea
    id: dependencies
    attributes:
      label: External Dependencies
      description: List any external libraries or SDKs this extension will require.
      placeholder: |
        - HashiCorp Nomad Java SDK x.y.z
        - ...
    validations:
      required: true

  - type: textarea
    id: registration
    attributes:
      label: Self-Registration Plan
      description: How will the extension register itself in its `onLoad()` method?
      placeholder: "The extension will inject RuntimeRegistry and call registry.register(\"nomad\", provider)"
    validations:
      required: true

  - type: checkboxes
    id: rules
    attributes:
      label: Extension Rules Acknowledgement
      description: By submitting this proposal, you confirm the following:
      options:
        - label: This extension will NOT depend on the `:app` module
          required: true
        - label: This extension will only depend on `:api` and `:extensions:extension-api`
          required: true
        - label: This extension will self-register via Guice-injected registries in `onLoad()`
          required: true
        - label: This extension follows the naming convention for its category
          required: true
