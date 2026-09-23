#!/usr/bin/env bash
# Syncs the static app (index.html, src/, assets/) to vpsde. Dev-only files
# (tools/, .agents/, deploy/, docs, .git, .openai) are excluded — the server
# only needs what the browser actually fetches.
#
# Requires an `vpsde` SSH host entry (see deploy/README.md) and rsync on both ends.
set -euo pipefail

cd "$(dirname "$0")/.."

REMOTE="vpsde:/home/carlos/langlsrw/public/"
SSH_OPTS="ssh -C -o KexAlgorithms=curve25519-sha256 -o ConnectTimeout=10 -o BatchMode=yes"

echo "Deploying langLSRW to $REMOTE ..."
rsync -avz --delete \
  --exclude='.git' \
  --exclude='.agents' \
  --exclude='tools' \
  --exclude='.openai' \
  --exclude='deploy' \
  --exclude='.sitesignore' \
  --exclude='.gitignore' \
  --exclude='README.md' \
  --exclude='PROJECT_STATUS.md' \
  -e "$SSH_OPTS" \
  ./ "$REMOTE"

echo "done. verify:"
echo "  curl -s https://lang.mltz.tech/ | grep -o '<title>[^<]*</title>'"
