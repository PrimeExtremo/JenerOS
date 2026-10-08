# App manifest (v1)

Every store app is a folder in `[STORE]/apps/<id>/` containing `app.json`.

```jsonc
{
  "manifest": 1,
  "id": "photos",                    // unique, lowercase, also the subdomain
  "name": "Photos",                  // what the user sees
  "upstream": "Immich",              // project it wraps (empty if native)
  "developer": "Immich team",        // who makes the app (store chip)
  "version": "1.0.0",                // JenerOS package version
  "added": "2026-10-07",             // YYYY-MM-DD, sorts the store's "New" list
  "category": "photos",              // media | photos | files | home | network | ai | tools
  "icon": "photos",
  "tagline": "Every photo and video, backed up from every device.",
  "description": "Photos keeps a private copy…",  // About section; blank line = new paragraph
  "whatsNew": "First JenerOS package.",           // notes for this version
  "screenshots": ["screenshots/library.webp"],    // .png/.jpg/.webp inside the app folder
  "arch": ["amd64", "arm64"],
  "requirements": { "memoryMB": 4096, "diskGB": 20 },   // store chips: min memory, disk use

  "services": [                      // each runs isolated in Incus
    {
      "name": "server",
      "image": "ghcr.io/immich-app/immich-server:release",
      "env": { "DB_HOSTNAME": "${service.db.host}" },
      "mounts": [{ "pool": "photos", "path": "/usr/src/app/upload" }]
    }
  ],

  "web": { "service": "server", "port": 2283 },   // exposed at https://photos.jener.local
  "auth": { "type": "oidc" },                     // oidc | header | none
  "backup": { "pools": ["photos"], "services": ["db"] }
}
```

## Store fields
- `developer`, `added`, `description`, `whatsNew` and `screenshots` are optional for jenerd but the shipped catalog test expects the first four.
- `id` must be lowercase letters, digits or dashes and start with a letter. Ids are unique.
- Screenshots are served at `/api/store/<id>/screenshots/<n>` (n = position in the list). Only listed files are reachable; SVG is not allowed because it could run script from the dashboard origin.

## Variables
- `${service.<name>.host}` — internal hostname of another service in the app
- `${secret.<name>}` — generated once, stored by jenerd
- `${oidc.clientId}`, `${oidc.clientSecret}`, `${oidc.issuer}` — injected when `auth.type` is `oidc`
- `${jener.domain}` — e.g. `jener.local`

## Pools
Shared folders on the storage pool, visible to every app that asks for them:
`photos`, `media`, `files`, `backups`, plus a private `data` pool per app.
