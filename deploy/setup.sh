#!/usr/bin/env bash
# Sets up a fresh Ubuntu 24.04 server to run Ghostreach as a service (GR-015, J-058). Run once as root; running it again
# is safe and installs a new tarball the same way. Usage, from the folder that holds this script and ghostreach.service:
#
#   sudo bash setup.sh /root/ghostreach-0.1.0.tgz           # set the server up
#   bash setup.sh --check /root/ghostreach-0.1.0.tgz        # change nothing: check the tarball and print the plan
#
# It makes the user `ghostreach` (no login shell; home /var/lib/ghostreach, the data folder), installs Node.js from
# nodejs.org at the version pinned below with its SHA-256 checked, installs the tarball, installs Chromium for the
# Playwright version the lockfile pins, installs the systemd unit and /etc/ghostreach/env (empty: no value is ever
# written here), and turns on a firewall that lets only SSH in (cloudflared connects outward). It installs no
# cloudflared and stores no token: deploy/README.md says what Ghost does by hand. `--check` is this operator script's
# own switch, not the product's command line (GR-003 governs `ghostreach`, not this file).
set -euo pipefail

# Node.js 24 LTS (Krypton). Both checksums are the lines of nodejs.org/dist/v24.22.3/SHASUMS256.txt, whose signature
# (SHASUMS256.txt.sig) verified against the release key 5BE8A3F6C8A5C01D106C0AD820B1A390B168D356 listed in
# github.com/nodejs/release-keys (J-058). A new version replaces all three lines from the same two sources.
NODE_VERSION="24.22.3"
NODE_SHA256_X64="4f2b175a6d53a5c617a80dba2676238a0688cef28c6da4eba35c7d844e66fcfb"
NODE_SHA256_ARM64="6e51a2ada00f0011cc266f65d98922b403d7ad88f809ca2aa615a5fe1ce6e86c"
# package-lock.json's node_modules/playwright version; test/test_deploy.py holds the two equal.
PLAYWRIGHT_VERSION="1.63.0"

SERVICE_USER="ghostreach"
DATA_DIR="/var/lib/ghostreach"
ENV_FILE="/etc/ghostreach/env"
BROWSERS_DIR="/opt/ghostreach-browsers"
PREFIX="/usr/local"
UNIT="/etc/systemd/system/ghostreach.service"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

say() { printf 'setup: %s\n' "$*"; }
die() { printf 'setup: %s\n' "$*" >&2; exit 1; }

# The checksum line's hash for this machine's architecture (dpkg's name), refused unless it is 64 hex digits.
node_sha256() {
  local sum
  case "$1" in
    amd64) sum="$NODE_SHA256_X64" ;;
    arm64) sum="$NODE_SHA256_ARM64" ;;
    *) die "no Node.js checksum for architecture $1" ;;
  esac
  [[ "$sum" =~ ^[0-9a-f]{64}$ ]] || die "the Node.js checksum for $1 is a placeholder: write the SHASUMS256.txt line first"
  printf '%s\n' "$sum"
}

# nodejs.org's name for the architecture.
node_arch() {
  case "$1" in amd64) echo x64 ;; arm64) echo arm64 ;; *) die "unsupported architecture $1" ;; esac
}

# Refuses a file whose SHA-256 is not the one given; prints nothing of the file.
verify_sha256() {
  local file="$1" want="$2" got
  got="$(sha256sum "$file" | cut -d' ' -f1)"
  [[ "$got" == "$want" ]] || die "checksum mismatch for $(basename "$file"): expected $want, got $got"
}

