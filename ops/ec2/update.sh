#!/bin/bash
set -euo pipefail
repo=/srv/deadline/repo
cd "$repo"
git fetch --quiet origin main
old=$(git rev-parse HEAD)
new=$(git rev-parse origin/main)
[ "$old" != "$new" ] || exit 0
if ! git merge-base --is-ancestor "$old" "$new"; then echo 'Refusing non-fast-forward update' >&2; exit 1; fi
extension_changed=0
if git diff --name-only "$old" "$new" -- extension/ | grep -q .; then extension_changed=1; fi
git merge --ff-only "$new"
set -a
source /etc/deadline/build.env
set +a
npm ci --no-audit --no-fund
npm run build
chmod -R a+rX dist
if [ "$extension_changed" = 1 ]; then systemctl restart deadline-browser.service; fi
