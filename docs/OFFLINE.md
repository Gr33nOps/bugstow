# Running BugsTow offline

BugsTow can operate entirely offline after installation. It only reaches the
internet for GitHub import and cloud sync, and only when you use them:

- **Installed app:** GitHub import works out of the box and contacts GitHub
  only at the moment you click **Import**. `BUGSTOW_OFFLINE=true` in
  `bugstow.env` switches it off entirely.
- **Team server:** GitHub import is off (`BUGSTOW_OFFLINE=true`, the default)
  until its administrator sets `BUGSTOW_OFFLINE=false`.

Step-by-step installation, HTTPS, backups, upgrades and the full test plan are
in **[`RELEASE_OFFLINE.md`](RELEASE_OFFLINE.md)**. This page is the short
version: what "offline" means and how to check it yourself.

---

## What connects to what

| Component | Connects to |
|---|---|
| Personal app (browser) | Only the site it was loaded from, for its own files. No API, analytics, fonts or CDNs. Data stays in IndexedDB. If you turn on sync: also the cloud you connected (encrypted files only). When you import from GitHub: `api.github.com`, for that import. |
| Team app (browser) | Only its own team server. |
| Team server / installed app | Nothing, except `api.github.com` when someone runs a GitHub import (installed app: allowed unless `BUGSTOW_OFFLINE=true`; team server: only with `BUGSTOW_OFFLINE=false`), and your WebDAV server if you configure encrypted cloud backups to it. |
| Authentication (better-auth) | Nothing. Local SQLite; its optional telemetry is forced off. |
| Updates | Nothing. There is no update check. |

Browsers enforce this as well on a Team server: it sends a
Content-Security-Policy with `connect-src 'self'`, so pages it serves cannot
open connections to other hosts. (The installed desktop app allows HTTPS
connections too, so Personal sync can reach the cloud you choose; see
[`CLOUD_SYNC.md`](CLOUD_SYNC.md).) The full audit is in
[`RELEASE_OFFLINE.md` §11](RELEASE_OFFLINE.md#11-network-connections-audited).

## Where data is stored

- **Personal:** the browser's IndexedDB for that site. Not encrypted on disk.
  Keep copies with **Settings → Export Backup** (optionally passphrase-encrypted).
- **Team:** the Docker volume mounted at `/data` on the server computer:
  `bugstow.sqlite` (database), `screenshots/`, `backups/`, `certs/`. Not
  encrypted at rest and readable by whoever controls the server. Add an external
  backup location on separate hardware ([§8](RELEASE_OFFLINE.md#8-backups-and-restore)).

## Check it yourself: Team server on a network with no internet route

```bash
docker load -i bugstow-image.tar
docker network create --internal bugstow-isolated        # no route to the internet
docker run -d --name bugstow-isolated-test --network bugstow-isolated \
  --env-file .env -v bugstow-isolated-data:/data bugstow:latest
docker logs bugstow-isolated-test                         # note the Setup token

# Run the two-client acceptance test from a second container on the same network:
docker run --rm --network bugstow-isolated -v "$PWD":/t -w /t --entrypoint node bugstow:latest \
  acceptance-test.mjs --url http://bugstow-isolated-test:8080 --setup-token <token>
```

Set `BUGSTOW_BASE_URL=http://bugstow-isolated-test:8080` in that `.env` for this
test. Anything that tried to reach the internet would fail on this network; the
acceptance test passing shows normal operation doesn't need it.

Clean up afterwards: `docker rm -f bugstow-isolated-test`,
`docker volume rm bugstow-isolated-data`, `docker network rm bugstow-isolated`.

## Check it yourself: Personal mode

Open the app, choose **Just me · Local**, then disconnect the network. Capture
issues, paste screenshots and export a backup. In the browser's developer tools,
the Network tab shows only the site's own files.

## Limitations

- GitHub import needs the internet (and is off on a team server in offline mode).
- Building the bundle needs the internet once; installing and running do not.
- Self-signed HTTPS shows a warning until each device trusts the certificate.
- The Team server must be running for teammates to reach shared data.
- The installed-app (PWA) offline behaviour and the two-computer LAN test have
  to be checked on real devices ([§13b](RELEASE_OFFLINE.md#13b-real-two-computer-offline-test)).
