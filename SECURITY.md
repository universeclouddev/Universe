# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.0.x   | :white_check_mark: |

As Universe is in active pre-release development, only the latest version receives security updates.

## Reporting a Vulnerability

We take the security of Universe seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via:

- **Email**: security@lunarlabs.dev
- **Subject line**: `[Universe Security] <brief description>`

Please include the following information in your report:

- Type of vulnerability
- Full paths of source file(s) related
- Location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your vulnerability report within **48 hours**
- **Assessment**: We will assess the vulnerability and provide an initial response within **7 days**
- **Resolution**: We aim to resolve confirmed vulnerabilities within **30 days**
- **Disclosure**: We will coordinate with you on the disclosure timeline

### Scope

Security concerns may include but are not limited to:

- **Cluster Communication**: Hazelcast encryption, node authentication, task injection
- **REST API**: Ktor server authentication, authorization, input validation
- **Template System**: Path traversal, variable injection, file access controls
- **Extension System**: Extension isolation, privilege escalation via extensions
- **Configuration**: Credential exposure in `config.json`, sensitive data handling
- **Minecraft Plugins**: Plugin-to-master communication, command interception security
- **Dependencies**: Vulnerable third-party library versions

### Out of Scope

- Issues in dependencies that are already tracked and patched upstream
- Social engineering attacks
- Physical security attacks
- Denial of service attacks requiring significant resources

## Security Best Practices for Contributors

When contributing to Universe, please follow these security guidelines:

1. **Never commit secrets** — API keys, passwords, tokens, or credentials
2. **Use the version catalog** — all dependencies go through `libs.versions.toml` for version control
3. **Validate all input** — especially REST API endpoints and console commands
4. **Follow extension isolation** — extensions must not access `:app` internals
5. **Use Coroutines for I/O** — prevent thread starvation and blocking attacks
6. **Sanitize template variables** — prevent injection through `%VARIABLE%` replacement
7. **Review Hazelcast task serialization** — ensure Gson-serialized payloads are validated

## Acknowledgments

We appreciate responsible disclosure and will acknowledge contributors who report valid security issues (unless they prefer to remain anonymous).
