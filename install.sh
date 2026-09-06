#!/usr/bin/env bash
# siteforge installer — https://github.com/arjav1181/siteforge
# Usage: curl -fsSL https://raw.githubusercontent.com/arjav1181/siteforge/main/install.sh | bash
set -euo pipefail

VERSION="latest"
PKG="site-forge"
REPO="arjav1181/siteforge"

info()  { printf '\033[0;36m▸\033[0m %s\n' "$1"; }
ok()    { printf '\033[0;32m✓\033[0m %s\n' "$1"; }
fatal() { printf '\033[0;31m✗\033[0m %s\n' "$1" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION="${2:?Missing value for --version}"; shift 2 ;;
    *) fatal "Unknown option: $1 (usage: install.sh [--version x.y.z])" ;;
  esac
done

info "Installing siteforge@${VERSION}..."

command -v node >/dev/null 2>&1 || fatal "node not found — install Node.js 18+ from https://nodejs.org"
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
[ "$NODE_MAJOR" -ge 18 ] || fatal "node 18+ required (found $(node -v))"

if ! command -v ffmpeg >/dev/null 2>&1; then
  info "ffmpeg not found — 'video' and 'record' need it (https://ffmpeg.org/download.html)"
fi
if ! command -v google-chrome >/dev/null 2>&1 && ! command -v chromium >/dev/null 2>&1 && ! command -v chromium-browser >/dev/null 2>&1; then
  info "no system Chrome/Chromium detected — 'record' and 'audit' need one"
fi

if command -v npm >/dev/null 2>&1; then
  npm install -g "${PKG}@${VERSION}"
elif command -v bun >/dev/null 2>&1; then
  bun add -g "${PKG}@${VERSION}"
else
  fatal "neither npm nor bun found — install Node.js (includes npm)"
fi

command -v siteforge >/dev/null 2>&1 || fatal "install succeeded but siteforge is not on PATH (check your npm global bin dir)"

ok "Installed $(siteforge --version)"
echo ""
echo "Try it:"
echo "  siteforge --help"
echo "  siteforge video my-video.mp4"
echo ""
echo "Docs: https://github.com/${REPO}"
