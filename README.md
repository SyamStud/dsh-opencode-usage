<div align="center">

# dsh-opencode-usage

**OpenCode usage widget for the DeepSeek Harness (DSH) web sidebar**

Monitor your OpenCode plan limits — rolling, weekly, and monthly — with live progress bars in the DSH web sidebar footer.

![DSH](https://img.shields.io/badge/DSH-web%20profile-4f8cff)

</div>

---

## Features

- **Live usage bars** — `Rolling`, `Weekly`, and `Monthly` limits rendered as color-coded progress bars (red at or above 90%, amber at or above 70%, blue otherwise).
- **Human-readable resets** — countdowns such as `resets in 5d 19h` instead of raw ISO timestamps.
- **Sidebar footer widget** — a compact **OpenCode Usage** button that opens an anchored popover with one bar per window and a manual **Refresh** action.
- **Native look & feel** — mirrors the built-in *Settings* trigger (height, radius, hover states, theme tokens) and collapses to a circular icon in the compact rail.
- **Secure by design** — the API key never reaches the browser. A host-side proxy keeps the secret, so there is no CORS exposure and no leaked credentials.

## Requirements

- A **DeepSeek Harness** (`dsh` CLI) installation with the **web profile** enabled — the widget registers into the web sidebar.
- **Node.js ≥ 18** (uses the global `fetch` API).
- An **OpenCode** account, or an existing OpenCode sign-in on the host machine (see [API key setup](#api-key-setup)).

## Installation

Install the plugin into the **web profile**. The `dsh plugin` command forwards to `pnpm` in the profile directory and appends the package to `dsh.profile.bundles` automatically:

```bash
dsh plugin --profile web add https://github.com/SyamStud/dsh-opencode-usage.git
```

To use a local checkout instead:

```bash
git clone https://github.com/SyamStud/dsh-opencode-usage.git
dsh plugin --profile web add ./dsh-opencode-usage
```

Then restart the web app:

```bash
dsh web
```

In the browser, hard-refresh with `Ctrl+Shift+R` so the latest client bundle is served. The **OpenCode Usage** button appears in the sidebar footer.

## API key setup

In most cases **no setup is required**. If OpenCode is already connected — for example when the DeepSeek Harness is wired to the OpenCode provider and you are signed in — the plugin auto-discovers the key from OpenCode's auth file (`~/.local/share/opencode/auth.json`) and works immediately.

If the host has no OpenCode sign-in, set the key explicitly:

```bash
# Linux / macOS
export OPENCODE_API_KEY="sk-…"
dsh web

# PowerShell (Windows)
$env:OPENCODE_API_KEY = "sk-…"
dsh web
```

The key is read once on the host and is **never** exposed to the browser — not in the page, and not in any proxied response.

## Usage

1. Run `dsh web` and refresh the browser.
2. In the sidebar footer, click **OpenCode Usage** (next to *Settings*).
3. The popover shows three bars:
   - **Rolling** — e.g. `29% · resets in 1h 50m`
   - **Weekly** — e.g. `13% · resets in 5d 19h`
   - **Monthly** — e.g. `7% · resets in 28d 0h`
4. Use **Refresh** to re-fetch on demand, or click outside the popover to close it.

## Preview

| Sidebar footer | Popover with usage bars |
| --- | --- |
| Button sits next to **Settings** at the bottom of the sidebar and collapses to a round icon in the 56px rail. | Clicking the button opens an anchored panel showing the three limits and their reset times. |

## Development

The plugin ships without a build step — source edits are picked up on a page refresh, with no reinstall.

```bash
git clone https://github.com/SyamStud/dsh-opencode-usage.git
cd dsh-opencode-usage
dsh plugin --profile web add ./dsh-opencode-usage
```

Edit:

- `dsh/index.js` — host-side proxy, key resolution, routes.
- `dsh/client.js` — the sidebar widget and usage popover.

Validate syntax before reloading:

```bash
node --check dsh/index.js
node --check dsh/client.js
```

## Project layout

```
dsh-opencode-usage/
├── package.json        # DSH manifest (dsh.bundle / dsh.client), exports
├── cordis.patch.yml    # bundle patch that mounts the plugin as "opencode-usage"
├── README.md
└── dsh/
    ├── index.js        # host half: key discovery, upstream proxy, routes
    └── client.js       # client half: sidebar widget + usage popover
```
