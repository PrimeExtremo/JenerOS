# Build VM setup (one time)

The JenerOS image is built inside a Debian 13 VM in VMware Workstation, reached from Windows over SSH.
(WSL was dropped: it needs the Windows hypervisor, which slows VMware.)

| | |
|---|---|
| VM folder | `S:\[VMs]\[JENEROS-BUILD]` (`jeneros-build.vmx`, 80 GB growable disk) |
| Specs | 4 vCPU, 8 GB RAM, UEFI, LSI Logic disk, NAT (vmxnet3) |
| Installer | `S:\[ISOs]\debian-13.7.0-amd64-netinst.iso` (sha256 `a7ef94ac…e355`, verified 2026-10-07) |
| Build SSH key | `C:\Users\jener\.ssh\jeneros_build` (public copy: `S:\[VMs]\[JENEROS-BUILD]\build-key.pub`) |
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

## Add the build SSH key (Jener, in normal PowerShell on Windows)

Replace `USER` and `IP`. You'll type your Linux password twice (once for SSH, once for sudo):

```powershell
Get-Content -LiteralPath 'S:\[VMs]\[JENEROS-BUILD]\build-key.pub' | ssh USER@IP "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```
```powershell
ssh -t USER@IP "echo 'USER ALL=(ALL) NOPASSWD:ALL' | sudo tee /etc/sudoers.d/90-jeneros-build"
```

The second command lets the build scripts install packages without asking for a password (this VM only builds JenerOS).

(Windows PowerShell 5.1 strips inner double quotes — keep the single quotes inside.)

Then add a `jeneros-build` SSH alias with that username and IP.

## Current values (2026-10-07)

| | |
|---|---|
| User | `jener` |
| IP | `192.168.27.132` (VMware NAT DHCP; check `C:\ProgramData\VMware\vmnetdhcp.leases` if it changes) |
| Sync repo → VM | `./[OS]/sync-to-vm.sh` (from Git Bash on Windows) |
| Build | `ssh jeneros-build 'cd ~/jeneros && ./[OS]/build.sh'` |

## Test first-boot setup with a phone

On the **JenerOS test VM**, open VMware's **VM settings > Network Adapter**
and choose **Bridged**, with **Connected** and **Connect at power on** checked.
Bridge to the PC's active home-network adapter if Automatic picks the wrong one.
The build VM can keep using NAT.

VMware NAT addresses (such as `192.168.27.137`) are unreachable from phones.
mDNS cannot make NAT reachable. Bridged gives the test box an address on your
home LAN. Put the phone on the same Wi-Fi/network, avoiding guest isolation.
Scan the IP QR, then also try `http://jeneros.local` (or the box's chosen name).
If no address appears, connect the VM's adapter and check the router's DHCP.
