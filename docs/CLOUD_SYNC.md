# Cloud sync and cloud backups

BugsTow can use **your own** cloud storage in two ways:

- **Personal mode sync:** see the same projects, issues and screenshots on your
  phone and computers.
- **Team backups:** a Team server sends encrypted copies of its backups to your
  cloud, as an extra backup location.

Both are optional and off until you set them up. BugsTow never stores anything
on infrastructure run by the BugsTow maintainer, and everything that goes to
your cloud is encrypted first with a passphrase only you know.

---

## Personal mode sync

Open **Settings → Sync** and pick one of the options below. Each one says in
the app what will happen before you connect.

| Option | What happens | Works on phones? |
|---|---|---|
| **Google Drive** | Syncs automatically. Files go in a hidden BugsTow folder in your Drive that only BugsTow can see (not the rest of your Drive). Google limits browser access to about an hour, so after that you tap **Reconnect** once. | Yes |
| **Dropbox** | Syncs automatically. Files go in *Dropbox › Apps › BugsTow*; BugsTow can't see anything else. Stays connected until you turn it off. | Yes |
| **WebDAV** | Syncs automatically with a server you run: Nextcloud, ownCloud, a Synology NAS… It must use `https://` and allow BugsTow's address (CORS, below). | Yes |
| **Synced folder** | Pick a folder that your cloud's desktop app syncs: **Mega, Terabox, OneDrive, iCloud Drive**, or Google Drive / Dropbox for desktop. BugsTow writes its files there and the cloud app uploads them. Desktop Chrome/Edge only. | Not automatically (use a sync file) |
| **Sync file** | Export one encrypted file, put it in any cloud, import it on your other device to merge. Nothing happens automatically. | Yes |

### Your passphrase

The first device you connect asks you to **create** a sync passphrase (at least
10 characters). Every other device asks you to **enter** the same one.

- Everything is encrypted on your device before it's uploaded: AES-256-GCM
  with a key derived from your passphrase (PBKDF2-SHA-256, 310,000 rounds).
  Your cloud only ever sees scrambled files.
- Each device remembers the key (as a key the browser can't export), so you
  don't retype the passphrase.
- **If you forget the passphrase, the cloud copy can't be opened.** Nobody can
  recover it, not even the maintainer. The data on each of your devices isn't
  affected; turn sync off and set it up again with a new passphrase.

### How syncing behaves

- **When:** when the app opens, when you come back to it, a few seconds after
  each change, and every few minutes while it's open. **Sync now** runs it
  immediately.
- **Edits on two devices:** the most recent edit to an issue or project wins.
- **Deletions sync too.** An issue deleted on your phone disappears from your
  computer. But **an edit beats a delete**: if one device edits an issue that
  another deleted, the edited issue is kept.
- **Large deletions ask first.** If a sync would remove most of your data (for
  example after clearing a device), it stops and asks. In the background it
  never deletes in bulk; it waits for you to press **Sync now**.
- **Clearing all data** on a device turns sync off on that device. The copy in
  your cloud is kept and isn't wiped.
- **Screenshots** are uploaded once each as separate encrypted files.
- Theme and other device settings are not synced.

### What's in your cloud

A file `bugstow-index.json` (the encrypted issue list, plus the salt needed to
derive the key) and a `shots/` folder with one encrypted file per screenshot.
Don't edit them by hand. Deleting them deletes the cloud copy (your devices
keep their data and upload it again on the next sync).

### Where to find the files

- Google Drive: hidden app data (Drive → Settings → *Manage apps* → BugsTow →
  *Delete hidden app data* removes it).
- Dropbox: *Apps/BugsTow*.
- WebDAV / synced folder / sync file: wherever you chose.

### Limits worth knowing

- Google access expires after about an hour (Google's rule for apps without a
  server); tap **Reconnect**.
- The synced-folder option needs desktop Chrome or Edge, and the browser asks
  for folder access again after a restart (one click).
- Sync happens while the app is open. A phone that hasn't opened BugsTow for a
  week catches up the next time it does.
- In the installed app (`bugstow`), sync works from the browser options
  ("Only in this browser" / "Synced with my own cloud"). The "In a folder on
  this PC" option keeps data in the data folder instead; back that up with the
  server backup settings below.
- When BugsTow is opened **from a shared Team server**, only the synced-folder
  and sync-file options are offered: a Team server blocks connections to other
  sites on purpose.

---

## For the maintainer: enabling Google Drive and Dropbox

