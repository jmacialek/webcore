# Server Inventory: `webcore`

Comprehensive system, network, security, and application inventory for the `webcore` server taken on September 12, 2026.

---

## 1. System Overview & Virtualization

| Property | Value | Notes |
| :--- | :--- | :--- |
| **Hostname** | `webcore` | |
| **FQDN / Primary Domain** | `dawnmud.com`, `www.dawnmud.com` | Edge served via Cloudflare |
| **Platform** | Proxmox VE LXC Container (`VMID 122`) | Disk: `/dev/mapper/pve-vm--122--disk--0` |
| **Host Kernel** | `Linux 7.0.14-15-pve #1 SMP PREEMPT_DYNAMIC PMX 7.0.14-15` | x86_64 |
| **OS Distribution** | Ubuntu 26.04.1 LTS (`Resolute Raccoon`) | Codename: `resolute` |
| **System Uptime** | 3+ days (load average: ~0.8) | |

---

## 2. Compute, Memory & Storage

### CPU
- **Processor**: AMD Ryzen 7 5800X 8-Core Processor
- **Assigned vCPUs**: 16 threads (0–15)
- **Clock Speed**: Min 555 MHz / Max 4853 MHz
- **Architecture**: x86_64, AMD-V virtualization, 32 MiB L3 cache

### Memory & Swap
- **Total RAM**: 32 GiB (Available: ~31 GiB, Used: ~90 MiB)
- **Swap**: 8.0 GiB (Used: ~20 MiB)

### Storage
- **Root Filesystem (`/`)**: 251 GB total, 2.6 GB used, 236 GB available (2% utilized)
- **Filesystem Type**: ext4 on LVM thin pool (`/dev/mapper/pve-vm--122--disk--0`)

---

## 3. Network & Connectivity

### Interface Configuration
- **Interface `eth0`**: `10.0.0.122/24` (MAC: `be:24:11:fee1:4a2d`)
- **Default Gateway**: `10.0.0.1` dev `eth0`
- **DNS Resolver**: `systemd-resolved` listening on `127.0.0.53:53` and `127.0.0.54:53`

### Open / Listening Ports
| Protocol | Port | Bind Address | Service / Process | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **TCP** | `59969` | `0.0.0.0`, `[::]` | `sshd` | Hardened SSH access |
| **TCP** | `80` | `0.0.0.0`, `[::]` | `nginx` | HTTP redirect to HTTPS |
| **TCP** | `443` | `0.0.0.0`, `[::]` | `nginx` | HTTPS web server |
| **TCP** | `20241` | `127.0.0.1` | `cloudflared` | Cloudflare tunnel internal metrics |
| **TCP** | `25` | `127.0.0.1`, `[::1]` | `postfix` | Local mail transport agent |
| **UDP** | `53` | `127.0.0.53/54` | `systemd-resolved` | Local DNS resolution |

---

## 4. Security & Access Hardening

- **SSH Hardening**:
  - **Port**: `59969` (non-standard)
  - **PermitRootLogin**: `no`
  - **PasswordAuthentication**: `no`
  - **PubkeyAuthentication**: `yes`
- **Sudo Rights**: User `jamac` has full `NOPASSWD: ALL` sudo privileges.
- **Firewall**: UFW is currently `inactive` (traffic filtered at Proxmox hypervisor / edge router level).

---

## 5. Cloudflare Zero Trust Tunnel

The Cloudflare tunnel client connects `webcore` to the Cloudflare edge without exposing inbound ports to the public internet.

- **Systemd Unit**: `cloudflared.service` (active, running, preset enabled)
- **Binary**: `/usr/bin/cloudflared` (version `2026.8.3`)
- **Execution Command**: `/usr/bin/cloudflared --no-autoupdate tunnel run --token-file /etc/cloudflared/token`
- **Tunnel ID**: `21f32584-3abe-4564-bb7f-0c5c7c876109`
- **Account Hash**: `7dd20bfe9ef3d92a0d7fb2499a57c1df`
- **Routing**: Ingress traffic for `dawnmud.com` and `www.dawnmud.com` is terminated at Cloudflare and proxied to origin HTTPS (`https://www.dawnmud.com`).

---

## 6. Web Server (Nginx) & TLS

- **Service**: `nginx.service` (active, running, version `1.28.3`)
- **Configuration Path**: `/etc/nginx/sites-available/default` -> `/etc/nginx/sites-enabled/default`
- **Virtual Hosts**:
  - `dawnmud.com`, `www.dawnmud.com`
  - **Port 80**: 301 Permanent Redirect to `https://$host$request_uri`
  - **Port 443**: Document root `/var/www/html`, HTTP/2, TLSv1.2 & TLSv1.3 with high ciphers
