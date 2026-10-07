# Build VM setup (one time)

The JenerOS image is built inside a Debian 13 VM in VMware Workstation, reached from Windows over SSH.
(WSL was dropped: it needs the Windows hypervisor, which slows VMware.)

| | |
|---|---|
| VM folder | `S:\[VMs]\[JENEROS-BUILD]` (`jeneros-build.vmx`, 80 GB growable disk) |
| Specs | 4 vCPU, 8 GB RAM, UEFI, LSI Logic disk, NAT (vmxnet3) |
| Installer | `S:\[ISOs]\debian-13.7.0-amd64-netinst.iso` (sha256 `a7ef94ac…e355`, verified 2026-10-07) |
| SSH key for Claude | `C:\Users\jener\.ssh\jeneros_build` (public copy: `S:\[VMs]\[JENEROS-BUILD]\claude-key.pub`) |
| SSH alias | `jeneros-build` in `C:\Users\jener\.ssh\config` |

## Install (Jener)

1. VMware Workstation → File → Open → `S:\[VMs]\[JENEROS-BUILD]\jeneros-build.vmx` → Power on.
2. Debian menu: **Install** (the text one).
3. Language / location / keyboard: your choice.
4. Hostname: `jeneros-build`. Domain: leave empty.
5. **Root password: leave EMPTY** (press Enter twice). This makes your user an admin through `sudo`.
6. Your full name, username, password: your choice. Keep the password to yourself.
7. Partitioning: **Guided – use entire disk** → the only disk → **All files in one partition** → Finish → Yes.
8. Package mirror: your country → `deb.debian.org` → no proxy.
9. Software selection: **untick** "Debian desktop environment" and "GNOME". **Tick** "SSH server" and "standard system utilities".
10. Finish → Continue. If the installer menu comes back after reboot: VM → Removable Devices → CD/DVD → Disconnect, then restart the VM.
11. Log in on the VM console and run `ip -br a` — note the `192.168.x.x` address.

## Give Claude access (Jener, in normal PowerShell on Windows)

Replace `USER` and `IP`. You'll type your Linux password twice (once for SSH, once for sudo):

```powershell
Get-Content -LiteralPath 'S:\[VMs]\[JENEROS-BUILD]\claude-key.pub' | ssh USER@IP "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```
```powershell
ssh -t USER@IP "echo 'USER ALL=(ALL) NOPASSWD:ALL' | sudo tee /etc/sudoers.d/90-jeneros-build"
```

The second command lets the build scripts install packages without asking for a password (this VM only builds JenerOS).

(Windows PowerShell 5.1 strips inner double quotes — keep the single quotes inside.)

Then tell Claude the username and IP (not the password). Claude adds the `jeneros-build` SSH alias and takes over.

## Current values (2026-10-07)

| | |
|---|---|
| User | `jener` |
| IP | `192.168.27.132` (VMware NAT DHCP; check `C:\ProgramData\VMware\vmnetdhcp.leases` if it changes) |
| Sync repo → VM | `./[OS]/sync-to-vm.sh` (from Git Bash on Windows) |
| Build | `ssh jeneros-build 'cd ~/jeneros && ./[OS]/build.sh'` |
