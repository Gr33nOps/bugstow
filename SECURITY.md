# Security policy

## Reporting a vulnerability

Please do not post details of a vulnerability in a public issue.

- Use GitHub's private reporting: **Security → Report a vulnerability** on this
  repository, if the button is shown.
- Otherwise, open an issue titled "Security contact request" **without any
  details**, and the maintainer will arrange a private channel.

Include the BugsTow version, whether it affects Local or Team, and steps
to reproduce.

## Scope

- **Local** keeps data in the browser's IndexedDB. Nothing is uploaded; BugsTow has
  no cloud features.
- **Team on the installed app** keeps data in a SQLite database and screenshot
  folder on that computer and listens on 127.0.0.1 only. Others can reach it only
  after an explicit choice: `bugstow start --lan` (HTTPS with a certificate made on
  that computer) or `bugstow share` (Tailscale, reachable only inside the tailnet and
  by people the machine is shared with; never Funnel).
- **Invite links** work once, expire after 7 days and are stored only as SHA-256
  hashes. Other host names are refused (DNS-rebinding protection).
- **Team server (Docker)** is self-hosted. The person running it controls the data
  and is responsible for the host, its disk, network and backups.

## What has and hasn't been done

BugsTow has had an internal security review with regression tests for
authentication, first-admin setup, password reset, team/project/screenshot
access rules, upload validation, CSRF, CSP and sign-in throttling. It has **not**
had an independent audit. Please don't describe it as "audited".

## Supported versions

Only the latest release receives fixes.
