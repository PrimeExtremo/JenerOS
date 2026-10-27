# App runtime: build and VM checks

Prepared by Codex, 2026-10-10. These commands have **not** been run against a VM.
Use a disposable test VM and test photos. Do not publish this test-key image.
The Windows work was files and local fixtures only. No Go toolchain is installed
there. Claude must format, compile and test before building an image.

## 1. Build VM checks

Copy this working tree into `~/jeneros` on the existing Debian build VM, including
untracked source files under `[CORE]/internal/runtime` and `.scratch/apps`.
Do not use a clean checkout: these files have not been committed.
Run inside that VM:

```bash
cd ~/jeneros
git status --short
cd '[CORE]'
gofmt -w cmd/jenerd/main.go internal/api/api.go internal/api/apps.go internal/api/apps_test.go internal/catalog/catalog.go internal/catalog/validate.go internal/catalog/validate_test.go internal/runtime/*.go internal/storage/worker_linux.go internal/system/system.go internal/system/system_test.go
go vet ./...
go test ./...
go test -race ./internal/runtime ./internal/catalog ./internal/api
go build ./...
cd ..
node .scratch/apps/check-apps.cjs
node .scratch/setup/check-unit-ordering.cjs
node .scratch/zimaos/check-desktop.cjs
git diff --check
```

Fix any failures and bring the formatted files back to the working tree. Do not
mark Phase 1 complete based on fixtures. The fake engine tests do not establish
that OCI images start in Incus 7.0.

## 2. Image build

Use the existing test VM, preferably 12 GB RAM with at least 50 GB free space
and a spare blank data disk. The build VM and Windows VM disks stay on S:.
In the build VM:

```bash
cd ~/jeneros
RELEASE=1 TEST_SSH=1 VERSION=0.4.0-apps.1 ./\[OS\]/build.sh
```

Require a successful build and its final `Done` line. Do not install anything on
the Windows host. The prepare hook installs Incus only inside the image, verifies
Zabbly's signing-key fingerprint and checks the 7.0 series. Verify mkosi actually
runs `mkosi.prepare.chroot` and includes `/usr/lib/incus` in the usr artifact.

With the disposable VMware test VM powered off, copy the resulting VMDK into its
existing folder under `S:\[VMs]\[JENEROS-RELEASE-TEST]`. Preserve its VMX and use its
normal disk replacement procedure. Boot, complete owner setup, and use its LAN
address in a browser. Do not replace Jener's regular VM or publish these files.

## 3. Engine and boot checks

Run these in the **test VM**, using its existing test SSH connection or console:

```bash
sudo systemctl --failed
sudo systemctl status incus.service incus-startup.service incus-lxcfs.service jeneros-apps-init.service jeneros-apps-restore.service jeneros-apps.path jeneros-apps-status.timer --no-pager
sudo journalctl -b -u jeneros-apps-init -u jeneros-apps-restore -u jeneros-apps --no-pager
incus version
readlink -f /opt/incus
sudo incus storage show jeneros
sudo incus network show incusbr0
sudo cat /var/lib/jeneros/apps/incus-pool
sudo stat -c '%a %U %n' /var/lib/jeneros/apps /run/jeneros-apps/status.json
systemctl show jenerd -p DynamicUser -p SupplementaryGroups
systemctl cat incus.service
getent group incus-admin
sudo awk -F: '$1 == "root" || $1 == "0" { print FILENAME, $0 }' /etc/subuid /etc/subgid
systemd-analyze verify /usr/lib/systemd/system/jeneros-apps*.service /usr/lib/systemd/system/jeneros-apps*.path /usr/lib/systemd/system/jeneros-apps*.timer
sudo incus launch images:debian/13 runtime-smoke
sudo incus exec runtime-smoke -- cat /etc/os-release
sudo incus stop runtime-smoke
sudo incus delete runtime-smoke
```

Expected: Incus 7.0.x; `/opt/incus` resolves to `/usr/lib/incus`; no Docker daemon;
the preseed has a `dir` pool and a bridge; status is readable, private app records
are not. jenerd must not be in an Incus admin group. Inspect the rendered boot
dependency graph too: the file guard cannot find cycles in vendor units.

Fresh boot with no data pool selects `/var/lib/jeneros/.jeneros/incus`. Also test an
upgrade of an older image with a mounted, recorded data pool before its first
Incus initialization: the engine source must be `<pool>/.jeneros/incus`.
Creating a data pool later does not migrate existing engine storage. App data can
still be placed on the new pool through the Install sheet.

## 4. Owner API and Immich

Use the signed-in dashboard's browser console. This helper uses its existing
HttpOnly cookie and never copies a password or session token:

```javascript
async function appRequest(path, method = 'GET', body) {
  const r = await fetch(path, {
    method, headers: { 'X-JenerOS': '1', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  console.log(r.status, await r.json());
}
await appRequest('/api/apps');
await appRequest('/api/apps/photos/install', 'POST', {pool: '@system'});
await appRequest('/api/apps');
```

For the data-pool run, use the real pool name instead of `@system`. Prefer the UI
Install sheet for that run. Confirm progress follows checking, pulling, creating,
starting and health, and never claims success early. A second install must return
409 while one is queued. Reload/close/reopen the store during a pull.

In the test VM:

```bash
sudo incus list --project jener-photos
sudo incus network show ja-photos
sudo journalctl -u jeneros-apps -n 100 --no-pager
sudo find /var/lib/jeneros/apps -maxdepth 1 -type f -printf '%m %u %f\n'
```

