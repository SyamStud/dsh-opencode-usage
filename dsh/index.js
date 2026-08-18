// Host half of dsh-opencode-usage.
//
// Keeps the API key off the page. The browser widget (dsh/client.js) only ever
// talks to a same-origin route on the dsh web server; this half holds the
// secret, resolves it once, and proxies to OpenCode's usage endpoint
// server-side. No CORS, no leaked key, graceful when the key or the web server
// is absent (headless/other profiles stay untouched).
//
// Minimal, zero-dependency: node built-ins + global fetch (node >= 18). No
// @deepseek-ai package imports, mirroring the host half of @liustack/modlens.
//
// The upstream endpoint is a GET that Cloudflare gates on a browser-like
// User-Agent, so the proxy sends one (the plain node fetch UA gets botted).

const UPSTREAM = 'https://opencode.ai/zen/go/v1/usage'
// Cloudflare (error 1010) refuses the default node/undici UA; a plain browser
// UA passes. The key is what authorizes; the UA only clears the CDN bot-check.
const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

import { homedir } from 'node:os'
import { readFileSync } from 'node:fs'

export const inject = ['webServer']

// Normalize the header time ("2026-08-16T..." etc.) to a short human string, or
// "" when missing — the browser renders whatever we pass through verbatim, so
// keep the raw value rather than guessing a format.
function passThrough(value) {
  return typeof value === 'string' ? value : ''
}

function isLoopbackHost(hostname) {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4 && parts[0] === '127' && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

// The same confused-deputy fence dsh puts in front of its own /api: answer only
// a loopback host that matches the request origin. The browser widget fetches
// same-origin, so it always passes; a third-party page on the machine does not.
function isTrustedRequest(req) {
  const host = req.headers?.host
  if (typeof host !== 'string' || host === '') return false
  let hostUrl
  try {
    hostUrl = new URL(`http://${host}`)
  } catch {
    return false
  }
  if (!isLoopbackHost(hostUrl.hostname)) return false
  if (req.headers?.['sec-fetch-site'] === 'cross-site') return false
  const origin = req.headers?.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

async function fetchUsage(apiKey) {
  const res = await fetch(UPSTREAM, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'user-agent': BROWSER_UA,
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  })
  const text = await res.text()
  return { status: res.status, text }
}

// Resolve the key, in priority order, without ever letting it reach the client:
//  1. cordis config  (config.apiKey)      — explicit override
//  2. environment    (OPENCODE_API_KEY)   — the documented contract
//  3. auto-discovery (OpenCode auth.json) — so the widget works out of the box
//     for a machine that already signs in to OpenCode (the opencode-go key is
//     the one that authorizes the /zen/go usage endpoint). Discovery reads the
//     key only on the host; it is never serialized into any route response.
function discoverKey(config) {
  if (typeof config.apiKey === 'string' && config.apiKey !== '') return config.apiKey
  const env =
    typeof process?.env?.OPENCODE_API_KEY === 'string' && process.env.OPENCODE_API_KEY !== ''
      ? process.env.OPENCODE_API_KEY
      : ''
  if (env) return env
  try {
    const home = process.env.HOME || homedir()
    const files = [
      `${home}/.local/share/opencode/auth.json`,
      `${home}/Library/Application Support/opencode/auth.json`,
      `${home}/AppData/Roaming/opencode/auth.json`,
    ]
    for (const file of files) {
      let raw
      try {
        raw = readFileSync(file, 'utf8')
      } catch {
        continue
      }
      const parsed = JSON.parse(raw)
      const key = parsed?.opencodeGo?.key || parsed?.['opencode-go']?.key
      if (typeof key === 'string' && key !== '') return key
    }
  } catch {
    // discovery is best-effort; fall through to the no-key path
  }
  return ''
}

export function apply(ctx, config = {}) {
  const apiKey = discoverKey(config)

  // webServer exists only under the web profile, and this cordis has no
  // optional-inject form, so the route rides a scoped ctx.inject: the closure
  // runs when the service appears and never runs where it does not (headless
  // stays untouched, and the plugin itself never waits on it).
  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], (scope) => {
      try {
        scope.webServer.register({
          name: 'opencode-usage',
          kind: 'exact',
          path: '/opencode-usage',
          handler: async (req, res) => {
            const send = (status, body) => {
              if (res.headersSent) return
              res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
              res.end(JSON.stringify(body))
            }
            if (!isTrustedRequest(req)) {
              send(403, { ok: false, error: 'request refused: this route answers same-origin loopback only' })
              return
            }
            if (req.method !== 'GET' && req.method !== 'POST') {
              send(405, { ok: false, error: 'method not allowed (GET or POST)' })
              return
            }
            // The upstream usage endpoint is a GET; an (optional) request body
            // is ignored. We never echo any key back to the page.
            if (req.method === 'POST') {
              // drain without buffering so the socket is reusable and nothing
              // waits on a body that is meaningless to this route.
              req.resume()
            }

            if (!apiKey) {
              send(200, {
                ok: false,
                error: 'no OPENCODE_API_KEY',
                hint: 'Set OPENCODE_API_KEY in the environment, or sign in to OpenCode (its auth.json is auto-discovered), then restart dsh web.',
              })
              return
            }

            try {
              const { status, text } = await fetchUsage(apiKey)
              let parsed = null
              try {
                parsed = JSON.parse(text)
              } catch {
                parsed = null
              }
              if (status >= 200 && status < 300) {
                // Republish only the shape the widget understands, so a
                // divergent upstream payload cannot smuggle anything onto the page.
                const usage = parsed?.usage
                send(200, {
                  ok: true,
                  usage: {
                    rolling: {
                      percent: usage?.rolling?.percent,
                      resetsAt: passThrough(usage?.rolling?.resetsAt),
                    },
                    weekly: {
                      percent: usage?.weekly?.percent,
                      resetsAt: passThrough(usage?.weekly?.resetsAt),
                    },
                    monthly: {
                      percent: usage?.monthly?.percent,
                      resetsAt: passThrough(usage?.monthly?.resetsAt),
                    },
                  },
                })
              } else {
                const message = parsed?.error || parsed?.message || text.slice(0, 300) || `upstream error (${status})`
                send(502, { ok: false, error: String(message), status })
              }
            } catch (error) {
              send(502, { ok: false, error: String(error?.message ?? error) })
            }
          },
        })
        scope.webServer.register({
          name: 'opencode-usage-probe',
          kind: 'exact',
          path: '/opencode-usage/probe',
          handler: async (req, res) => {
            const json = { ok: true, configured: Boolean(apiKey), upstream: UPSTREAM }
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify(json))
          },
        })
      } catch (error) {
        console.error('[opencode-usage] route registration skipped: ' + error)
      }
    })
  }
}
