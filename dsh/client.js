// Browser half of dsh-opencode-usage: a sidebar-foot widget showing OpenCode
// usage as stacked progress bars.
//
// Registers into `sidebar.footer.action` — the documented third-party list
// seat "beside Settings at the sidebar foot" (kind: list, replaceRisk: none).
// The trigger is a compact icon+label button (icon-only in the 56px rail); a
// click opens a popover panel (anchored above, like the Cordis panel) with one
// bar per window: rolling, weekly, monthly.
//
// Data rides a same-origin route on the host ( /opencode-usage ): the browser
// never holds OPENCODE_API_KEY and never touches opencode.ai directly (CORS).
//
// Hand-written in the lazy-CJS bundle protocol (window.__ModuleLoader__.load
// with a factory returning cordis-plugin exports) — no build step, no imports
// from dsh client packages beyond the shell-own `react` and the shared
// primitives atoms. Same zero-dependency stance as @liustack/modlens.

window.__ModuleLoader__.load({
  id: 'dsh-opencode-usage',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    var RE = /\b(roll|weekly|month)/i

    function colorForPercent(percent) {
      if (typeof percent !== 'number' || Number.isNaN(percent)) return 'var(--dsw-alias-label-tertiary)'
      if (percent >= 90) return '#e5484d' // danger (red), theme-agnostic
      if (percent >= 70) return '#f5a524' // warn (amber)
      return 'var(--dsw-alias-accent-fill, #4f8cff)' // ok (default accent)
    }

    function gaugeIcon(react, size) {
      return react.createElement(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        react.createElement('path', { d: 'M4 14 A8 8 0 0 1 20 14' }),
        react.createElement('path', { d: 'M12 14 L15 9' }),
        react.createElement('path', { d: 'M4 16 v2 M8 17 v3 M12 17.5 v2.5 M16 17 v3 M20 16 v2' }),
      )
    }

    // Turn an ISO reset time into a short human relative string (e.g.
    // "resets in 5d 3h") instead of the raw timestamp the API returns.
    function formatResetsAt(iso) {
      if (typeof iso !== 'string' || iso === '') return ''
      var at = new Date(iso).getTime()
      if (Number.isNaN(at)) return iso // not parseable: show verbatim
      var mins = Math.round((at - Date.now()) / 60000)
      if (mins <= 0) return 'resets now'
      var days = Math.floor(mins / 1440)
      var hours = Math.floor((mins % 1440) / 60)
      var rest = mins % 60
      if (days > 0) return 'resets in ' + days + 'd ' + hours + 'h'
      if (hours > 0) return 'resets in ' + hours + 'h ' + rest + 'm'
      if (mins > 0) return 'resets in ' + mins + 'm'
      return 'resets soon'
    }

    function Bar(react, label, entry, accent) {
      var percent =
        typeof entry?.percent === 'number' && !Number.isNaN(entry.percent)
          ? Math.max(0, Math.min(100, entry.percent))
          : null
      var reset = formatResetsAt(entry && entry.resetsAt)
      return react.createElement(
        'div',
        { style: { marginBottom: '10px' } },
        react.createElement(
          'div',
          {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: '4px',
              gap: '8px',
            },
          },
          react.createElement(
            'span',
            { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } },
            label,
          ),
          react.createElement(
            'span',
            { style: { fontSize: '12px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } },
            percent === null ? '—' : percent.toFixed(0) + '%',
          ),
        ),
        react.createElement(
          'div',
          {
            style: {
              height: '7px',
              borderRadius: '4px',
              background: 'var(--dsw-alias-bg-layer-3, rgba(127,127,127,0.12))',
              overflow: 'hidden',
            },
          },
          react.createElement('div', {
            style: {
              height: '100%',
              width: percent === null ? '0%' : percent + '%',
              borderRadius: '4px',
              background: percent === null ? 'transparent' : accent(percent),
              transition: 'width .4s var(--ds-ease-in-out, ease)',
            },
          }),
        ),
        reset
          ? react.createElement(
              'div',
              { style: { marginTop: '3px', fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)' } },
              reset,
            )
          : null,
      )
    }

    function UsagePopup(react, state, pos) {
      var body
      if (state.phase === 'loading') {
        body = react.createElement(
          'p',
          { style: { margin: 0, padding: '6px 0', fontSize: '13px', color: 'var(--dsw-alias-label-tertiary)' } },
          'Loading usage…',
        )
      } else if (state.phase === 'no-key') {
        body = react.createElement(
          'p',
          { style: { margin: 0, padding: '6px 0', fontSize: '13px', lineHeight: 1.5 } },
          react.createElement('span', null, 'OPENCODE_API_KEY is not set. '),
          react.createElement(
            'span',
            { style: { color: 'var(--dsw-alias-label-tertiary)' } },
            'Export it before launching dsh web.',
          ),
        )
      } else if (state.phase === 'error') {
        body = react.createElement(
          'p',
          {
            role: 'alert',
            style: { margin: 0, padding: '6px 0', fontSize: '13px', lineHeight: 1.5, color: '#e5484d' },
          },
          String(state.error || 'Usage unavailable'),
        )
      } else {
        body = react.createElement(
          'div',
          null,
          Bar(react, 'Rolling', state.usage?.rolling, colorForPercent),
          Bar(react, 'Weekly', state.usage?.weekly, colorForPercent),
          Bar(react, 'Monthly', state.usage?.monthly, colorForPercent),
          react.createElement(
            'button',
            {
              type: 'button',
              onClick: state.onRefresh,
              style: {
                appearance: 'none',
                font: 'inherit',
                fontSize: '12px',
                lineHeight: 1.5,
                cursor: 'pointer',
                border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))',
                borderRadius: '7px',
                padding: '4px 12px',
                background: 'none',
                color: 'var(--dsw-alias-label-secondary)',
              },
            },
            'Refresh',
          ),
        )
      }
      return react.createElement(
        'section',
        {
          'aria-label': 'OpenCode usage',
          style: {
            position: 'fixed',
            left: (pos && pos.left) + 'px',
            bottom: (pos && pos.bottom) + 'px',
            zIndex: 2000,
            width: '248px',
            boxSizing: 'border-box',
            background: 'var(--dsw-alias-bg-layer-2, rgba(24,24,27,0.98))',
            border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))',
            borderRadius: '12px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.28)',
            padding: '12px 14px',
            color: 'var(--dsw-alias-label-primary)',
            font: '13px/1.5 inherit',
          },
        },
        react.createElement(
          'header',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
              fontSize: '13px',
              fontWeight: 600,
            },
          },
          gaugeIcon(react, 16),
          react.createElement('span', null, 'OpenCode Usage'),
        ),
        body,
      )
    }

    function makeWidget(react, dismissHook) {
      return function OpenCodeUsageWidget(props) {
        var wide = props && props.wide
        var state = react.useState({ phase: 'loading', usage: null, error: null })
        var usage = state[0]
        var setUsage = state[1]
        var openState = react.useState(false)
        var open = openState[0]
        var setOpen = openState[1]
        var anchorState = react.useState(null)
        var anchor = anchorState[0]
        var setAnchor = anchorState[1]
        var rootRef = react.useRef(null)
        var buttonRef = react.useRef(null)
        var mountedRef = react.useRef(true)
        var refreshToken = react.useState(0)
        var bump = refreshToken[1]

        react.useEffect(function () {
          mountedRef.current = true
          return function () {
            mountedRef.current = false
          }
        }, [])

        var load = function () {
          setUsage({ phase: 'loading', usage: null, error: null })
          fetch('/opencode-usage', { method: 'GET', headers: { accept: 'application/json' } })
            .then(function (res) {
              return res.json().catch(function () {
                return { ok: false, error: 'unparseable response (' + res.status + ')' }
              })
            })
            .then(function (data) {
              if (!mountedRef.current) return
              if (data && data.ok) {
                setUsage({ phase: 'ready', usage: data.usage || { rolling: {}, weekly: {}, monthly: {} }, error: null })
              } else if (data && /no OPENCODE_API_KEY/i.test(data.error || '')) {
                setUsage({ phase: 'no-key', usage: null, error: data.error })
              } else {
                setUsage({ phase: 'error', usage: null, error: (data && data.error) || 'usage unavailable' })
              }
            })
            .catch(function (error) {
              if (!mountedRef.current) return
              setUsage({ phase: 'error', usage: null, error: String(error && error.message ? error.message : error) })
            })
        }

        react.useEffect(function () {
          if (!open) return
          var placed = function () {
            var rect = buttonRef.current && buttonRef.current.getBoundingClientRect()
            if (rect && rect.width > 0) {
              setAnchor({ left: Math.max(8, rect.left), bottom: window.innerHeight - rect.top + 8 })
            }
          }
          placed()
          window.addEventListener('resize', placed)
          return function () {
            window.removeEventListener('resize', placed)
          }
        }, [open])

        react.useEffect(function () {
          if (open) load()
        }, [open, refreshToken[0]])

        dismissHook(rootRef, open, setOpen)

        var onRefresh = function () {
          bump(function (n) {
            return n + 1
          })
        }
        var popup =
          open && anchor
            ? UsagePopup(
                react,
                {
                  phase: usage.phase,
                  usage: usage.usage,
                  error: usage.error,
                  onRefresh: onRefresh,
                },
                anchor,
              )
            : null

        // Continue to the JSX-free tree below. The wrapper holds BOTH the button
        // and the popup so the dismiss hook (contains check) treats clicks inside
        // the popup as inside — while anchoring uses the button's own box (a
        // display:contents element has none, which is what put the popover
        // off-screen before).
        return react.createElement(
          'div',
          { ref: rootRef, style: { flex: 1, minWidth: 0, display: 'flex' } },
          popup,
          react.createElement(
            'button',
            {
              ref: buttonRef,
              type: 'button',
              'aria-label': 'OpenCode usage',
              'aria-expanded': open,
              onClick: function () {
                setOpen(function (v) {
                  return !v
                })
              },
              style: {
                boxSizing: 'border-box',
                cursor: 'pointer',
                width: wide ? '100%' : '36px',
                height: wide ? '42px' : '36px',
                color: 'var(--dsw-alias-label-primary)',
                background: 'none',
                border: 'none',
                borderRadius: wide ? '12px' : '50%',
                alignItems: 'center',
                justifyContent: wide ? 'flex-start' : 'center',
                gap: wide ? '8px' : '0',
                padding: wide ? '0 10px 0 8px' : '0',
                fontFamily: 'inherit',
                fontSize: '14px',
                lineHeight: '22px',
                display: 'flex',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                outline: 'none',
                boxShadow: 'none',
              },
              onMouseEnter: function (e) {
                e.currentTarget.style.background = 'var(--dsw-alias-interactive-bg-hover)'
              },
              onMouseLeave: function (e) {
                e.currentTarget.style.background = 'none'
              },
            },
            gaugeIcon(react, wide ? 16 : 18),
            wide
              ? react.createElement(
                  'span',
                  { style: { overflow: 'hidden', textOverflow: 'ellipsis' } },
                  'OpenCode Usage',
                )
              : null,
          ),
        )
      }
    }

    function mountWidget(ctx, react) {
      ctx.slots.inject('sidebar.footer.action', function* () {
        yield ctx.slots.register(
          { name: 'sidebar.footer.action', id: 'opencode-usage', order: 10, label: 'OpenCode Usage' },
          makeWidget(react, require('@deepseek-ai/dsh-client-ui-primitives').useDismissOnOutsidePointer),
        )
      })
    }

    function apply(ctx) {
      // `slots` is optional (only exists under the web sidebar); reach it via a
      // scoped inject so the plugin degrades gracefully elsewhere — same pattern
      // as modlens's settings card.
      if (typeof ctx.inject !== 'function') return
      ctx.inject(['slots'], function (scope) {
        try {
          var react = require('react')
          if (!react || typeof react.createElement !== 'function') throw new Error('react unavailable')
          mountWidget(scope, react)
        } catch (error) {
          console.error('[opencode-usage] sidebar widget skipped: ' + error)
        }
      })
    }

    exports.apply = apply
    // `slots` is optional here (checked in apply), so nothing is hard-injected.
    exports.inject = []
    return module.exports
  },
})
