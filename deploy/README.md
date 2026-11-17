# Running Ghostreach on a server

For Ghost: the steps from nothing to a server the website can call (GR-015, J-058). The API itself is not built
yet: `ghostreach.service` is installed and enabled but not started, its `ExecStart` a line marked `TODO(API)` that
the API item fills, with the port it listens on (127.0.0.1:8787 is the proposal used below). Everything here
that names the bearer token's variable waits on the same item.

What talks to what: the website's Worker calls `https://<hostname>` with a Cloudflare Access service token; Access
lets it through to a Cloudflare Tunnel; `cloudflared` on the server, connected outward, hands the request to
Ghostreach on 127.0.0.1; Ghostreach checks the bearer token. No port but SSH is open on the server.

## 1. The server

Any provider's Ubuntu 24.04 server, 2 vCPU and 4 GB of memory, 40 GB of disk or more, with your SSH key. x86-64 or
ARM both work. Note its address; below it is `SERVER`.

## 2. Copy the package and the deploy folder

On your computer, in a checkout of this repository at the release you want:

    npm ci --ignore-scripts && npm run build && npm pack       # makes ghostreach-<version>.tgz
    sha256sum ghostreach-*.tgz                                  # note it: setup.sh prints the same on the server
    scp ghostreach-*.tgz root@SERVER:/root/
    scp -r deploy root@SERVER:/root/

## 3. Run the setup

    ssh root@SERVER
    bash /root/deploy/setup.sh --check /root/ghostreach-*.tgz   # changes nothing: says what it will do
    bash /root/deploy/setup.sh /root/ghostreach-*.tgz

It takes a few minutes. It makes the `ghostreach` user, installs Node.js 24.22.3 (checksum checked), the package,
Chromium, `/etc/ghostreach/env` (empty), the service, and a firewall that lets only SSH in. If your SSH listens on
a port other than 22, run `ufw allow <port>/tcp` before the setup, or the firewall shuts you out. Its last lines
are `ghostreach doctor`'s: Node.js and Chromium should both say ready.

## 4. The Tunnel

On the server, from Cloudflare's own signed package repository (developers.cloudflare.com, "Create a locally-managed
tunnel"; pkg.cloudflare.com):

    sudo mkdir -p --mode=0755 /usr/share/keyrings
    curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
    echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
    sudo apt-get update && sudo apt-get install cloudflared

Then, choosing the hostname (below `api.forecursor.com`, any name under forecursor.com will do):

    cloudflared tunnel login                       # opens a link: sign in, pick forecursor.com
    cloudflared tunnel create ghostreach           # prints the tunnel's UUID; writes /root/.cloudflared/<UUID>.json
    cloudflared tunnel route dns ghostreach api.forecursor.com

Write `/root/.cloudflared/config.yml`:

    tunnel: <UUID>
    credentials-file: /root/.cloudflared/<UUID>.json
    ingress:
      - hostname: api.forecursor.com
        service: http://127.0.0.1:8787
      - service: http_status:404

Then `cloudflared service install` and `systemctl start cloudflared`; `systemctl status cloudflared` says it runs.

## 5. Access: only the website may call

In the Cloudflare dashboard, Zero Trust:

1. Access controls → Service credentials → Service Tokens → Create Service Token, named `forecursor-website`. Copy
   the Client ID and Client Secret straight into the website's secrets (step 6); the secret is shown once.
2. Access controls → Applications → Create new application → Self-hosted and private → Add public hostname:
   `api.forecursor.com`. Add a policy with the action **Service Auth**, including that service token (an Allow
   policy would ask for a login). Under Additional settings, turn on "401 Response for Service Auth policies".

The Worker then sends the headers `CF-Access-Client-Id` and `CF-Access-Client-Secret` on every call.

## 6. The bearer token

Made on your own computer, written to a file only you can read, never printed:

    (umask 077 && openssl rand -hex 32 > ghostreach-token)
    ssh root@SERVER 'umask 077; { printf "%s=" "<NAME>"; cat; } >> /etc/ghostreach/env' < ghostreach-token

`<NAME>` is the variable the API item names (TODO(API)). Put the same value, and the two Access values from step 5,
in the website's secrets (its Pages project → Settings → Variables and Secrets, type Secret; the web design
session names them), then delete `ghostreach-token`. To change the token: the same steps, after removing the old
line from `/etc/ghostreach/env` (`sudo nano /etc/ghostreach/env`), then `systemctl restart ghostreach`.

## Once the API item lands

Copy the new `deploy/` folder and tarball as in step 2 and run the setup again: it replaces the unit, sees no
`TODO(API)` in it and starts the service. `curl -s http://127.0.0.1:8787/<health path>` on the server answers.

## Updating to a new tarball

Steps 2 and 3 again. The setup keeps the user, the data, `/etc/ghostreach/env` and the firewall, installs the new
package over the old and restarts the service. A new Node.js version is a change to `setup.sh`'s three pinned lines.

## Logs

    journalctl -u ghostreach -n 200          # the service's last lines; -f follows them
    journalctl -u cloudflared -n 200         # the tunnel's
    systemctl status ghostreach

## Backups

Everything Ghostreach keeps is in `/var/lib/ghostreach` (the reviews and their PDFs, under `Ghostreach/`). Copy it
off the server, for example nightly from your computer:

    rsync -a root@SERVER:/var/lib/ghostreach/ ./ghostreach-backup/

Also keep `/root/.cloudflared/` (the tunnel's credentials; without it, create a new tunnel) somewhere only you can
read. `/etc/ghostreach/env` need not be backed up: make a new token.

## If Chromium will not start

1. `runuser -u ghostreach -- env HOME=/var/lib/ghostreach PLAYWRIGHT_BROWSERS_PATH=/opt/ghostreach-browsers ghostreach doctor`
   says whether Node.js and Chromium are there for the service's user.
2. Missing system libraries (an error naming a `.so` file): `PLAYWRIGHT_BROWSERS_PATH=/opt/ghostreach-browsers npx --yes playwright@1.63.0 install --with-deps chromium`
   as root (the version is `setup.sh`'s `PLAYWRIGHT_VERSION`), then `chmod -R a+rX /opt/ghostreach-browsers`.
3. Killed with no error, or `MemoryMax` in `journalctl -u ghostreach`: the server ran out of memory; fewer reviews at
   once, or a larger server and a higher `MemoryMax` in the unit.
4. `ghostreach <site>` run by hand as the user above shows the browser's own error.
