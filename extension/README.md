# BugsTow Capture (optional)

This Chrome/Edge extension prepares a BugsTow issue draft from a page you choose. It is separate from the main app. It does not create issues on its own.

1. Install BugsTow, or connect to a Team server over HTTPS.
2. Extract `bugstow-capture-<version>.tar.gz` into a folder.
3. Open the browser's extensions page, turn on Developer mode, choose **Load unpacked**, and select the extracted folder.
4. Click the BugsTow Capture icon. Enter your BugsTow address and choose **Save address**. The browser asks for access to that address only.
5. On a page you want to report, optionally select text, click the icon, and choose **Capture page** or **Capture screenshot**. Review the preview, then choose **Open draft in BugsTow**. Sign in or choose Local if prompted, review the issue form, and save it yourself.

The extension asks for `activeTab` so it can read the current page URL and selected text only after you click Capture. A screenshot is taken only after you click **Capture screenshot**. It asks for access to the BugsTow address you enter so it can pass the draft to that app tab. It stores only that address in browser extension storage; the draft stays in memory until you open it. Nothing is sent to BugsTow until **Open draft in BugsTow**, and nothing is saved as an issue until you confirm in BugsTow. There is no third-party endpoint or telemetry.

Use `http://localhost:5757` for an installed copy on this computer. For a Team computer reached over the network, use its HTTPS address. Other plain HTTP addresses are refused. Keep the new BugsTow tab open while signing in; reloading it before the draft appears loses the in-memory handoff. A capture can include private page content, so review the preview and the issue before saving.
