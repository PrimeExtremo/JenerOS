# Releasing JenerOS

Public repo: https://github.com/PrimeExtremo/JenerOS (GPL-3.0-or-later).
Installed systems download updates from `https://github.com/PrimeExtremo/JenerOS/releases/latest/download/`,
so **every release must carry the update files below, and the newest release must be marked "latest".**

## Build (in the build VM)

```bash
./[OS]/sync-to-vm.sh                                   # from Windows Git Bash
ssh jeneros-build 'cd ~/jeneros && RELEASE=1 VERSION=0.3.1 ./[OS]/build.sh'
```

`RELEASE=1` means: no dev SSH key, no console autologin, update URL = GitHub Releases.
**Never upload a build made without `RELEASE=1`**: dev builds let the build VM's key log in as root.

Output in `~/jeneros-release/<version>/`:

| File | For |
|---|---|
| `jeneros_<ver>.img.xz` | New installs (flash with balenaEtcher / Rufus) |
| `jeneros_<ver>.efi` | Update: kernel image |
| `jeneros_<ver>.usr-x86-64.<uuid>.raw.xz` | Update: system |
| `jeneros_<ver>.usr-x86-64-verity.<uuid>.raw.xz` | Update: integrity hashes |
| `SHA256SUMS` | Update index + download checks |

Every file must stay under GitHub's 2 GiB per-file limit (the usr image is ~170 MB compressed).

## Test before publishing

1. Boot the `.img.xz` in a fresh VM (UEFI, no Secure Boot): dashboard answers, no autologin, no root SSH.
2. Update an existing install to it and confirm `systemd-bless-boot status` = `good`.

## Publish (Windows, `gh` logged in as PrimeExtremo)

```bash
scp -r jeneros-build:jeneros-release/0.3.1 /tmp/rel
gh release create v0.3.1 /tmp/rel/* --repo PrimeExtremo/JenerOS --title "JenerOS 0.3.1" --notes-file notes.md --latest
```

Mark early versions `--prerelease` only if you don't want installed boxes to get them: `releases/latest` skips prereleases.

## Known limits (preview)

Updates are not signed yet (`Verify=no`; HTTPS only). Sign `SHA256SUMS` with GPG and turn `Verify=yes` on before calling anything stable.
