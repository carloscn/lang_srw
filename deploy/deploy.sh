#!/usr/bin/env bash
# Syncs the static app (index.html + src/) to vpsde. The server holds code
# only: every sentence library and all learning data live in each user's own
# Google Drive (or, for guests, their browser). Uses an allowlist, so anything
# else in the checkout (data/, script/, tools/, .agents/, .claude/worktrees/,
# docs, .git ...) can never leak onto the server.
#
# Files are staged first so cache-busting is automatic (nginx serves js/css as
# immutable for 30 days): every `?v=...` in index.html is replaced with a hash
# of that file. The working tree is never modified.
#
# Usage: deploy/deploy.sh [--dry-run]
# LANGLSRW_DEPLOY_TARGET overrides the destination (e.g. a local dir for testing).
# Requires an `vpsde` SSH host entry (see deploy/README.md), rsync and python3.
set -euo pipefail

cd "$(dirname "$0")/.."

REMOTE="${LANGLSRW_DEPLOY_TARGET:-vpsde:/home/carlos/langlsrw/public/}"
SSH_OPTS="ssh -C -o KexAlgorithms=curve25519-sha256 -o ConnectTimeout=10 -o BatchMode=yes"
RSYNC_EXTRA=()
[[ "${1:-}" == "--dry-run" ]] && RSYNC_EXTRA+=(--dry-run)

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

rsync -a \
  --include='/index.html' \
  --include='/src/***' \
  --exclude='*' \
  ./ "$STAGE/"

python3 - "$STAGE" <<'PY'
import hashlib, pathlib, re, sys

stage = pathlib.Path(sys.argv[1])

def short_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:10]

index = stage / "index.html"
html = index.read_text(encoding="utf-8")

def stamp(match):
    asset = stage / match.group(1)
    if not asset.is_file():
        sys.exit(f"index.html references missing file: {match.group(1)}")
    return f'{match.group(1)}?v={short_hash(asset)}'

html, count = re.subn(r'(src/[^"?\s]+)\?v=[^"\s]*', stamp, html)
index.write_text(html, encoding="utf-8")
print(f"stamped {count} asset versions in index.html")
PY

echo "Deploying langLSRW to $REMOTE ..."
# --checksum: staged files always have fresh mtimes, so compare by content.
rsync -rlvz --checksum --delete "${RSYNC_EXTRA[@]}" \
  -e "$SSH_OPTS" \
  "$STAGE/" "$REMOTE"

echo "done. verify:"
echo "  curl -s https://lang.mltz.tech/ | grep -o '<title>[^<]*</title>'"
