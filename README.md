# webcore

Web configuration and content for `webcore` — the Proxmox LXC container behind
`dawnmud.com`.

## Layout

```
index.html                  root page (starfield demo)
proposal1/                  first profile site
proposal2/                  current profile site
  index.html                the page — no build step, no framework, no dependencies
  telemetry.json            generated at deploy; not committed
  assets/fonts.css          self-hosted latin subsets, so the page makes
  assets/fonts/*.woff2        zero third-party requests
scripts/
  collect-telemetry.sh      reads real facts off this host -> proposal2/telemetry.json
  deploy.sh                 rsync repo -> /var/www/html, reload nginx
```

## Deploying

```sh
./scripts/deploy.sh --dry-run   # show what would change
./scripts/deploy.sh             # collect telemetry, sync, nginx -t, reload
```

The repository is the source of truth; `/var/www/html` is a derived copy.
Editing files under the document root directly will be overwritten on the next
deploy — change them here instead.

`deploy.sh` scopes `rsync --delete` to the site directories listed in `SITES`,
so anything else already under the document root is left alone.

## Telemetry

`proposal2/index.html` states nothing about its own infrastructure that it has
not read. `collect-telemetry.sh` gathers the host, nginx, TLS, edge, SSH
hardening and git facts into `telemetry.json`, which the page fetches and
renders. If a value there is wrong, the page is wrong — which is the point.

It needs no root, and it reads the certificate from the live `:443` listener
rather than from `/etc/letsencrypt`, so it reports what a visitor was actually
served. The page carries an inline copy of the same shape as a fallback, so it
still renders correctly if the fetch fails.

## Host

nginx (`:80` redirects to `:443`, TLS 1.2/1.3), Let's Encrypt ECDSA wildcard
renewed by certbot over DNS-01, Cloudflare Zero Trust tunnel at the edge, SSH
on a non-default port with root login and password auth both disabled.
