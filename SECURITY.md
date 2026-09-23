# Security policy

## Reporting a vulnerability

Please do not post details of a vulnerability in a public issue.

- Use GitHub's private reporting: **Security → Report a vulnerability** on this
  repository, if the button is shown.
- Otherwise, open an issue titled "Security contact request" **without any
  details**, and the maintainer will arrange a private channel.

Include the BugsTow version, whether it affects Personal or Team mode, and steps
to reproduce.

## Scope

- **Personal mode** keeps data in the browser (IndexedDB). There is no server
  component.
- **Team mode** is self-hosted. The person running the server controls the data
  and is responsible for the host, its disk, network and backups.

## What has and hasn't been done

BugsTow has had an internal security review with regression tests for
authentication, first-admin setup, password reset, team/project/screenshot
access rules, upload validation, CSRF, CSP and sign-in throttling. It has **not**
had an independent audit. Please don't describe it as "audited".

## Supported versions

Only the latest release receives fixes.
