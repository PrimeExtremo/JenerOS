# App manifest (v1)

Each catalog app lives at `[STORE]/apps/<id>/app.json`. The shipped catalog is
trusted image content under `/usr/share/jeneros/store/apps`. Requests name an app;
they cannot submit a new manifest, host path, Incus option or shell command.

```json
{
  "manifest": 1,
  "available": true,
  "id": "tv",
  "name": "TV",
  "upstream": "Jellyfin",
  "developer": "Jellyfin team",
  "version": "0.2.0",
  "added": "2026-10-10",
  "category": "media",
  "icon": "tv",
  "tagline": "Your movies, on your screens.",
  "description": "A private home for your movies and shows.",
  "whatsNew": "Installs and runs on your box.",
  "arch": ["amd64", "arm64"],
  "requirements": { "memoryMB": 2048, "diskGB": 5 },
  "services": [
    {
      "name": "server",
      "image": "docker.io/jellyfin/jellyfin:10.11.6",
      "env": {},
      "mounts": [
        { "pool": "media", "path": "/media", "readOnly": true },
        { "pool": "config", "path": "/config" },
        { "pool": "cache", "path": "/cache" }
      ],
      "health": { "port": 8096, "path": "/health" }
    }
  ],
  "web": { "service": "server", "port": 8096, "host": 8096 },
  "auth": { "type": "none" },
  "backup": { "services": ["server"] }
}
```

## Executable fields

| Field | Meaning and checks |
|---|---|
| `available` | Only true entries can install. Others show Coming soon. |
| `manifest` | Executable manifests must use version 1. |
| `id` | Lowercase letter followed by lowercase letters, digits or dashes. At most 12 characters for the bridge name. |
| `version` | JenerOS package version. This is separate from each image version. |
| `arch` | `amd64` and/or `arm64`. Installation checks the box architecture. |
| `requirements` | Positive memory MB and free data disk GB; checked before creating containers. |
| `services` | One to eight services, unique names, started in listed dependency order. Each must become healthy before the next starts. |
| `image` | Fully qualified docker.io or ghcr.io image, exact numeric version (optional suffix) or SHA-256 digest. Floating tags are rejected. |
| `env` | At most 64 uppercase names. Values are strings, never shell commands. No NUL or newlines. |
| `mounts` | Named per-app folders mounted at clean absolute container paths. Host paths, traversal, symlinks and system-folder mounts are rejected. |
| `health.port` | Required TCP port, 1-65535. Without a path this checks TCP reachability. |
| `health.path` | Optional HTTP path. HTTP 2xx/3xx is ready; redirects are not followed. The target is that service's private IP. |
| `web` | Existing service and container port; `host` is the LAN port, at least 1024. 8080 and 8443 are reserved. |
| `auth.type` | `none` for now: native app account setup. OIDC/header injection is not implemented and is rejected for runnable apps. |
| `backup` | Names existing volumes/services. Metadata only; it does not schedule backups. |

Unknown JSON fields and trailing values are rejected. Existing future catalog
entries may still describe unsupported options, but the worker will not run them.
`network`, `devices` and additional `ports` are rejected for runnable manifests.
All services use unprivileged OCI containers and a private bridge per app.

## Variables

- `${service.<name>.host}` becomes the private IPv4 address of another service in
  the same app. The app subnet is retained across uninstall/reinstall.
- `${secret.<name>}` becomes a random 32-byte hex value generated once on install.
  Only the root worker stores or reads these values.
- Other variable forms are rejected. OIDC and domain variables are future work.

## App data

Despite its historical name, `mounts[].pool` identifies a **volume folder within
this app**, not a system storage pool. The install request chooses the storage
pool. On a data pool the resulting path is
`/var/lib/jeneros/pools/<pool>/Apps/<app>/<volume>`. Choosing the system disk uses
`/var/lib/jeneros/Apps/<app>/<volume>`. The API uses `@system` for the system disk
so it cannot be confused with a named data pool. Data pool names allow up to
32 characters, matching Storage.

Uninstall keeps those folders, the exact manifest, private secrets and subnet.
Reinstall uses them again. Deleting data requires a separate checkbox and typed
app ID. No automatic database upgrade or shared media mapping is implied.

## Store fields

The catalog also validates category, date, nonnegative requirements and screenshot
paths for Coming soon entries. Runnable manifests have stricter field limits.
`screenshots` contains relative PNG, JPEG or WebP paths within the app directory;
SVG is rejected. `/api/store/<id>/screenshots/<n>` serves only listed files.
Store metadata is escaped in the dashboard.

See [APP-RUNTIME.md](../[DOCS]/APP-RUNTIME.md) for the privilege split, API,
persistence, first package limits and outstanding VM checks.
