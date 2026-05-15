# Discord Extension

Universe Discord bot extension — monitor and manage your cluster from Discord using slash commands.

## Features

- **Cluster status** — active instance count, configuration count
- **Instance listing** — all active instances with state, address, and runtime
- **Configuration listing** — all configurations with RAM, CPU, and runtime
- **Instance details** — detailed view of a specific instance by ID
- **Instance control** — start, stop, and execute commands on instances
- **Role-based access control** — restrict commands to specific Discord roles

## Setup

### 1. Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to **Bot** → **Add Bot**
4. Copy the bot token
5. Go to **OAuth2 → URL Generator** and select these scopes/permissions:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`, `Read Message History`
6. Use the generated URL to invite the bot to your server

### 2. Configure the Extension

Edit `./extensions/discord/config.json`:

```json
{
  "token": "YOUR_BOT_TOKEN_HERE",
  "guild-id": "123456789012345678",
  "status-channel-id": "",
  "log-channel-id": "",
  "embed-color": 5814783,
  "allowed-role-ids": ["123456789012345678", "987654321098765432"],
  "intents": ["MESSAGE_CONTENT", "GUILD_MESSAGES", "GUILD_MEMBERS"]
}
```

| Field | Description | Required |
|---|---|---|
| `token` | Discord bot token | Yes |
| `guild-id` | Your Discord server ID | No |
| `status-channel-id` | Channel ID for status messages | No |
| `log-channel-id` | Channel ID for log output | No |
| `embed-color` | Embed accent color (decimal integer) | No (default: `5814783`) |
| `allowed-role-ids` | Discord role IDs allowed to use commands. Empty = everyone | No |
| `intents` | Gateway intents to enable | No |

### 3. Enable the Extension

The extension is automatically loaded when placed in `./extensions/discord/`. Restart Universe to load it.

## Commands

| Command | Description |
|---|---|
| `/status` | Show cluster overview (active instances, configurations) |
| `/instances` | List all active instances with state, address, and runtime |
| `/configurations` | List all configurations with RAM, CPU, and runtime |
| `/instance <id>` | Get detailed info for a specific instance |
| `/start <configuration>` | Request to start a new instance |
| `/stop <id>` | Request to stop an instance |
| `/execute <id> <command>` | Send a command to a running instance |

## Role-Based Access Control

Set `allowed-role-ids` in the config to restrict command usage. Only users with at least one of the listed roles can use bot commands.

To find a role ID:
1. Enable Developer Mode in Discord (Settings → Advanced → Developer Mode)
2. Right-click a role → **Copy Role ID**

If `allowed-role-ids` is empty, all users can use commands.

## Architecture

- Uses **JDA 6.4.1** for Discord API interaction
- All JDA dependencies are relocated to `gg.scala.universe.libs.*` to avoid conflicts
- Injects `ClusterDataProvider` via Guice for extension-safe cluster state access
- Slash commands only (no prefix/text commands)
