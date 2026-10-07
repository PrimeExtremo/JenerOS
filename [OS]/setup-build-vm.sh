#!/usr/bin/env bash
# One-time setup of the build machine: the Debian 13 build VM in VMware (S:\[VMs]\[JENEROS-BUILD]),
# or any Debian/Ubuntu box. Needs passwordless sudo for the build user.
set -euo pipefail

sudo apt-get update
sudo apt-get install -y mkosi golang-go qemu-utils rsync curl librsvg2-bin
echo "Ready. Build with: ./[OS]/build.sh"
