#!/usr/bin/env bash
# Builds the JenerOS disk image and a VMware disk next to it.
#   ./[OS]/build.sh                 build image + VMware disk
#   VM_DIR=/some/path ./[OS]/build.sh   where the VMware disk goes (default: ~/jeneros-out)
# Runs inside the Debian build VM. Copy the result to Windows with [OS]/fetch-vm.ps1.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OS="$ROOT/[OS]"
STAGE="$OS/build/staging"
VM_DIR="${VM_DIR:-$HOME/jeneros-out}"
VERSION="$(sed -n 's/^ImageVersion=//p' "$OS/mkosi.conf")"

echo "==> jenerd"
rm -rf "$STAGE"
mkdir -p "$STAGE/usr/bin" "$STAGE/usr/share/jeneros"
(cd "$ROOT/[CORE]" && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -o "$STAGE/usr/bin/jenerd" ./cmd/jenerd)

echo "==> dashboard + store"
rsync -a --delete "$ROOT/[DASHBOARD]/" "$STAGE/usr/share/jeneros/dashboard/"
mkdir -p "$STAGE/usr/share/jeneros/store"
rsync -a --delete "$ROOT/[STORE]/apps/" "$STAGE/usr/share/jeneros/store/apps/"

echo "==> image"
(cd "$OS" && mkosi -f build)
RAW="$OS/out/jeneros_${VERSION}.raw"

echo "==> VMware disk -> $VM_DIR"
mkdir -p "$VM_DIR"
# vmdk can't be resized, so grow a sparse raw copy first, then convert.
TMP="$VM_DIR/jeneros.tmp.raw"
cp --sparse=always "$RAW" "$TMP"
qemu-img resize -f raw "$TMP" 32G
qemu-img convert -f raw -O vmdk -o subformat=monolithicSparse "$TMP" "$VM_DIR/jeneros.vmdk"
rm -f "$TMP"
[ -f "$VM_DIR/jeneros.vmx" ] || cp "$OS/vmware/jeneros.vmx" "$VM_DIR/jeneros.vmx"

echo "Done: $VM_DIR/jeneros.vmdk (run [OS]/fetch-vm.ps1 on Windows to copy it to S:\[VMs]\[JENEROS])"