# Refuses anything but an npm tarball of the package named ghostreach.
check_tarball() {
  local tarball="$1"
  [[ -f "$tarball" ]] || die "no tarball at $tarball"
  local manifest
  manifest="$(tar -xzOf "$tarball" package/package.json 2>/dev/null)" || die "$tarball is not an npm package (npm pack's .tgz)"
  [[ "$manifest" =~ \"name\":\ *\"ghostreach\" ]] || die "$tarball is not the ghostreach package"
}

install_node() {
  local arch sum dir work
  arch="$(node_arch "$1")"
  sum="$(node_sha256 "$1")"
  dir="/opt/node-v${NODE_VERSION}-linux-${arch}"
  if [[ ! -x "$dir/bin/node" ]]; then
    work="$(mktemp -d)"
    curl -fsSL --proto '=https' -o "$work/node.tar.xz" \
      "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${arch}.tar.xz"
    verify_sha256 "$work/node.tar.xz" "$sum"
    tar -xJf "$work/node.tar.xz" -C "$work" --no-same-owner
    mv "$work/node-v${NODE_VERSION}-linux-${arch}" "$dir"
    rm -rf -- "${work:?}"
  fi
  ln -sfn "$dir/bin/node" "$PREFIX/bin/node"
  ln -sfn "$dir/bin/npm" "$PREFIX/bin/npm"
  ln -sfn "$dir/bin/npx" "$PREFIX/bin/npx"
  say "Node.js $("$PREFIX/bin/node" --version) at $dir"
}

install_ghostreach() {
  local tarball="$1" carried
  say "tarball sha256 $(sha256sum "$tarball" | cut -d' ' -f1): compare it with the one on your computer"
  npm install -g --ignore-scripts --prefix "$PREFIX" "$tarball"
  carried="$(node -p "require('$PREFIX/lib/node_modules/ghostreach/node_modules/playwright/package.json').version")"
  [[ "$carried" == "$PLAYWRIGHT_VERSION" ]] \
    || die "the tarball's Playwright is $carried, this script's $PLAYWRIGHT_VERSION: set PLAYWRIGHT_VERSION to the lockfile's"
}

# Playwright's own downloader fetches its Chromium build; npm checks the playwright package against the registry.
install_chromium() {
  install -d -m 0755 "$BROWSERS_DIR"
  PLAYWRIGHT_BROWSERS_PATH="$BROWSERS_DIR" npx --yes "playwright@${PLAYWRIGHT_VERSION}" install --with-deps chromium
  chmod -R a+rX "$BROWSERS_DIR"
}

make_user() {
  id -u "$SERVICE_USER" >/dev/null 2>&1 \
    || useradd --system --home-dir "$DATA_DIR" --create-home --shell /usr/sbin/nologin "$SERVICE_USER"
  install -d -m 0750 -o "$SERVICE_USER" -g "$SERVICE_USER" "$DATA_DIR"
}

# Created once, with a comment and no value; an existing file (with the token in it) is never rewritten.
make_env_file() {
  install -d -m 0755 -o root -g root "$(dirname "$ENV_FILE")"
  if [[ ! -e "$ENV_FILE" ]]; then
    (umask 077 && printf '%s\n' \
      '# Ghostreach service environment: root-owned, mode 0600, read by systemd before the service starts.' \
      '# TODO(API): the API item names the variable that holds the bearer token; its value goes here, never in a log.' \
      > "$ENV_FILE")
  fi
  chown root:root "$ENV_FILE"
  chmod 0600 "$ENV_FILE"
}

install_unit() {
  install -m 0644 -o root -g root "$HERE/ghostreach.service" "$UNIT"
  systemctl daemon-reload
  systemctl enable ghostreach.service
  if grep -q 'TODO(API)' "$UNIT"; then
    say "ghostreach.service installed and enabled, not started: its ExecStart waits on the API item (TODO(API))"
  else
    systemctl restart ghostreach.service
    say "ghostreach.service restarted"
  fi
}

firewall() {
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow OpenSSH
  ufw --force enable
}

plan() {
  say "Node.js v$NODE_VERSION ($(node_arch "$1"), sha256 $(node_sha256 "$1")) into /opt, linked from $PREFIX/bin"
  say "user $SERVICE_USER, home and data $DATA_DIR; $ENV_FILE (0600, no value)"
  say "npm install -g --ignore-scripts $2; Chromium for Playwright $PLAYWRIGHT_VERSION into $BROWSERS_DIR"
  say "$UNIT from $HERE/ghostreach.service; ufw: deny incoming but OpenSSH"
}

main() {
  local check=0
  if [[ "${1:-}" == "--check" ]]; then check=1; shift; fi
  [[ $# -eq 1 ]] || die "usage: setup.sh [--check] <ghostreach tarball>"
  local tarball arch
  tarball="$(realpath -- "$1")"
  check_tarball "$tarball"
  [[ -f "$HERE/ghostreach.service" ]] || die "ghostreach.service is not beside this script in $HERE"
  arch="$(dpkg --print-architecture 2>/dev/null || uname -m)"
  [[ "$arch" == "x86_64" ]] && arch=amd64
  [[ "$arch" == "aarch64" ]] && arch=arm64
  plan "$arch" "$tarball"
  if [[ "$check" -eq 1 ]]; then say "--check: nothing changed"; return 0; fi
  [[ "$(id -u)" -eq 0 ]] || die "run as root (sudo bash setup.sh <tarball>)"
  grep -q '^VERSION_ID="24.04"' /etc/os-release || die "this script is for Ubuntu 24.04"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -q
  apt-get install -y -q ca-certificates curl xz-utils ufw
  make_user
  install_node "$arch"
  install_ghostreach "$tarball"
  install_chromium
  make_env_file
  install_unit
  firewall
  runuser -u "$SERVICE_USER" -- env HOME="$DATA_DIR" PLAYWRIGHT_BROWSERS_PATH="$BROWSERS_DIR" "$PREFIX/bin/ghostreach" doctor \
    || say "ghostreach doctor reported a problem: see its lines above and deploy/README.md"
  say "done"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
