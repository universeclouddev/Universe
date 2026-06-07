# Universe Admin Panel

Next.js web panel for Universe. Designed for zero-config local use: no `.env`, no SQLite, no manual API keys.

## Quick start

**Terminal 1 — Universe**

```bash
java -jar loader/build/libs/universe.jar
```

**Terminal 2 — Panel**

```bash
cd panel
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The panel finds Universe automatically, creates your admin account, links the cluster, and drops you on the dashboard.

On first run you get a one-time password (for signing in from other browsers). Change it under **Settings → Users**.

## Tailscale / remote dev access

The dev server binds to all interfaces (`0.0.0.0`) so other machines on your Tailnet can reach it.

**On the host (where Universe + panel run):**

```bash
cd panel
npm run dev
```

**From another machine (e.g. Kyle on Windows):**

Open `http://beast:3000` (Tailscale MagicDNS hostname) or `http://100.x.x.x:3000` (Tailscale IP).

The panel **runs on the host** and proxies Universe API calls to `localhost:7000` server-side — Kyle does **not** need direct access to port 7000. Only port 3000 on the host must be reachable over Tailscale.

If your MagicDNS name differs from the machine hostname, set extra dev origins before starting the panel:

```bash
# Windows PowerShell
$env:PANEL_DEV_ORIGINS = "my-custom-name,my-custom-name:3000"
npm run dev
```

Restart `npm run dev` after changing origins. Cookies use `SameSite=Lax` and work over plain HTTP on Tailscale.

## What happens automatically

| Step | Before | Now |
|------|--------|-----|
| Panel secret | Copy `.env` / `PANEL_SECRET` | Auto-generated in `panel/data/.panel-secret` |
| Panel database | SQLite (`better-sqlite3`) | Simple JSON file `panel/data/panel.json` |
| Universe API key | Run `key create panel ALL` | Universe creates a `panel` key on first master start |
| Panel ↔ Universe link | Paste URL + token in setup | `GET /api/panel/bootstrap` + one-click setup |

## Production

Set `"allowPanelBootstrap": false` in Universe `config.json` to disable automatic key exposure, then manage API keys manually and add clusters in **Settings → Clusters**.

Optionally set `PANEL_SECRET` in the environment (min 16 characters) instead of using the auto-generated file.

## Docker

```bash
docker compose up universe panel
```

Open [http://localhost:3000/setup](http://localhost:3000/setup).

## Auth model

| Layer | Responsibility |
|-------|----------------|
| **Panel session** | Email/password or OIDC → JWT cookie |
| **Universe proxy** | Server uses the stored `panel` ALL key |
| **Panel RBAC** | Roles `viewer` → `admin` → `operator` (top). The first-created user is permanently `operator`. |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run generate:api` | Regenerate types from OpenAPI |

## Environment (all optional)

| Variable | Description |
|----------|-------------|
| `PANEL_SECRET` | Override auto-generated secret |
| `PANEL_DATA_DIR` | Data directory (default `./data`) |
| `UNIVERSE_API_URL` | Universe URL for auto-discovery |
| `PANEL_DEV_ORIGINS` | Extra hostnames for Next.js dev (comma-separated, e.g. `beast,beast:3000`) |
| `PORT` | Dev server port (default `3000`; also used when building the dev-origin allow list) |
