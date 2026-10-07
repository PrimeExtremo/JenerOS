#!/bin/bash
# Local checks; mocks avoid needing the JenerOS VM or modifying /etc.
set -eu
hello='[OS]/mkosi.extra/usr/lib/jeneros/hello'
profile='[OS]/mkosi.extra/usr/lib/jeneros/hello-profile.sh'
fixtures='.scratch/hello'
mkdir -p "$fixtures/proc"
printf 'IMAGE_VERSION="0.9.1"\n' > "$fixtures/os-release"
printf '183840.99 0\n' > "$fixtures/proc/uptime"
printf 'MemTotal: 8388608 kB\nMemAvailable: 3145728 kB\n' > "$fixtures/proc/meminfo"
export JENEROS_OS_RELEASE="$fixtures/os-release"
export JENEROS_PROC_ROOT="$fixtures/proc"
export JENEROS_UPDATE_AVAILABLE="$fixtures/available.json"
ip() { printf '1: lo inet 127.0.0.1/8 scope host lo\n2: eth0 inet 192.168.1.42/24 scope global eth0\n3: eth1 inet 10.0.0.2/24 scope global eth1\n'; }
df() { printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/sda 33554432 8388608 25165824 25%% /\n'; }
date() { printf '%s\n' "${TEST_DAY:-08}"; }
run_plain() { ( TERM=dumb; . "$hello" ) > "$fixtures/plain.txt"; }
printf '{"version":"0.9.2","rolledBack":""}\n' > "$JENEROS_UPDATE_AVAILABLE"
run_plain
grep -q 'JenerOS 0.9.1' "$fixtures/plain.txt"
grep -q 'Dashboard  http://192.168.1.42' "$fixtures/plain.txt"
grep -q 'Uptime     2d 3h 4m' "$fixtures/plain.txt"
grep -q 'Memory     5.0 / 8.0 GiB' "$fixtures/plain.txt"
grep -q 'Disk /     8.0 / 32.0 GiB' "$fixtures/plain.txt"
grep -q '0.9.2 is ready' "$fixtures/plain.txt"
! grep -q $'\033' "$fixtures/plain.txt"
printf '{"version":"","rolledBack":"0.9.2"}\n' > "$JENEROS_UPDATE_AVAILABLE"
run_plain
grep -q "0.9.2 rolled back; you're on 0.9.1" "$fixtures/plain.txt"
printf '{"error":"server unavailable"}\n' > "$JENEROS_UPDATE_AVAILABLE"
run_plain
grep -q "Can't reach the update server" "$fixtures/plain.txt"
printf '{\n  "version": "",\n  "rolledBack": ""\n}\n' > "$JENEROS_UPDATE_AVAILABLE"
run_plain
grep -q 'All up to date!' "$fixtures/plain.txt"
printf 'broken json\n' > "$JENEROS_UPDATE_AVAILABLE"
run_plain
grep -q 'Waiting for the first check' "$fixtures/plain.txt"
JENEROS_UPDATE_AVAILABLE="$fixtures/missing" run_plain
grep -q 'Waiting for the first check' "$fixtures/plain.txt"
for TEST_DAY in 01 02 03 04 05 06 08 09 31; do
    run_plain
    grep '^Tip:' "$fixtures/plain.txt"
done > "$fixtures/tips.txt"
test "$(sort -u "$fixtures/tips.txt" | wc -l)" -eq 6

# Model a TTY without needing Windows terminal plumbing. All other tests use
# the real [ builtin; tput provides only bold/dim/reset, never color.
tput() {
    case $1 in
        cols) case ${TEST_COLS:-80} in fail) return 1 ;; *) printf '%s\n' "${TEST_COLS:-80}" ;; esac ;;
        bold) printf '\033[1m' ;;
        dim) printf '\033[2m' ;;
        sgr0) printf '\033[0m' ;;
        *) return 1 ;;
    esac
}
function [ { if [[ ${1:-} == -t ]]; then return 0; else builtin [ "$@"; fi; }
for TEST_COLS in 80 120 fail garbage 0; do
    ( TERM=xterm LANG=C.UTF-8 LC_ALL=; . "$hello" ) > "$fixtures/fancy-$TEST_COLS.txt"
done
( TERM=dumb LANG=C.UTF-8; . "$hello" ) > "$fixtures/dumb.txt"
! grep -q $'\033' "$fixtures/dumb.txt"
! grep -q '██' "$fixtures/dumb.txt"
( TERM=xterm LANG=C LC_ALL=C; . "$hello" ) > "$fixtures/legacy.txt"
! grep -q '██' "$fixtures/legacy.txt"
# No output for noninteractive command-mode SSH, even with a TTY.
bash --noprofile --norc -c '. "$1"' _ "$profile" > "$fixtures/noninteractive.txt"
test ! -s "$fixtures/noninteractive.txt"
# Inspect the interactive branch without writing the absolute /usr target.
bash --noprofile --norc -ic 'function /usr/lib/jeneros/hello { echo CALLED; }; . "$1"' _ "$profile" > "$fixtures/interactive.txt" 2> "$fixtures/interactive-errors.txt"
grep -q '^CALLED$' "$fixtures/interactive.txt"
printf 'Local greeting checks passed.\n'
