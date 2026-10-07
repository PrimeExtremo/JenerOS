#!/usr/bin/env bash
# Builds a JenerOS version: disk image, VMware disk, and update files.
#   ./[OS]/build.sh                       build the version in mkosi.conf
#   VERSION=0.1.1 ./[OS]/build.sh         build a specific version
#   VERSION=0.1.2 BROKEN=1 ./[OS]/build.sh   deliberately broken (jenerd won't start) to test rollback
#   NO_VMDK=1 ./[OS]/build.sh             skip the VMware disk (update-only builds)
#   RELEASE=1 VERSION=0.3.0 ./[OS]/build.sh   public release: no dev SSH key, no console
#                                         autologin, updates from GitHub Releases, plus a
#                                         flashable jeneros_<ver>.img.xz in ~/jeneros-release/<ver>
# Env: VM_DIR (VMware disk, default ~/jeneros-out), UPDATES_DIR (update server
# folder, default ~/jeneros-updates), UPDATE_URL (what installed systems download from).
# Runs inside the Debian build VM. Copy the VMware disk to Windows with [OS]/fetch-vm.ps1.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OS="$ROOT/[OS]"
STAGE="$OS/build/staging"
VM_DIR="${VM_DIR:-$HOME/jeneros-out}"
VERSION="${VERSION:-$(sed -n 's/^ImageVersion=//p' "$OS/mkosi.conf")}"
if [ "${RELEASE:-}" = 1 ]; then
    UPDATES_DIR="${UPDATES_DIR:-$HOME/jeneros-release/$VERSION}"
    UPDATE_URL="${UPDATE_URL:-https://github.com/PrimeExtremo/JenerOS/releases/latest/download/}"
    MKOSI_EXTRA="--autologin=no"
else
    UPDATES_DIR="${UPDATES_DIR:-$HOME/jeneros-updates}"
    UPDATE_URL="${UPDATE_URL:-http://192.168.27.132:8000/}"
    MKOSI_EXTRA=""
fi
OUT="$OS/out"

echo "==> JenerOS $VERSION"
rm -rf "$STAGE"
mkdir -p "$STAGE/usr/bin" "$STAGE/usr/share/jeneros" "$STAGE/usr/lib/sysupdate.d"

echo "==> jenerd"
(cd "$ROOT/[CORE]" && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -o "$STAGE/usr/bin/jenerd" ./cmd/jenerd)

echo "==> dashboard + store"
rsync -a --delete "$ROOT/[DASHBOARD]/" "$STAGE/usr/share/jeneros/dashboard/"
mkdir -p "$STAGE/usr/share/jeneros/store"
rsync -a --delete "$ROOT/[STORE]/apps/" "$STAGE/usr/share/jeneros/store/apps/"

echo "==> os-release + update sources ($UPDATE_URL)"
cat > "$STAGE/usr/lib/os-release" <<EOF
NAME="JenerOS"
PRETTY_NAME="JenerOS $VERSION"
ID=jeneros
ID_LIKE=debian
VERSION="$VERSION"
VERSION_ID=$VERSION
VERSION_CODENAME=trixie
IMAGE_ID=jeneros
IMAGE_VERSION=$VERSION
HOME_URL="https://jener.dev/os"
EOF
for f in "$OS"/sysupdate.d/*.transfer; do
    sed "s#@UPDATE_URL@#$UPDATE_URL#" "$f" > "$STAGE/usr/lib/sysupdate.d/$(basename "$f")"
done

SPLASH="$ROOT/[BRAND]/logo/splash-512.svg"
if [ -f "$SPLASH" ]; then
    echo "==> boot splash logo"
    mkdir -p "$STAGE/usr/share/plymouth/themes/jeneros"
    rsvg-convert -w 256 -h 256 "$SPLASH" -o "$STAGE/usr/share/plymouth/themes/jeneros/watermark.png"
fi

if [ "${RELEASE:-}" != 1 ]; then
    # Dev builds: let the build VM's key log in as root so AIs can debug the test VM.
    KEY="${DEV_SSH_KEY:-$HOME/.ssh/authorized_keys}"
    if [ -f "$KEY" ]; then
        echo "==> dev build: root SSH key from $KEY"
        mkdir -p "$STAGE/usr/share/jeneros/dev"
        cp "$KEY" "$STAGE/usr/share/jeneros/dev/authorized_keys"
        mkdir -p "$STAGE/usr/lib/tmpfiles.d"
        printf 'd /root/.ssh 0700 root root -\nC /root/.ssh/authorized_keys 0600 root root - /usr/share/jeneros/dev/authorized_keys\n' \
            > "$STAGE/usr/lib/tmpfiles.d/jeneros-dev-ssh.conf"
    fi
fi

if [ "${BROKEN:-}" = 1 ]; then
    echo "==> BROKEN build: jenerd will fail to start (rollback test)"
    mkdir -p "$STAGE/usr/lib/systemd/system/jenerd.service.d"
    printf '[Service]\nExecStart=\nExecStart=/bin/false\n' > "$STAGE/usr/lib/systemd/system/jenerd.service.d/broken.conf"
fi

echo "==> image"
# shellcheck disable=SC2086
(cd "$OS" && mkosi -f --image-version="$VERSION" $MKOSI_EXTRA build)
RAW="$OUT/jeneros_${VERSION}.raw"

echo "==> update files -> $UPDATES_DIR"
mkdir -p "$UPDATES_DIR"
cp "$OUT/jeneros_${VERSION}.efi" "$UPDATES_DIR/"
# usr images are 2 GiB raw (over GitHub's per-file limit); sysupdate unpacks .xz itself.
for f in "$OUT"/jeneros_"${VERSION}".usr-x86-64*.raw; do
    xz -T0 -6 -c "$f" > "$UPDATES_DIR/$(basename "$f").xz"
done
if [ "${RELEASE:-}" = 1 ]; then
    echo "==> flashable disk image"
    xz -T0 -6 -c "$RAW" > "$UPDATES_DIR/jeneros_${VERSION}.img.xz"
fi
(cd "$UPDATES_DIR" && sha256sum jeneros_* > SHA256SUMS)

if [ "${NO_VMDK:-}" != 1 ]; then
    echo "==> VMware disk -> $VM_DIR"
    mkdir -p "$VM_DIR"
    # vmdk can't be resized, so grow a sparse raw copy first, then convert.
    TMP="$VM_DIR/jeneros.tmp.raw"
    cp --sparse=always "$RAW" "$TMP"
    qemu-img resize -f raw "$TMP" 32G
    qemu-img convert -f raw -O vmdk -o subformat=monolithicSparse "$TMP" "$VM_DIR/jeneros.vmdk"
    rm -f "$TMP"
    [ -f "$VM_DIR/jeneros.vmx" ] || cp "$OS/vmware/jeneros.vmx" "$VM_DIR/jeneros.vmx"
fi

echo "Done: JenerOS $VERSION"
