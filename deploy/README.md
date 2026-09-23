# Deploying langLSRW to vpsde

Target: **vpsde** (an existing Hetzner box that already hosts a couple of other
static sites via nginx). Domain: **lang.mltz.tech** — DNS (Cloudflare, orange-cloud
proxied) is set up by the owner separately; this folder only covers the server side.

No credentials, tokens, or IPs are stored here. `vpsde` is an SSH host alias
already configured in `~/.ssh/config` on the deploying machine — ask the owner
if you don't have it.

## Layout

| Path | What |
|---|---|
| `deploy.sh` | rsyncs `index.html`, `src/`, `assets/` to `vpsde:/home/carlos/langlsrw/public/`. Dev-only files (`tools/`, `.agents/`, docs, `.git`, `.openai`) are excluded — the server only needs what the browser fetches. |
| `nginx-lang-mltz.conf` | The nginx server block for `lang.mltz.tech`. Mirrors the pattern already used on this box for other `*.mltz.tech` subdomains (shared Cloudflare Origin Certificate, no new cert needed). |

Real paths on vpsde (not in this repo, live only on the box):
- `/home/carlos/langlsrw/public/` — served directory (nginx `root`)
- `/etc/nginx/sites-available/lang-mltz` (symlinked from `sites-enabled/`) — installed config

## First-time setup (one-time, needs sudo on vpsde)

1. Create the remote directory (content-only, no sudo needed — `/home/carlos` is `carlos`-owned):
   ```bash
   ssh -C -o KexAlgorithms=curve25519-sha256 vpsde 'mkdir -p /home/carlos/langlsrw/public'
   ```
2. Ship the site once:
   ```bash
   ./deploy.sh
   ```
3. Install the nginx config (needs the vpsde sudo password — not stored anywhere in this
   repo; run this yourself or hand it to whoever has it):
   ```bash
   scp -C -o KexAlgorithms=curve25519-sha256 deploy/nginx-lang-mltz.conf \
     vpsde:/home/carlos/langlsrw/lang-mltz.conf
   ssh -C -o KexAlgorithms=curve25519-sha256 vpsde \
     'sudo cp /home/carlos/langlsrw/lang-mltz.conf /etc/nginx/sites-available/lang-mltz \
      && sudo ln -sf /etc/nginx/sites-available/lang-mltz /etc/nginx/sites-enabled/lang-mltz \
      && sudo nginx -t && sudo systemctl reload nginx'
   ```
4. Point `lang.mltz.tech` at this box in Cloudflare, then verify:
   ```bash
   curl -s https://lang.mltz.tech/ | grep -o '<title>[^<]*</title>'
   ```

## Redeploying content

Only step 2 above — just run `./deploy.sh` again. No sudo, no nginx changes needed
for ordinary content updates.

## Gotchas (carried over from this box's other static-site deploys)

1. **This site is a real multi-file app, not a single HTML fragment** — `deploy.sh`
   rsyncs the whole `src/`/`assets/` tree, unlike the single-file `scp` used for other
   sites on this box. Keep using `deploy.sh` rather than ad-hoc `scp` so excludes and
   `--delete` stay consistent (otherwise stale files can accumulate on the server).
2. **TLS cert is shared — don't provision a new one.** `/etc/ssl/cloudflare/origin.crt`
   already covers every `*.mltz.tech` subdomain (valid to 2041). `curl` straight to the
   box's IP needs `-k`/`--resolve` since it's a Cloudflare *origin* cert, not publicly
   trusted; only traffic through Cloudflare's edge sees a trusted chain.
3. **A missing/broken `sites-enabled/lang-mltz` symlink won't block the request** —
   `sites-enabled/00-block-all.conf` is `default_server` for port 80 only, not 443. If
   this site's TLS block isn't loaded, requests silently fall through to whichever
   `listen 443` block nginx picked instead (in practice the first site alphabetically).
   Symptom: the domain loads but shows a different site's content. Check
   `ls -la /etc/nginx/sites-enabled/` on vpsde if that happens.
4. **SSH to vpsde can silently hang on anything but tiny output.** Always add
   `-C -o KexAlgorithms=curve25519-sha256` (both are already baked into `deploy.sh`);
   use them on any ad-hoc `ssh`/`scp` to vpsde too. If a command hangs, kill it and
   retry with these flags rather than waiting it out.
5. **No sudo password for vpsde is stored anywhere in this repo.** Step 3 above needs
   it — hand the commands to the owner or whoever holds it, don't try to guess around it.
