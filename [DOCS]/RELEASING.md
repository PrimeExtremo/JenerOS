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
It also requires the provisioned release signing key and enables signed-update verification.
**Never upload a build made without `RELEASE=1`**: dev builds let the build VM's key log in as root.

Output in `~/jeneros-release/<version>/`:

| File | For |
|---|---|
| `jeneros_<ver>.img.xz` | New installs (flash with balenaEtcher / Rufus) |
| `jeneros_<ver>.efi` | Update: kernel image |
| `jeneros_<ver>.usr-x86-64.<uuid>.raw.xz` | Update: system |
| `jeneros_<ver>.usr-x86-64-verity.<uuid>.raw.xz` | Update: integrity hashes |
| `SHA256SUMS` | Update index + download checks |
| `SHA256SUMS.gpg` | Detached release signature; publish beside the manifest |

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

## Provision the release key once

Run these commands interactively on the build VM as the account that runs
`build.sh`. GnuPG (`gpg` and `gpgv`) must already be available. Choose a strong
passphrase and store it separately from the VM. Builds never generate keys.

```bash
install -d -m 0700 "$HOME/.jeneros-signing"
gpg --homedir "$HOME/.jeneros-signing" --quick-generate-key 'JenerOS release signing' rsa3072 sign 2y
gpg --homedir "$HOME/.jeneros-signing" --list-secret-keys --with-fingerprint
```

Copy the full forty-character fingerprint from that listing, then run:

```bash
read -r -p 'Full release key fingerprint: ' RELEASE_FPR
printf '%s\n' "$RELEASE_FPR" > "$HOME/.jeneros-signing/signing-key"
gpg --homedir "$HOME/.jeneros-signing" --export "$RELEASE_FPR" > "$HOME/.jeneros-signing/trusted-keys.gpg"
chmod 0600 "$HOME/.jeneros-signing/signing-key" "$HOME/.jeneros-signing/trusted-keys.gpg"
```

Never commit this directory, private keys, passphrases or a copy of the signing
VM. Unlock the key through the local GnuPG agent before a build if needed; do not
put the passphrase in the build command. The build preflight signs and verifies
a small file before image creation. After all artifacts are final, it signs the
manifest and verifies it against the exact public ring embedded in the image.
Only that public ring enters the image. Missing keys, failed signatures or a
mismatched ring stop the build. Dev builds explicitly select Verify=no.

Debian 13's [sysupdate.d documentation](https://manpages.debian.org/trixie/systemd-container/sysupdate.d.5.en.html)
specifies `/usr/lib/systemd/import-pubring.gpg` (or the administrator override
`/etc/systemd/import-pubring.gpg`) and a detached `SHA256SUMS.gpg`. The build uses
the `.gpg` path, not `.pgp`. Check for stale `/etc` transfer files/keyrings on
upgraded systems: they can override the shipped `/usr` settings.

## Back up and rotate keys

Keep an encrypted offline backup of the entire signing directory, its revocation
certificate and the passphrase recovery record in separate secure locations.
Test restoring into a private directory on an offline machine and verify a saved
release signature. Keep backups outside the repo, image staging and release output.

For routine rotation, generate a second key in the same private directory. Export
both public keys to `trusted-keys.gpg`. Keep `signing-key` pointing at the old key
and publish a bridge release signed by the old key. Verify an old installation
updates to it. Only then switch the signing fingerprint to the new key and publish
the next release. Keep the bridge release available through a documented staged
upgrade: boxes that skipped it cannot trust the new key from `latest` alone.
Remove the old public key in a later release after that migration. A revoked or
compromised key requires an independently trusted recovery/install path; never
tell users to bypass Verify to recover from a signature error.

## First signed release and validation

Versions up to 0.4.2 used unsigned manifests. Updating one to the first signed
image cannot retroactively authenticate that initial hop. Verify its artifacts
and signing fingerprint through an independent trusted channel or install a
verified fresh image. Thereafter, verify a signed A/B update and rejection of a
modified manifest, missing signature and wrong signing key before publishing.
Also check boot recovery, setup, phone HTTPS and storage with the new sandboxes.
Do not publish TEST_SSH or BROKEN builds.

For manual artifact verification, use an independently obtained public keyring:

```bash
gpgv --keyring /path/to/trusted-keys.gpg SHA256SUMS.gpg SHA256SUMS
sha256sum --check SHA256SUMS
```

A signature authenticates the release files. It does not provide Secure Boot,
protect a stolen signing key, or prevent a server from withholding newer releases.
