# BugsTow 2.5.0 verification

Checked on September 28, 2026. This records completed checks and limits; it does not certify that every environment or cloud account has been tested.

## Automated checks

- Frontend: 73 tests passed; TypeScript and the production build passed.
- Server: 58 tests passed; TypeScript passed. Coverage includes invitations, account access, stale edits, screenshot validation, backups, password resets and TLS.
- Production dependency audit: no known advisories reported by `npm audit --omit=dev` in either package at the time of this check.
- The release CI passed the two-client acceptance test and installer checks on Windows, macOS and Linux. See [GitHub Actions](https://github.com/Gr33nOps/bugstow/actions/workflows/ci.yml).
- The published app archive and checksum match the SHA-256 digests reported by GitHub.

## Browser checks

The 2.5.0 release review covered personal issue creation, team search, public GitHub import, settings, invitations, and narrow/light/dark layouts. The repository presentation review repeated personal project and issue creation and captured the current light and dark workspaces with sample data.

## Not verified end to end

- Sign-in to real Google Drive and Dropbox accounts, including consent configuration, token expiry and reconnect.
- Real private GitHub repository access with a user's token.
- A physical phone connecting to another computer over LAN and trusting its certificate.
- Every manual scenario in [the release checklist](RELEASE_CHECKLIST.md), including restarting the operating system.

Cloud-provider behavior and browser permissions can vary. Follow [the cloud guide](CLOUD_SYNC.md), keep backups, and report reproducible problems using the repository's issue form.
