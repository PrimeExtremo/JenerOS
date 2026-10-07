<p align="center">
  <img src="%5BBRAND%5D/logo/j-monogram.svg" width="96" alt="JenerOS logo">
</p>

<h1 align="center">JenerOS</h1>

<p align="center"><b>Your stuff lives at home.</b><br>
One install turns a spare PC into your own cloud: photos, files, smart home, TV, ad blocking and virtual machines, in one system with one dashboard.</p>

> [!WARNING]
> **Early preview.** JenerOS boots, updates itself and rolls back bad updates, but most features are still coming. There is **no login yet**: anyone on your home network can open the dashboard. Don't put it on the internet and don't trust it with your only copy of anything.

## What works today

- Boots on any 64-bit PC with UEFI, and in VMware, Proxmox or VirtualBox.
- A dashboard at `http://<your-box>` with live CPU, memory, disk and network stats.
- One-click updates from this repo's Releases. Each update installs into a spare copy of the system. If the new version doesn't start properly, the box goes back to the old one by itself.
- A read-only, tamper-checked system (Debian 13, dm-verity) and a data partition that grows to fill your disk.

## Coming next

| Feature | Replaces |
|---|---|
| One-click apps: Photos, Drive, Home, TV, Relay | Immich, Nextcloud, Home Assistant, Jellyfin, Pi-hole |
| Storage pools that any Linux can still read | TrueNAS |
| Virtual machines and containers | Proxmox |
| Owner account and login | |
| `.iso` installer | |
| Raspberry Pi 5 image | |
| Router mode | pfSense, router firmware |

The full plan is in [ROADMAP.md](%5BDOCS%5D/ROADMAP.md).

## Install

You need a 64-bit PC with UEFI (most PCs from 2012 on), 4 GB of RAM and a 32 GB or larger drive. **Installing erases that drive.**

1. Download `jeneros_<version>.img.xz` from the [latest release](https://github.com/PrimeExtremo/JenerOS/releases/latest).
2. Flash it onto the drive the PC will boot from, with [balenaEtcher](https://etcher.balena.io) or [Rufus](https://rufus.ie) ("DD image" mode). Both read `.img.xz` directly. A USB SSD works too.
3. In the PC's firmware settings, turn **Secure Boot off** and boot from that drive.
4. The screen shows `Dashboard: http://192.168.x.x`. Open that address from any phone or computer on the same network.

### In a virtual machine

Unpack the image and convert it for your hypervisor:

```bash
xz -d jeneros_0.3.0.img.xz
qemu-img convert -f raw -O vmdk jeneros_0.3.0.img jeneros.vmdk     # VMware
qemu-img convert -f raw -O qcow2 jeneros_0.3.0.img jeneros.qcow2   # Proxmox / QEMU
```

Make the VM with **UEFI firmware** (Secure Boot off), 2 CPUs, 4 GB of RAM, and grow the disk to 32 GB or more before the first boot. JenerOS fills the extra space by itself.

## Updating

Open the dashboard, go to **System** and press **Update**. The box downloads the new version, restarts, and checks itself. If anything fails, it starts the previous version again.

## Build it yourself

JenerOS is built with [mkosi](https://github.com/systemd/mkosi) on Debian 13. See [BUILD-VM.md](%5BDOCS%5D/BUILD-VM.md) and the `[OS]/` folder:

```bash
./[OS]/setup-build-vm.sh                    # once: mkosi, Go, qemu-utils
RELEASE=1 VERSION=0.3.0 ./[OS]/build.sh     # image + update files in ~/jeneros-release/0.3.0
```

How it's put together: [ARCHITECTURE.md](%5BDOCS%5D/ARCHITECTURE.md), [OS-PLAN.md](%5BDOCS%5D/OS-PLAN.md), [STORAGE.md](%5BDOCS%5D/STORAGE.md).

## Repo layout

| Folder | What's in it |
|---|---|
| `[OS]/` | Image build: mkosi config, partitions, update rules, boot splash |
| `[CORE]/` | `jenerd`, the Go service behind the dashboard |
| `[DASHBOARD]/` | The web dashboard |
| `[STORE]/` | App store catalog |
| `[BRAND]/` | Logo files |
| `[DOCS]/` | Plans, research and the AI work log |

Contributors and AI agents: start with [handoff.md](handoff.md) and [AGENTS.md](AGENTS.md).

## License

JenerOS is free software under the [GNU General Public License v3.0 or later](LICENSE). It builds on Debian, systemd, mkosi and other open-source projects, each under its own license.

Made by [Jener](https://jener.dev), built together with Claude and Codex.