- **TLS Certificate**:
  - **Provider**: Let's Encrypt (`CN=YE2`)
  - **SAN Domains**: `*.dawnmud.com`, `dawnmud.com`
  - **Validity**: September 4, 2026 to December 3, 2026 (auto-renewed via `certbot.timer`)

---

## 7. Web Document Root & Applications

Document root is located at `/var/www/html/`. Content is deployed from the local Git repository `/home/jamac/repos/webcore`.

### A. Root Page: Vector 3D Ultra Edition HUD (`/var/www/html/index.html`)
- **Title**: `Vector 3D Ultra Edition`
- **Architecture**: Modern, high-resolution cyberpunk/tactical HUD interface with glassmorphism over the enhanced 260-star starfield and glowing nebulae.
- **Components & Features**:
  - **Color Palette**: Obsidian space background (`#07090e`), frosted purple glass panels (`rgba(14, 11, 28, 0.72)`), neon violet/purple borders (`#a855f7`, `#c084fc`), hot pink action triggers (`#f43f5e`), electric cyan telemetry (`#00f0ff`), and emerald green status badges (`#10b981`).
  - **Top Bar**:
    - Left: Map Badge (`Current Map // Switchback [Grid 18×22]`) + Utility action buttons (`Graphics`, `Music`, `Options`).
    - Center: Prominent dual-action dispatch (`Send Wave` and `Auto Wave` with toggleable checkbox).
    - Right: 2x3 Economy & Status HUD (`Bank: $400`, `Lives: 20`, `Level: 3/50`, `Interest: 3%`, `Score: 30,835`, `Bonus: 0`).
  - **Center Map Viewport**:
    - Transparent tactical frame displaying the animated starfield and glowing nebulae directly underneath.
    - Dynamic vector grid engine (18 rows × 22 columns) with square cell auto-scaling via `ResizeObserver`, corner vector crosses, tile hover reticles, and real-time interactive Coordinate telemetry `[X: col, Y: row]`.
  - **Right Sidebar**:
    - **Towers Section**: 4x4 matrix representing the 4 tech trees (Green Lasers, Red Spires/Refractors, Purple Disruptors, Cyan Buffers) with SVG vector icons, tier badges, and lock indicators.
    - **Tower Inspector**: Dynamic stats panel (`Red Refractor` default) displaying Damage, Range, Special attribute (`Splash damage`), Upgrade delta box, `Upgrade $100` action, targeting priority toggles (`Close`, `Hard`, `Weak`), Target Locking toggle (`On/Off`), and `Sell Tower` button.
    - **Current & Next Preview**: Wave intel panel with rotating CSS-animated Vectoid spinners (Blue Spinner, Green Flyer), HP stats, and reward bounties.
    - **Bottom Controls**: `Quit / Submit` and `Pause / Resume` buttons.
  - **Audio Engine**: Procedural Web Audio API synthesizer generating tactile sci-fi sound effects on UI interaction without external audio dependencies.

### B. Sub-sites & Proposals
- `/var/www/html/proposal1`: Initial profile site
- `/var/www/html/proposal2`: Current profile site (generates `telemetry.json` on deploy, self-hosted WOFF2 fonts)
- `/var/www/html/proposal3`: Alternative proposal site

### C. Deployment & Automation Scripts
Located in `/home/jamac/repos/webcore/scripts/`:
- `collect-telemetry.sh`: Reads real server and TLS metrics directly from localhost and generates telemetry JSON.
- `deploy.sh`: Synchronizes repository files into `/var/www/html` via scoped `rsync --delete` and reloads Nginx.

---

## 8. Installed Tooling & Developer Runtimes

- **Node.js**: `v22.22.1`
- **npm**: `9.2.0`
- **Python**: `3.14.4`
- **Git**: `2.53.0`
- **Nginx**: `1.28.3`
- **Cloudflared**: `2026.8.3`

---

## 9. Repositories in `/home/jamac/repos` on `webcore`

1. **`webcore`**:
   - Path: `/home/jamac/repos/webcore`
   - Remote: `https://github.com/jmacialek/webcore.git`
   - Purpose: Source repository for `dawnmud.com` root site, proposals, telemetry scripts, and deploy automation.
2. **`webull-trading`**:
   - Path: `/home/jamac/repos/webull-trading`
   - Remote: `https://github.com/jmacialek/webull-trading.git`
   - Purpose: Trading tools / automation codebase.
