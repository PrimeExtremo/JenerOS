# Apps on JenerOS

The first runtime supports Photos (Immich), TV (Jellyfin), Drive (Nextcloud) and
Home (Home Assistant). Other catalog entries and custom installs stay Coming soon.
These are initial pinned packages, not a claim that VM acceptance has passed.
Each app currently has its own account setup. JenerOS SSO is future work.

## How work reaches Incus

1. The owner API checks the session and `X-JenerOS: 1` header.
2. It validates the request and catalog entry, then atomically publishes one
   `/run/jeneros/apps.request`. There can be only one pending change.
3. `jeneros-apps.path` starts a root worker. It holds a root-owned lock, rereads
   the shipped manifest, validates it, and talks to Incus over its Unix socket.
4. The worker creates a project and bridge per app, pulls OCI images and creates
   unprivileged containers. Dependency order is the manifest service order.
5. Start waits for each service's declared health check. Progress stages and
   measured state are written atomically to `/run/jeneros-apps/status.json`.

jenerd remains a DynamicUser. It cannot open the Incus admin socket or read
generated secrets. Root calls use fixed programs/argv for initialization and
structured JSON for the Incus API. Engine errors are sanitized because they may
contain environment values. There is no shell command field or Docker daemon.

## Persistent files

| Path | Contents |
|---|---|
| `/usr/lib/incus` | Zabbly's Incus binaries, inside the A/B system image |
| `/opt/incus` | Boot-created link to `/usr/lib/incus` for vendor wrappers |
| `/usr/lib/jeneros/incus-preseed.json` | Initial engine pool, bridge and default profile |
| `/var/lib/incus` | Incus database and runtime state |
| `/var/lib/jeneros/apps/<id>.json` | Root-only manifest, secrets, chosen pool, subnet and install state |
| `/var/lib/jeneros/pools/<pool>/Apps/<app>/<volume>` | App files on the selected data pool |
| `/var/lib/jeneros/Apps/<app>/<volume>` | Explicit system-disk fallback |
| `<initial-pool>/.jeneros/incus` | Engine image/root storage using the `dir` driver |

Initialization selects the first ready mounted data pool, otherwise the system
disk when no pool records exist. It saves that choice and refuses an unavailable
recorded pool. It does not migrate the engine when a data pool is added later.
Each install can choose a different data pool for its app files.
The API uses `@system` for the system disk; a data pool named `system` stays
distinct. Pool names support the same 32-character limit as Storage.

An Incus service drop-in runs `jenerd apps-prepare` before the engine starts.
It preserves usable root subordinate UID/GID ranges and allocates missing ranges
after existing entries using `usermod`. This also covers updates from an older
image, where the package's image-build setup did not run on the live box.

App records are mode 600 in a mode 700 directory. Public status contains no env
values or secrets. Containers receive generated secrets through their private
Incus configuration. Protect root access and backups of the Incus database too.

## API

| Method and route | Result |
|---|---|
| `GET /api/store` | Catalog, install availability, state and measured runtime details |
| `GET /api/apps` | Installed/retained records, availability, sample time and current job progress |
| `POST /api/apps/<id>/install` | Queue install; optional `{"pool":"family"}` |
| `POST /api/apps/<id>/start` | Start services and check health |
| `POST /api/apps/<id>/stop` | Save stopped intent and stop in reverse service order |
| `DELETE /api/apps/<id>` | Uninstall, keeping files and secrets by default |

Mutations return 202 with a job ID; the browser polls progress. `pulling`,
`creating`, `starting` and `health` reflect worker steps, not invented download
byte percentages. Another queued change returns 409. Unsupported apps return 501.
Deleting data requires `{"deleteData":true,"confirm":"<id>"}`. Unknown fields,
invalid names and unconfirmed deletions are rejected.

Uninstall removes only objects successfully created by this worker. A failed
installation is not automatically retried or adopted. Uninstall it keeping data
before retrying. Retained data uses the saved manifest, password and network
subnet on reinstall; this prevents an unrequested database upgrade.

The root timer samples running services every ten seconds when no worker holds
the lock. CPU is the delta in CPU nanoseconds divided by elapsed sample time;
100% means one full core. Memory sums service usage; uptime uses the youngest
running service. Samples older than 45 seconds become Unavailable, even while
another app is downloading. Health failures stay in each app's private record
until a successful start or stop clears them. A reboot restore unit checks
storage and starts saved apps in order; stopped apps remain stopped. Container
autostart is disabled so Incus cannot bypass the storage check.

## Initial limits

- Health checks are HTTP status 2xx/3xx or TCP reachability. Database TCP checks
  establish a listener, not database integrity. Apps can still be awaiting first
  account setup when their HTTP endpoint is ready.
- Home uses a private bridge. USB devices, multicast discovery and add-ons are
  not exposed. TV uses software playback; hardware acceleration is not enabled.
- Backup declarations are metadata only. There is no automatic app backup or
  app update flow yet. App data is private per app, not a shared Photos/Media folder.
- Networks are separate bridges with NAT. This is not a firewall policy that
  prevents apps from reaching the home LAN or host.
- Root metadata and data folders must be backed up together. Incus root disks
  are disposable; listed app volumes survive ordinary uninstall and OS updates.
- Live image pulls, bind-mount ownership, real application setup, boot and A/B
  behavior must pass the [VM checklist](../.scratch/apps/VM-CHECKS.md).

## Sources checked for this implementation

- [Zabbly 7.0 LTS packaging](https://github.com/zabbly/incus/tree/lts-7.0) and
  [package payload layout](https://github.com/zabbly/incus/blob/lts-7.0/debian/rules).
- [Zabbly subordinate-ID setup](https://github.com/zabbly/incus/blob/stable/debian/incus-base.postinst)
  and [Incus state readings](https://github.com/lxc/incus/blob/main/shared/api/instance_state.go).
- [Incus instance options](https://linuxcontainers.org/incus/docs/main/reference/instance_options/),
  [disk mounts](https://linuxcontainers.org/incus/docs/main/reference/devices_disk/) and
  [image API types](https://github.com/lxc/incus/blob/main/shared/api/image.go).
- [Immich v2.5.6 deployment](https://github.com/immich-app/immich/blob/v2.5.6/docker/docker-compose.yml).
- [Jellyfin containers](https://jellyfin.org/docs/general/installation/container/),
  [Nextcloud image configuration](https://github.com/nextcloud/docker) and
  [Home Assistant containers](https://www.home-assistant.io/installation/linux).