Google and Dropbox only show their sign-in screen to a registered app. Register
BugsTow once with each; the IDs are **not secrets** and are built into the app
package. There's no server component and no client secret. Every user still
signs in with their **own** Google or Dropbox account, and their files go to
their own storage; the registration only identifies the app.

The installed app runs at `http://localhost:5757`, so that is the address to
register. (Someone who moves BugsTow to another port with `--port` can't use
Google Drive or Dropbox sync, because the providers only accept the registered
address; the other options still work.)

### Google Drive

1. Open <https://console.cloud.google.com/>, create a project (e.g. "BugsTow").
2. *APIs & Services → Library* → enable **Google Drive API**.
3. *APIs & Services → OAuth consent screen*: user type **External**, app name
   "BugsTow", your support email. Scopes: add
   `https://www.googleapis.com/auth/drive.appdata` (a non-sensitive scope).
   Publish the app (while it's in "Testing" only listed test users can sign in).
4. *Credentials → Create credentials → OAuth client ID* → **Web application**.
   - Authorized JavaScript origins: `http://localhost:5757` (and
     `http://localhost:8443` for development)
   - Authorized redirect URIs: `http://localhost:5757/oauth/callback`
     (and `http://localhost:8443/oauth/callback`)
5. Copy the client ID (`….apps.googleusercontent.com`).

### Dropbox

1. Open <https://www.dropbox.com/developers/apps> → **Create app**.
2. **Scoped access** → **App folder** → name "BugsTow".
3. *Permissions* tab: tick `files.content.read` and `files.content.write`, then
   **Submit**.
4. *Settings* tab: add redirect URI `http://localhost:5757/oauth/callback`
   (and `http://localhost:8443/oauth/callback`). Leave "Allow public clients
   (Implicit Grant & PKCE)" **allowed**.
5. *Settings* tab: under "Development users" click **Enable additional users**
   (a new app otherwise only works with your own Dropbox account).
6. Copy the **App key**.
7. Apply for **production status** in the app console early: once 50 Dropbox
   users have connected, Dropbox gives you two weeks to get approval before it
   stops new users from connecting (and an unapproved app is capped at 500).

### Put the IDs into BugsTow

- **For everyone (the release):** they live in `.env.production` in the
  repository (`VITE_GOOGLE_CLIENT_ID`, `VITE_DROPBOX_CLIENT_ID`) and are built
  into the package the installers download. Change them there and publish a
  new release.
- **On one computer, without a new release:** add them to `bugstow.env` in the
  BugsTow folder (next to `data`), then `bugstow restart`. These override the
  built-in ones:

  ```env
  BUGSTOW_GOOGLE_CLIENT_ID=<Google client ID>
  BUGSTOW_DROPBOX_APP_KEY=<Dropbox app key>
  ```

  A team server takes the same two settings in its `.env`, but its strict
  security policy still blocks browser sync (use a synced folder or sync file).

Only the Google **client ID** and the Dropbox **app key** are used. BugsTow
never needs the Google client secret, the Dropbox app secret or a Dropbox
access token; don't put those anywhere.

Without IDs, Google Drive and Dropbox show "Not available in this copy of
BugsTow"; the other three options work regardless.

---

## WebDAV: allowing BugsTow's address (CORS)

Browsers only let the BugsTow page talk to your WebDAV server if the server
says so. Nextcloud and ownCloud don't do this out of the box, so add it in the
reverse proxy in front of them. The installed app's address is
`http://localhost:5757`; use yours if you changed the port.

**Caddy**

```
cloud.example.com {
    @bugstow header Origin http://localhost:5757
    header @bugstow {
        Access-Control-Allow-Origin "http://localhost:5757"
        Access-Control-Allow-Methods "GET, PUT, DELETE, PROPFIND, MKCOL, OPTIONS"
        Access-Control-Allow-Headers "Authorization, Depth, If-Match, If-None-Match, Content-Type"
        Access-Control-Expose-Headers "ETag"
        Access-Control-Max-Age "600"
    }
    @preflight {
        method OPTIONS
        header Origin http://localhost:5757
    }
    respond @preflight 204
    reverse_proxy nextcloud:80
}
```

**nginx** (inside the `server` block)

```
if ($request_method = OPTIONS) { set $bugstow_preflight 1; }
add_header Access-Control-Allow-Origin "http://localhost:5757" always;
add_header Access-Control-Allow-Methods "GET, PUT, DELETE, PROPFIND, MKCOL, OPTIONS" always;
add_header Access-Control-Allow-Headers "Authorization, Depth, If-Match, If-None-Match, Content-Type" always;
add_header Access-Control-Expose-Headers "ETag" always;
if ($bugstow_preflight) { return 204; }
```

Then in BugsTow use the folder URL, e.g.
`https://cloud.example.com/remote.php/dav/files/<you>/BugsTow/`, your username,
and an **app password** (Nextcloud: *Settings → Security → Devices & sessions*).
Create the `BugsTow` folder first.

Hosted WebDAV services (pCloud, Koofr, 4shared…) generally don't send these
headers and can't be changed, so browser sync to them won't work. Use their
desktop app with the **synced folder** option, or a **sync file**. (Team
backups to them *do* work: the Team server isn't a browser.)

---

## Team backups to your cloud

A Team server already backs up to `/data/backups` and optionally to an
external drive (`docs/RELEASE_OFFLINE.md` §8). It can also send **encrypted
archives** of every backup to your cloud.

Each backup becomes one file `bugstow-backup-<time>.bugstow-backup`: gzip, then
AES-256-GCM with a key derived from your passphrase (scrypt). BugsTow decrypts
every archive once to check it before sending it anywhere. Without the
passphrase **nothing is uploaded**.

In `.env`:

```env
BUGSTOW_BACKUP_ENCRYPTION_PASSPHRASE=<long passphrase; store it somewhere safe, e.g. a password manager>
BUGSTOW_BACKUP_CLOUD_RETENTION=14

# Target 1 (any cloud with a desktop app): a folder that app syncs
BUGSTOW_BACKUP_CLOUD_DIR=/backup-cloud

# Target 2: WebDAV (Nextcloud, ownCloud, pCloud, Koofr, Synology, 4shared...)
BUGSTOW_BACKUP_WEBDAV_URL=https://webdav.example.com/BugsTow/
BUGSTOW_BACKUP_WEBDAV_USER=you@example.com
BUGSTOW_BACKUP_WEBDAV_PASSWORD=<app password>
```

Use either target or both. If one fails, the other still runs, the local backup
is unaffected, and the admin **Backups** screen shows the error.

### Cloud folder examples

Install the cloud's desktop app on the server computer, let it sync a folder,
create an empty `.bugstow-backup-target` file inside it once, then mount it in
`docker-compose(.offline).yml`:

```yaml
    volumes:
      - bugstow-data:/data
      - "/home/you/Dropbox/BugsTow backups:/backup-cloud"
```

| Cloud | Typical folder on the server |
|---|---|
| Google Drive for desktop | Windows `G:/My Drive/BugsTow backups`, macOS `~/Library/CloudStorage/GoogleDrive-you@gmail.com/My Drive/BugsTow backups` |
| Dropbox | `~/Dropbox/BugsTow backups` |
| OneDrive | Windows `C:/Users/you/OneDrive/BugsTow backups` |
| Mega (MEGAsync) | the local folder you chose in MEGAsync, e.g. `~/MEGA/BugsTow backups` |
| Terabox | a folder you added to the Terabox desktop app's backup/sync list |
| pCloud Drive | `P:/BugsTow backups` (Windows) or `~/pCloud Drive/BugsTow backups` |

On Windows with Docker Desktop, write host paths with forward slashes, for
example `"G:/My Drive/BugsTow backups:/backup-cloud"`. The marker file stops
BugsTow from writing into an empty mount point if the cloud app isn't running.

### Restoring from a cloud archive

1. Download the `.bugstow-backup` file from your cloud onto the server.
2. Decrypt it into a normal backup folder:
   ```bash
   docker cp bugstow-backup-2026-09-23T10-30-00-000Z.bugstow-backup bugstow:/data/restore.bugstow-backup
   docker exec -it bugstow npm run decrypt-backup -- /data/restore.bugstow-backup /data/restore-folder
   ```
   (It uses `BUGSTOW_BACKUP_ENCRYPTION_PASSPHRASE` from the container, or
   `--passphrase-file <file>`.) A wrong passphrase or a damaged file is refused
   and nothing is written.
3. Restore `/data/restore-folder` exactly like any backup folder
   (`docs/RELEASE_OFFLINE.md` §8, "Restore").

---

## Privacy and network, precisely

- The BugsTow maintainer receives nothing.
- Your cloud provider stores only encrypted files. It can see how many files
  there are, their sizes and when they change, but not their contents.
- The installed app lets the page make HTTPS connections, which is needed to
  reach the cloud or WebDAV server you choose. BugsTow's code connects only to
  the one you connected, and only after you connect it.
- A shared Team server keeps its strict policy (connections to itself only).
  Its cloud backups are sent by the server, not the browser.
