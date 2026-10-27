#!/usr/bin/env bash
# Builds a JenerOS version: disk image, VMware disk, and update files.
#   ./[OS]/build.sh                       build the version in mkosi.conf
#   VERSION=0.1.1 ./[OS]/build.sh         build a specific version
#   VERSION=0.1.2 BROKEN=1 ./[OS]/build.sh   deliberately broken (jenerd won't start) to test rollback
#   NO_VMDK=1 ./[OS]/build.sh             skip the VMware disk (update-only builds)
#   RELEASE=1 TEST_SSH=1 ...              release image + build VM's root key, for VM tests only
#   RELEASE=1 VERSION=0.3.0 ./[OS]/build.sh   public release: no dev SSH key, no console
#                                         autologin, updates from GitHub Releases, plus a
#                                         flashable jeneros_<ver>.img.xz in ~/jeneros-release/<ver>
# Env: VM_DIR (VMware disk, default ~/jeneros-out), UPDATES_DIR (update server
# folder, default ~/jeneros-updates), UPDATE_URL (what installed systems download from).
# Runs inside the Debian build VM. Copy the VMware disk to Windows with [OS]/fetch-vm.ps1.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OS="$ROOT/[OS]"
# New hooks copied from Windows must be executable for mkosi to run them.
chmod 0755 "$OS/mkosi.prepare.chroot" "$OS/mkosi.postinst.chroot"
STAGE="$OS/build/staging"
VM_DIR="${VM_DIR:-$HOME/jeneros-out}"
VERSION="${VERSION:-$(sed -n 's/^ImageVersion=//p' "$OS/mkosi.conf")}"
if [[ ! "$VERSION" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then
    echo 'VERSION must use letters, numbers, dots, underscores or dashes.' >&2
    exit 1
fi
BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
if [ -n "${SOURCE_DATE_EPOCH:-}" ]; then
    BUILD_DATE=$(date -u -d "@$SOURCE_DATE_EPOCH" +%Y-%m-%dT%H:%M:%SZ)
fi
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
# Signing is deliberately provisioned by the maintainer, never by a build.
# Missing keys must stop a release instead of silently creating a new identity.
VERIFY=no
if [ "${RELEASE:-}" = 1 ]; then
    VERIFY=yes
    SIGNING_HOME="$HOME/.jeneros-signing"
    SIGNING_KEY=$(cat "$SIGNING_HOME/signing-key")
    if [[ ! "$SIGNING_KEY" =~ ^[A-Fa-f0-9]{40}$ ]]; then
        echo 'Expected a full release key fingerprint in ~/.jeneros-signing/signing-key.' >&2
        exit 1
    fi
    gpg --homedir "$SIGNING_HOME" --batch --list-secret-keys "$SIGNING_KEY" >/dev/null
    [ -s "$SIGNING_HOME/trusted-keys.gpg" ] || { echo 'Missing release trust keyring.' >&2; exit 1; }
fi

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
BUILD_DATE="$BUILD_DATE"
HOME_URL="https://jener.dev/os"
EOF
sed "s/@VERSION@/$VERSION/g" "$OS/mkosi.extra/usr/lib/issue" > "$STAGE/usr/lib/issue"
for f in "$OS"/sysupdate.d/*.transfer; do
    sed -e "s#@UPDATE_URL@#$UPDATE_URL#" -e "s/^Verify=yes$/Verify=$VERIFY/" "$f" > "$STAGE/usr/lib/sysupdate.d/$(basename "$f")"
done
if [ "$VERIFY" = yes ]; then
    install -Dm0644 "$SIGNING_HOME/trusted-keys.gpg" "$STAGE/usr/lib/systemd/import-pubring.gpg"
    # Preflight both the secret key and the exact public keyring being shipped.
    printf 'JenerOS signing preflight\n' > "$STAGE/signing-check"
    gpg --homedir "$SIGNING_HOME" --batch --yes --local-user "$SIGNING_KEY" --digest-algo SHA256 --detach-sign --output "$STAGE/signing-check.gpg" "$STAGE/signing-check"
    gpgv --homedir "$SIGNING_HOME" --keyring "$STAGE/usr/lib/systemd/import-pubring.gpg" "$STAGE/signing-check.gpg" "$STAGE/signing-check"
    rm "$STAGE/signing-check" "$STAGE/signing-check.gpg"
fi

SPLASH="$ROOT/[BRAND]/logo/splash-512.svg"
if [ -f "$SPLASH" ]; then
    echo "==> boot splash logo"
    mkdir -p "$STAGE/usr/share/plymouth/themes/jeneros"
    rsvg-convert -w 256 -h 256 "$SPLASH" -o "$STAGE/usr/share/plymouth/themes/jeneros/watermark.png"
fi

if [ "${RELEASE:-}" != 1 ]; then
    # This marker skips first-boot setup even when there is no dev SSH key.
    # postinst masks the kiosk in /usr so mkosi's dev tty1 autologin still works.
    mkdir -p "$STAGE/usr/lib/tmpfiles.d"
    printf 'd /var/lib/jeneros 0755 root root -\nf /var/lib/jeneros/setup-done 0600 root root -\n' \
        > "$STAGE/usr/lib/tmpfiles.d/jeneros-dev-setup.conf"
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

if [ "${RELEASE:-}" = 1 ] && [ "${TEST_SSH:-}" = 1 ]; then
    # Release-like test image that the build VM's key can still log into, for
    # debugging first boot in a VM. NEVER publish a TEST_SSH build.
    echo "==> TEST_SSH: root SSH key included (do not publish this build)"
    mkdir -p "$STAGE/usr/share/jeneros/dev" "$STAGE/usr/lib/tmpfiles.d"
    cp "$HOME/.ssh/authorized_keys" "$STAGE/usr/share/jeneros/dev/authorized_keys"
    printf 'd /root/.ssh 0700 root root -\nC /root/.ssh/authorized_keys 0600 root root - /usr/share/jeneros/dev/authorized_keys\n' \
        > "$STAGE/usr/lib/tmpfiles.d/jeneros-dev-ssh.conf"
fi

if [ -f "$STAGE/usr/share/jeneros/dev/authorized_keys" ]; then
    # Test-only root access remains key-only. The public image never includes it.
    mkdir -p "$STAGE/usr/lib/jeneros"
    sed 's/^PermitRootLogin no$/PermitRootLogin prohibit-password/' \
        "$OS/mkosi.extra/usr/lib/jeneros/sshd_config" > "$STAGE/usr/lib/jeneros/sshd_config"
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
if [ "$VERIFY" = yes ]; then
    gpg --homedir "$SIGNING_HOME" --batch --yes --local-user "$SIGNING_KEY" --digest-algo SHA256 \
        --detach-sign --output "$UPDATES_DIR/SHA256SUMS.gpg" "$UPDATES_DIR/SHA256SUMS"
    gpgv --homedir "$SIGNING_HOME" --keyring "$STAGE/usr/lib/systemd/import-pubring.gpg" \
        "$UPDATES_DIR/SHA256SUMS.gpg" "$UPDATES_DIR/SHA256SUMS"
else
    rm -f "$UPDATES_DIR/SHA256SUMS.gpg"
fi

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
