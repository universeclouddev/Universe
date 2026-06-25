name: Documentation Issue
description: Report missing, incorrect, or outdated documentation
title: "[docs]: "
labels: ["documentation", "needs-triage"]
body:
  - type: markdown
    attributes:
      value: |
        Help us improve the Universe documentation. Report anything that's missing, wrong, or unclear.

  - type: input
    id: youtrack
    attributes:
      label: YouTrack Ticket
      description: Link to the corresponding YouTrack ticket (if applicable)
      placeholder: "LUNA-XXX"
    validations:
      required: false

  - type: dropdown
    id: doc-type
    attributes:
      label: Documentation Type
      options:
        - "README / Getting Started"
        - "API Reference (KDoc)"
        - "Extension Development Guide"
        - "Configuration Reference"
        - "Deployment Guide"
        - "Minecraft Plugin Documentation"
        - "Architecture / Design Docs"
        - "Changelog / Release Notes"
        - "Other"
    validations:
      required: true

  - type: textarea
    id: issue
    attributes:
      label: What's wrong or missing?
      description: Describe the documentation issue clearly.
      placeholder: "The extension development guide doesn't cover..."
    validations:
      required: true

  - type: textarea
    id: suggestion
    attributes:
      label: Suggested Improvement
      description: If you have a suggestion for how to fix it, describe it here.
    validations:
      required: false

  - type: input
    id: location
    attributes:
      label: File or Section Location
      description: Where is the problematic documentation? (file path, URL, or section name)
      placeholder: "AGENTS.md, section 'Extension Isolation'"
    validations:
      required: false