Expect four unprivileged OCI containers: `db`, `redis`, `ml`, `server`. Their
volumes are in `<chosen-pool>/Apps/photos` or `/var/lib/jeneros/Apps/photos`.
Private saved records are mode 600 beneath a mode 700 directory. Do **not** paste
private records, `incus config show` output or database passwords into a report.

Open Photos from My Apps. Confirm the link uses the box LAN address and port 2283,
not a container bridge or localhost. Create an Immich account in its web UI,
**upload a real test photo**, open it full size, add it to an album, and record
the album/photo name. Check ML starts; the first model download may take time.
Verify live CPU/memory changes under use and sensible uptime. Also check an
IPv6-only LAN if available; verify the dual-stack proxy binding.

Sign out of JenerOS and test GET `/api/apps` and each mutation: expect 401 even
from loopback. After signing in, omit `X-JenerOS`: expect 403. Check malformed JSON,
unknown fields, path traversal, unknown app, `relay` (501), and unconfirmed
`{"deleteData":true}` (400). No rejected request should reach Incus.

## 5. Stop, start and reboot

Use Stop, verify all four services stop, then Start and reopen the photo.
Stop once more and reboot: the app must stay stopped. Start, reboot again:
all services must start in dependency order and the uploaded photo and account
must remain. Run `sudo reboot` only in this disposable VM.

On a data-pool install, power the disposable VM off and disconnect only its test
data disk. Boot: no app may silently write new files to the unmounted directory
on the system disk. The UI must report unavailable storage. Reattach the disk,
boot and verify the same photo. If recovering without a reboot:

```bash
sudo systemctl restart jeneros-apps-init.service
sudo systemctl restart jeneros-apps-restore.service
```

## 6. A/B update retains apps

Build a second test image in the build VM:

```bash
cd ~/jeneros
RELEASE=1 TEST_SSH=1 VERSION=0.4.0-apps.2 ./\[OS\]/build.sh
python3 -m http.server 8000 --bind 0.0.0.0 --directory "$HOME/jeneros-release/0.4.0-apps.2"
```

In the test VM, substitute the actual reachable build-VM LAN IP below. Run the
manual transfer so no public release/update URL is changed:

```bash
sudo systemd-sysupdate --transfer-source=http://BUILD_VM_IP:8000/ check-new
sudo systemd-sysupdate --transfer-source=http://BUILD_VM_IP:8000/ update
sudo reboot
```

Confirm `/usr/lib/os-release` reports `0.4.0-apps.2`, `readlink -f /opt/incus`
still points into `/usr`, and all root unit links exist in `/usr`. Open the same
Immich account and photo. Verify saved app versions stay pinned: an OS update
must not implicitly migrate an app database. Roll back the OS slot using the
existing recovery control and check the photo again. Incus database compatibility
between the tested 7.0 patch packages must be checked before shipping a rollback.

## 7. Uninstall and other apps

Uninstall Photos with the delete checkbox **off**. Containers and app bridge must
go away; photo files and root-only secrets must remain. Reinstall on the same pool;
the account, password, album and photo must still work. The saved app subnet is
reused so database host addresses in persisted Nextcloud settings also survive.
Repeat with a disposable photo and check Delete files plus the typed `photos`
confirmation. Only the Photos directory and its private record may be removed.

Install TV, Drive and Home in the UI. Complete their native setup pages. In TV,
put a test video in `<pool>/Apps/tv/media`, add `/media` as a library, and play it.
In Drive, create an account, upload/download a file, uninstall keeping data, and
reinstall. In Home, finish onboarding and add a network-address integration.
Home discovery/USB/add-ons and TV hardware acceleration are intentionally absent.
Relay and custom installs must stay Coming soon.

## 8. Failures to exercise

- Disconnect the VM network during a pull, retry after the error, and check no
  secrets appear in `/api/apps`, `/api/store` or public journal messages.
- Occupy an app's LAN port before install: show an error and preserve other apps.
- Kill the app worker during creation, then reboot. The incomplete app must be
  visible and removable; uninstall keeping data before retrying installation.
- On a disposable app only, prevent one service from becoming healthy. Verify
  an error, no success ring, and a usable Start retry after repair.
  Complete an action for a different app and verify the first app still shows
  Needs attention. After a successful retry, its error must clear.
- Pre-create a conflicting `jener-<app>` project or `ja-<app>` bridge. Install
  must fail and Uninstall must leave that foreign object alone.
- Reboot during Stop/Uninstall. Stopped apps must not restart; interrupted
  removal remains visible and can be retried.
- Check idmapped bind mounts on both the system filesystem and a Btrfs data pool.
  If unsupported, fail without adding privileged containers or world-write modes.
- Inspect package-installed defaults, sysusers, AppArmor and Incus socket paths
  on both a fresh image and an upgrade of a pre-Incus image.
  On that older-image upgrade, confirm `apps-prepare` supplies missing root
  subordinate UID/GID ranges, leaves the owner's existing ranges unchanged,
  and does not append duplicate ranges on another engine restart.
- While a long pull is running, readings for other apps must become Unavailable
  after 45 seconds without a sample, then recover when sampling resumes.
- Use a pool with a 32-character name to check install request compatibility
  with Storage. An unavailable pool must still fail without using the system disk.
- Check Cog/pixman idle CPU with the store open and during progress. No repeating
  install-ring animation is used. Check real touch, keyboard and screen reader.

Record versions, commands, results and fixes in AI-UPDATES.md. Leave milestone
boxes open until all their listed acceptance checks really pass.
