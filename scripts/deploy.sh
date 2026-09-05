#!/usr/bin/env bash
# deploy.sh — publish this repository to the nginx document root.
#
# Fixes the drift problem: before this, proposal1 was hand-copied into
# /var/www/html, so the repository and the served files were two independent
# copies with nothing keeping them in step. The repository is now the source
# of truth and the document root is a derived artifact.
#
#   ./scripts/deploy.sh            # collect telemetry, sync, reload nginx
#   ./scripts/deploy.sh --dry-run  # show what would change, touch nothing
#
# Deliberately additive: --delete is scoped to the site directories this repo
# owns, so a stray file under /var/www/html that predates the repo is left
# alone rather than silently removed.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCROOT=/var/www/html
DRY=""
[ "${1:-}" = "--dry-run" ] && DRY="--dry-run"

# Directories this repository publishes. Add a site here and it deploys.
SITES=(proposal1 proposal2)

cd "$REPO"

echo "== telemetry"
# Page byte counts are measured from the file, so this must run before the
# sync and after any edit to index.html.
./scripts/collect-telemetry.sh

echo "== sync"
for site in "${SITES[@]}"; do
    [ -d "$site" ] || { echo "   skip $site (not in repo)"; continue; }
    sudo rsync -a --delete $DRY \
        --exclude '.git*' \
        --chown=www-data:www-data --chmod=D755,F644 \
        "$REPO/$site/" "$DOCROOT/$site/"
    echo "   $site -> $DOCROOT/$site"
done

# Root index.html only; never --delete at the docroot level.
sudo rsync -a $DRY --chown=www-data:www-data --chmod=F644 \
    "$REPO/index.html" "$DOCROOT/index.html"
echo "   index.html -> $DOCROOT/"

if [ -n "$DRY" ]; then
    echo "== dry run, nginx not reloaded"
    exit 0
fi

echo "== nginx"
sudo nginx -t
sudo systemctl reload nginx
echo "   reloaded"

echo
echo "live:"
for site in "${SITES[@]}"; do
    code=$(curl -sS -o /dev/null -w '%{http_code}' "https://www.dawnmud.com/$site/" || echo ERR)
    printf '   %-12s %s  https://www.dawnmud.com/%s/\n' "$site" "$code" "$site"
done
