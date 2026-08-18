<div align="center">

# dsh-opencode-usage

**OpenCode usage widget for the DeepSeek Harness (DSH) web sidebar**

A zero-build DSH plugin that surfaces your [OpenCode](https://opencode.ai) usage — rolling, weekly and monthly plan limits — as live progress bars right in the sidebar footer of the DSH web UI.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![DSH](https://img.shields.io/badge/DSH-web%20profile-4f8cff)

</div>

---

## ✨ Features

- **Live usage bars** — `Rolling`, `Weekly` and `Monthly` limits shown as color-coded progress bars (red ≥ 90%, amber ≥ 70%, blue otherwise).
- **Friendly reset countdown** — e.g. `resets in 5d 19h`, instead of a raw ISO timestamp.
- **Sidebar footer widget** — a compact **OpenCode Usage** button that opens an anchored popover with one bar per window and a manual **Refresh**.
- **Matches the native UI** — styling mirrors the built-in *Settings* trigger (same height, radius, hover and theme tokens), and it collapses to a circular icon in the compact rail.
- **Secure by design** — the API key **never reaches your browser**. A host-side proxy holds the secret, so there is no CORS and no leaked credentials.
- **Zero dependencies, zero build step** — both halves are hand-written in DSH's lazy-CJS bundle protocol, mirroring [`@liustack/modlens`](https://github.com/liustack/modlens).
- **Hot-reload friendly** — installed as a `link:` dependency, so source edits are re-served without reinstalling (a browser refresh is enough).

---

## 🖼️ Preview

| Sidebar footer | Popover with usage bars |
| --- | --- |
| Button sits next to **Settings** at the bottom of the sidebar and collapses to a round icon in the 56px rail. | Clicking the button opens an anchored panel showing the three limits and their reset times. |

---

## 🧱 How it works

The plugin is split into two halves, the same pattern used by well-known DSH plugins:

| Half | File | Runs in | Responsibility |
| --- | --- | --- | --- |
| **Host** | `dsh/index.js` | the DSH Node process | Resolves the API key, proxies `GET https://opencode.ai/zen/go/v1/usage` server-side, and exposes it as a same-origin route `GET /opencode-usage`. |
| **Client** | `dsh/client.js` | the browser | Registers the `sidebar.footer.action` widget and fetches `/opencode-usage` same-origin (no CORS, no key on the page). |

```
┌─────────────┐   same-origin    ┌──────────────────┐   Bearer key    ┌─────────────────────────┐
│   Browser   │ ───── fetch ───▶ │  DSH web server   │ ──── proxy ───▶ │ opencode.ai/zen/go/…     │
│  widget     │ ◀────────────────│ /opencode-usage   │ ◀──── JSON ─────│ (GET + browser UA)      │
└─────────────┘                  └──────────────────┘                  └─────────────────────────┘
```

The upstream endpoint is gated by Cloudflare on the request `User-Agent`, so the host sends a browser UA (the raw API key is what authorizes; the UA only clears the CDN bot-check). Only the exact JSON shape the widget understands is relayed back to the page.

> **Why a two-half design?** A browser-only widget would have to (a) ship the API key to the browser and (b) fight CORS. Routing the call through the host keeps the secret server-side and makes the widget work on any loopback origin.

---

## ✅ Requirements

- A **DeepSeek Harness** installation (the `dsh` CLI) with the **web profile** — the widget registers into the web sidebar.
- **Node.js ≥ 18** (for global `fetch`).
- An **OpenCode** account / API key that authorizes the usage endpoint (see [API key setup](#-api-key-setup)).

---

## 📦 Installation

Install the plugin into the **web profile**. The `dsh plugin` command forwards to `pnpm` in the profile directory and automatically appends the package to `dsh.profile.bundles` because it declares `dsh.bundle`:

```bash
# from a directory of your choice
dsh plugin --profile web add https://github.com/SyamStud/dsh-opencode-usage.git
```

> **Alternative (local checkout):** clone the repo and install it as a path/link dependency.
>
> ```bash
> git clone https://github.com/SyamStud/dsh-opencode-usage.git
> dsh plugin --profile web add ./dsh-opencode-usage
> ```

After installing, **restart the web app** for the new bundle to load:

```bash
dsh web
```

Then open the DSH web UI and **hard-refresh** (`Ctrl+Shift+R`) so the latest client bundle is fetched. You should see the **OpenCode Usage** button in the sidebar footer.

> The server also re-serves client bundle changes without reinstalling — a page refresh applies file edits.

---

## 🔑 API key setup

The host resolves the key in this order (the first that yields a value wins):

1. **Plugin config** — `apiKey` passed in the plugin's Cordis configuration.
2. **Environment variable** — `OPENCODE_API_KEY`.
3. **Auto-discovery** — reads OpenCode's own auth file (`~/.local/share/opencode/auth.json`, `opencode-go`). If you already sign in to OpenCode, the widget works with **no configuration at all**.

### Recommended: environment variable

```bash
# Linux / macOS
export OPENCODE_API_KEY="sk-…"
dsh web

# PowerShell (Windows)
$env:OPENCODE_API_KEY = "sk-…"
dsh web
```

### Optional: plugin config

If your environment cannot export variables (or you host multiple keys), set `apiKey` in the profile's `cordis.patch.yml` under the plugin's config:

```yaml
- id: opencode-usage
  name: dsh-opencode-usage
  config:
    apiKey: sk-…
```

> **Security:** the key is read only on the host and is **never** exposed to the browser, not even in the proxied response. The `/opencode-usage` route only answers **same-origin loopback** requests (the same confused-deputy fence DSH applies to its own `/api`).

---

## 🎛️ Usage

1. Launch `dsh web` and refresh the browser.
2. At the bottom of the sidebar you'll find an **OpenCode Usage** button (next to *Settings*).
3. Click it — a popover opens with three bars:
   - **Rolling** — usage against the rolling window, e.g. `29% · resets in 1h 50m`
   - **Weekly** — usage against the weekly window, e.g. `13% · resets in 5d 19h`
   - **Monthly** — usage against the monthly window, e.g. `7% · resets in 28d 0h`
4. Use **Refresh** to re-fetch on demand, or click outside the popover to close it.

---

## 🤖 HTTP routes

The host registers the following routes on the DSH web server (loopback / same-origin only):

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/opencode-usage` | Returns `{ ok, usage: { rolling, weekly, monthly } }` from the OpenCode usage API. |
| `GET` | `/opencode-usage/probe` | Health/config check — returns `{ ok, configured, upstream }`. |

Example response (from `GET /opencode-usage`):

```json
{
  "ok": true,
  "usage": {
    "rolling": { "percent": 27, "resetsAt": "2026-08-18T06:25:28.429Z" },
    "weekly":  { "percent": 12, "resetsAt": "2026-08-24T00:00:00.429Z" },
    "monthly": { "percent": 7,  "resetsAt": "2026-09-15T05:31:32.429Z" }
  }
}
```

---

## 🧑‍💻 Development

Because the plugin has **no build step**, you can hack on it directly and see changes with a page refresh.

```bash
git clone https://github.com/SyamStud/dsh-opencode-usage.git
cd dsh-opencode-usage

# install as a link: dependency so edits are picked up live
dsh plugin --profile web add ./dsh-opencode-usage
```

Then edit:

- `dsh/index.js` — host-side proxy, key resolution, routes.
- `dsh/client.js` — the sidebar widget and popover.

Validate syntax before reloading:

```bash
node --check dsh/index.js
node --check dsh/client.js
```

> The `dsh-opencode-usage` package exposes two entry points (`./dsh/index.js` for the host, `./client` for the browser) and declares its DSH manifest (`dsh.bundle.patch`, `dsh.client`) in `package.json`.

---

## 🗂️ Project layout

```
dsh-opencode-usage/
├── package.json        # DSH manifest (dsh.bundle / dsh.client), exports
├── cordis.patch.yml    # bundle patch that mounts the plugin as "opencode-usage"
├── LICENSE             # MIT
├── README.md
└── dsh/
    ├── index.js        # host half: key discovery, upstream proxy, routes
    └── client.js       # client half: sidebar widget + usage popover
```

---

## 🧯 Troubleshooting

| Symptom | Cause / Fix |
| --- | --- |
| Widget not visible after install | Restart `dsh web`, then hard-refresh the browser (`Ctrl+Shift+R`). |
| Popover shows "no OPENCODE_API_KEY" | No key resolved. Set `OPENCODE_API_KEY` (or pass `config.apiKey`), or make sure OpenCode is signed in so auto-discovery finds a key. |
| Popover shows an upstream error (HTTP 5xx) | The OpenCode API rejected the request. Confirm the key is valid and still active; the proxy passes through the upstream message. |
| `GET /opencode-usage` returns `403` | The request came from a non-loopback / cross-site origin. The route intentionally answers same-origin loopback only. |

---

## 🙏 Acknowledgements

Built following the plugin authoring pattern of [`@liustack/modlens`](https://github.com/liustack/modlens) — hand-written lazy-CJS client bundles, host-side secret handling, and DSH's documented `sidebar.footer.action` slot.

---

## 📄 License

[MIT](LICENSE) © SyamStud
