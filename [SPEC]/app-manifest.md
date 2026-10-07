# App manifest (v1)

Every store app is a folder in `[STORE]/apps/<id>/` containing `app.json`.

```jsonc
{
  "manifest": 1,
  "id": "photos",                    // unique, lowercase, also the subdomain
  "name": "Photos",                  // what the user sees
  "upstream": "Immich",              // project it wraps (empty if native)
  "version": "1.0.0",                // JenerOS package version
  "category": "media",               // media | files | home | network | tools | dev
  "icon": "photos",
  "tagline": "Every photo and video, backed up from every device.",
  "arch": ["amd64", "arm64"],
  "requirements": { "memoryMB": 4096, "diskGB": 20 },

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

## Variables
- `${service.<name>.host}` — internal hostname of another service in the app
- `${secret.<name>}` — generated once, stored by jenerd
- `${oidc.clientId}`, `${oidc.clientSecret}`, `${oidc.issuer}` — injected when `auth.type` is `oidc`
- `${jener.domain}` — e.g. `jener.local`

## Pools
Shared folders on the storage pool, visible to every app that asks for them:
`photos`, `media`, `files`, `backups`, plus a private `data` pool per app.
