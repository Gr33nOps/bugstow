# Contributing to BugsTow

Bug reports, small fixes, accessibility improvements and clearer documentation are welcome. For a larger change, open an issue first so we can agree on its scope.

## Report a problem

Use the [bug report form](https://github.com/Gr33nOps/bugstow/issues/new/choose). Include the app version, operating system, browser, mode (Local or Team), and steps that reproduce the problem. Remove tokens, passwords, personal data and private repository names from logs and screenshots.

Report vulnerabilities through [the security policy](SECURITY.md), not a public issue.

## Run locally

Use Node.js 22 and npm. Fork the repository, clone your fork, then run:

```sh
npm ci
npm run dev
```

The frontend runs at http://localhost:8443. Select browser storage to work without a server.

For a local team server, open another terminal:

```sh
cd server
npm ci
```

macOS / Linux:

```sh
BUGSTOW_AUTH_SECRET=dev-secret-0123456789 npm run dev
```

Windows PowerShell:

```powershell
$env:BUGSTOW_AUTH_SECRET = 'dev-secret-0123456789'
npm run dev
```

This is a development-only secret. The server runs at http://localhost:8080 and prints its first-admin setup token. Vite forwards `/api` requests to it.

## Before opening a pull request

From the repository root:

```sh
npm run typecheck
npm test
npm run build
```

Then, in `server/`:

```sh
npm ci
npm run typecheck
npm test
```

For changes to accounts, permissions or team workflows, also run the two-client acceptance test against a **fresh, disposable server**. It creates and changes test data. See [the release verification guide](docs/RELEASE_OFFLINE.md).

Keep a pull request focused. Explain the problem, what changes for the user, and how you checked it. Include before/after screenshots for visible changes. Test narrow layouts, keyboard navigation and both themes when relevant.

## Project boundaries

- Local data stays in the browser; Team data stays on the computer running BugsTow.
- No cloud storage or sync.
- Preserve existing data; database migrations must be additive.
- Keep setup text short and specific. Match labels used in the app.
- Do not add a hosted service, analytics or a required cloud account.

See [the design conventions](docs/DESIGN.md) and [architecture notes](AGENTS.md) for more context.

## Working together

Be respectful and keep feedback specific to the work. Harassment, personal attacks and publishing someone else's private information are not acceptable. Maintainers may remove abusive content or restrict participation.

Contributions are provided under the repository's [MIT license](LICENSE).
