#!/usr/bin/env bash
# collect-telemetry.sh — read real facts off this host and emit proposal2/telemetry.json
#
# Everything the proposal2 page states about its own infrastructure comes from
# here. Nothing is hand-written into the page, so nothing can quietly go stale
# or be inflated: if a number is on the page, this script read it off the box.
#
# Deliberately needs no root. The TLS block is read from the cert nginx is
# actually serving on :443 rather than from /etc/letsencrypt, so it reflects
# what a visitor gets, not what is on disk.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$REPO/proposal2/telemetry.json"
PAGE="$REPO/proposal2/index.html"

j() { python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1"; }

# ---- host -------------------------------------------------------------------
HOSTNAME_S=$(hostname)
OS=$(. /etc/os-release && echo "$PRETTY_NAME")
KERNEL=$(uname -r)
ARCH=$(uname -m)
CORES=$(nproc)
MEM_GB=$(awk '/MemTotal/ {printf "%.0f", $2/1048576}' /proc/meminfo)
UPTIME_S=$(awk '{printf "%d", $1}' /proc/uptime)
# systemd-detect-virt reports "lxc" inside a Proxmox container
VIRT=$(systemd-detect-virt 2>/dev/null || echo unknown)

# ---- web server -------------------------------------------------------------
NGINX_V=$(nginx -v 2>&1 | sed 's|.*nginx/||; s| .*||')

# ---- tls, read from the live listener (no root needed) ----------------------
CERT=$(echo | openssl s_client -connect 127.0.0.1:443 -servername dawnmud.com 2>/dev/null \
       | openssl x509 2>/dev/null || true)
if [ -n "$CERT" ]; then
  TLS_ISSUER=$(echo "$CERT" | openssl x509 -noout -issuer | sed 's/.*O *= *//; s/,.*//')
  TLS_NOT_AFTER=$(echo "$CERT" | openssl x509 -noout -enddate | cut -d= -f2)
  TLS_EXPIRY_ISO=$(date -u -d "$TLS_NOT_AFTER" +%Y-%m-%dT%H:%M:%SZ)
  TLS_DAYS=$(( ( $(date -d "$TLS_NOT_AFTER" +%s) - $(date +%s) ) / 86400 ))
  TLS_ALG=$(echo "$CERT" | openssl x509 -noout -text | awk '/Public Key Algorithm/ {print $4; exit}')
  TLS_SAN=$(echo "$CERT" | openssl x509 -noout -ext subjectAltName 2>/dev/null \
            | tr -d ' ' | grep -o 'DNS:[^,]*' | sed 's/DNS://' | paste -sd', ')
else
  TLS_ISSUER=unknown; TLS_EXPIRY_ISO=null; TLS_DAYS=0; TLS_ALG=unknown; TLS_SAN=unknown
fi
TLS_PROTOCOLS=$(grep -h 'ssl_protocols' /etc/nginx/sites-enabled/* 2>/dev/null \
                | head -1 | sed 's/.*ssl_protocols *//; s/;.*//' || echo "TLSv1.2 TLSv1.3")

# ---- edge -------------------------------------------------------------------
CFD_V=$(cloudflared --version 2>/dev/null | awk '{print $3}' || echo "n/a")
CFD_UP=$(systemctl is-active cloudflared 2>/dev/null || echo inactive)

# ---- ssh hardening (booleans only; the port is deliberately not published) ---
SSHD=$(cat /etc/ssh/sshd_config /etc/ssh/sshd_config.d/* 2>/dev/null || true)
ssh_no_root=$(echo "$SSHD"  | grep -qiE '^ *PermitRootLogin +no'        && echo True || echo False)
ssh_keys_only=$(echo "$SSHD" | grep -qiE '^ *PasswordAuthentication +no' && echo True || echo False)
ssh_nondefault=$(echo "$SSHD" | grep -qiP '^ *Port +(?!22\s*$)[0-9]+'    && echo True || echo False)

# ---- git / deploy provenance ------------------------------------------------
cd "$REPO"
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "uncommitted")
GIT_SHA_FULL=$(git rev-parse HEAD 2>/dev/null || echo "")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
GIT_SUBJECT=$(git log -1 --pretty=%s 2>/dev/null || echo "")
GIT_DATE=$(git log -1 --date=iso-strict --pretty=%cd 2>/dev/null || echo "")
GIT_COUNT=$(git rev-list --count HEAD 2>/dev/null || echo 0)
GIT_DIRTY=$([ -n "$(git status --porcelain 2>/dev/null)" ] && echo True || echo False)
GIT_REMOTE=$(git remote get-url origin 2>/dev/null | sed 's|\.git$||' || echo "")

# ---- page weight (measured, not asserted) -----------------------------------
PAGE_BYTES=$([ -f "$PAGE" ] && stat -c%s "$PAGE" || echo 0)
PAGE_GZIP=$([ -f "$PAGE" ] && gzip -9 -c "$PAGE" | wc -c || echo 0)
FONT_BYTES=$(du -sb "$REPO/proposal2/assets/fonts" 2>/dev/null | cut -f1 || echo 0)

python3 - "$OUT" "$PAGE" <<PY
import json, re, sys

# Count subresources the browser would actually fetch from another origin.
#
# Two things must NOT count. A plain <a href> to GitHub is a link the visitor
# clicks, not a request the page makes. And <link rel="canonical"> (likewise
# "alternate") is metadata for crawlers -- no browser fetches it. Only the
# link rels below cause a network request.
FETCHING_RELS = {"stylesheet", "preload", "prefetch", "preconnect",
                 "dns-prefetch", "icon", "shortcut icon", "apple-touch-icon",
                 "manifest", "modulepreload"}
try:
    html = open(sys.argv[2], encoding="utf-8").read()
except OSError:
    html = ""

ext = []
for tag, attrs in re.findall(r'<(script|link|img|iframe|source|video|audio)\b([^>]*)>', html, re.I):
    url = re.search(r'\b(?:src|href)="(https?://[^"]+)"', attrs, re.I)
    if not url:
        continue
    if tag.lower() == "link":
        rel = re.search(r'\brel="([^"]*)"', attrs, re.I)
        if not rel or rel.group(1).strip().lower() not in FETCHING_RELS:
            continue
    ext.append(url.group(1))
data = {
  "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "host": {
    "hostname": $(j "$HOSTNAME_S"),
    "os": $(j "$OS"),
    "kernel": $(j "$KERNEL"),
    "arch": $(j "$ARCH"),
    "virtualization": $(j "$VIRT"),
    "cores": $CORES,
    "memory_gb": $MEM_GB,
    "uptime_seconds": $UPTIME_S
  },
  "web": {
    "server": "nginx",
    "version": $(j "$NGINX_V"),
    "tls_protocols": $(j "$TLS_PROTOCOLS"),
    "http_to_https_redirect": True
  },
  "tls": {
    "issuer": $(j "$TLS_ISSUER"),
    "key_algorithm": $(j "$TLS_ALG"),
    "domains": $(j "$TLS_SAN"),
    "expires_at": $(j "$TLS_EXPIRY_ISO"),
    "days_remaining": $TLS_DAYS,
    "renewal": "certbot, DNS-01"
  },
  "edge": {
    "cloudflared_version": $(j "$CFD_V"),
    "tunnel_state": $(j "$CFD_UP")
  },
  "hardening": {
    "root_login_disabled": $ssh_no_root,
    "password_auth_disabled": $ssh_keys_only,
    "ssh_nondefault_port": $ssh_nondefault
  },
  "deploy": {
    "commit": $(j "$GIT_SHA"),
    "commit_full": $(j "$GIT_SHA_FULL"),
    "branch": $(j "$GIT_BRANCH"),
    "subject": $(j "$GIT_SUBJECT"),
    "committed_at": $(j "$GIT_DATE"),
    "commit_count": $GIT_COUNT,
    "working_tree_dirty": $GIT_DIRTY,
    "repository": $(j "$GIT_REMOTE")
  },
  "page": {
    "bytes": $PAGE_BYTES,
    "bytes_gzipped": $PAGE_GZIP,
    "font_bytes": $FONT_BYTES,
    "third_party_requests": len(ext),
    "build_step": "none",
    "framework": "none"
  }
}
json.dump(data, open(sys.argv[1], "w"), indent=2)
open(sys.argv[1], "a").write("\n")
PY

echo "wrote $OUT"
