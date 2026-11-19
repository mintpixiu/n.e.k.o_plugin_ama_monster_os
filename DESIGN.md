# Ama Monster OS Design Brief

## Identity Lock
- plugin_id: `ama_monster_os`
- folder: `ama_monster_os/`
- name: `N.E.K.O Ama Monster OS`
- entry: `plugin.plugins.ama_monster_os:AmaMonsterOsPlugin`
- main class: `AmaMonsterOsPlugin`
- version: `0.6.12` (displayed as **0.6.12**)

## Purpose

Give N.E.K.O a soft, catgirl-flavoured operating-system shell window, and make
the boundary between that window and a future standalone desktop build explicit
from the first version.

## Package Type and Capabilities
- package type: `plugin`
- capabilities: Hosted TSX panel, lifecycle hooks, one UI action, two callable entries, eight-locale i18n
- inferred architecture: thin SDK facade → host-free `AmaOsRuntime` (`shell_runtime.py`) → `SystemPort` → `NekoHostSystemPort`

## First Version Scope

- One real Hosted TSX window with title bar, sidebar navigation, Home/Web/Core/Bridge/About views, minimize/expand/sleep states, and a working pulse action.
- A Web room that performs live internet searches, shows sanitized results, and opens result links through the Hosted UI external-open bridge.
- A Steam price room using CheapShark for global current lowest price, all-time low, low date, gap, and discount; USD only for the global data.
- A Steam China current-price lookup from the official Steam Store API (`cc=cn`, CNY). It is explicitly current, not a CN historical low.
- A Steam sale-picks tab with high-discount, well-rated games, historical lows, CN prices, and Chinese titles shown underneath the English original.
- A curated Chinese-title map for older Steam games whose official `l=schinese` name remains English.
- A curated, versioned free-to-play shelf (18 titles in 3 rotating groups) with fixed Steam store links.
- Rotating sale-pick batches: a 60-deal candidate pool is filtered to ~50 titles and split into 10 groups, so refresh returns different games.
- A **UI Studio** with presets, accent colour, light/dark theme, **window background**, desktop backdrop pattern, radius, density, window title/glyph, a **2–30 colour gradient builder**, **Steam-style selection sounds with custom sound import**, live preview, persistent profile, and JSON import/export.
- An **offline Arknights operator codex** (81 entries) with class, rarity, faction, race and tags. Data is bundled text only: no official artwork, voice lines, story text or wiki copy, and no runtime fetching.
- **Five materials** — glass, metal, cream, ink, solid — controlled by `material`, `glass_blur` and `glass_alpha` in the UI profile. All are pure CSS (no remote assets, no injected styles).
- A **Token radar** for 10 providers and 20 models, using the public models.dev list-price catalog; it polls every 60 seconds, persists daily OHLC candles, and explicitly distinguishes DeepSeek peak/off-peak pricing from flat providers.
- A versioned Steam sale calendar snapshot sourced from Steamworks, with current/next event, next seasonal sale, local countdowns, and an official schedule link.
- A two-provider search chain: N.E.K.O `web_search` first, fixed Bing RSS fallback second.
- Steam sign-in through Steam OpenID with a loopback callback; the UI states the flow and never asks for a password. Steam++ (Watt Toolkit) acceleration is detected and surfaced.
- Live, privacy-filtered bridge/telemetry snapshot from the plugin.
- A versioned system contract (`ama.system.bridge` v1.0.0) and documented `SystemPort` seam for the future built-in app.
- Eight locale files: `en`, `es`, `ja`, `ko`, `pt`, `ru`, `zh-CN`, `zh-TW`.

## Visual Rules

- **Corners use continuous curvature (G2).** A plain `border-radius` joins a
  straight edge to a circular arc, so curvature jumps from 0 to `1/r` at the
  seam (tangent-continuous only, G1). Every rounded rectangle in the window —
  window, cards, panels, buttons, inputs, chips — is drawn as a superellipse
  instead: `corner-shape: squircle` keeps `border-radius` as the corner *size*
  and fills the same corner box with `superellipse(2)`, so curvature starts at
  zero and grows continuously into the edge. This is native box geometry, so
  borders, box-shadows, `backdrop-filter` and `overflow` clipping all follow the
  same curve. Implemented once in `ui/panel.tsx`; `--ui-corner-curve` is the
  single curve knob (`squircle` = `superellipse(2)`, `round` = `superellipse(1)`,
  `superellipse(1.5–1.8)` is softer, `superellipse(3–4)` flatter).
- **Continuous curvature is a system rule, not a UI Studio option.** The Studio
  radius slider (8–28 px) controls size only, so the `ama.ui.profile` schema,
  validation and locale files are unchanged.
- **Circles and pills stay round.** `50%`/pill `border-radius` shapes (dots,
  swatches, orbs, decorative glows, badges, spinners) are closed curves already;
  a superellipse would square them off instead of smoothing them, so they are
  explicitly reset to `corner-shape: round`. `tests/test_corners.py` parses
  `STYLES` and fails when a new circular or pill rule has no reset, and it also
  fails if any `corner-shape` declaration escapes the `@supports` block.
- **Graceful degradation.** Hosts without `corner-shape` (Firefox, Chromium <
  139, Safari < 26) ignore the whole guarded block and keep the previous
  circular arcs, so only the curve family changes, never the layout. The N.E.K.O
  host shipped with this release is Electron 41 / Chromium 146, so the hosted
  window gets the smooth corners natively. A pixel-identical G1 fallback would
  need JS-measured SVG paths and would break native borders, shadows,
  `backdrop-filter` and clipping, so it is deliberately not attempted.

## Out of Scope

- A general browser or arbitrary-URL reader; only search is implemented.
- Steam library, achievements, wallet, friends, or inventory in 0.6.12. Sign-in is limited to the public OpenID profile.
- Native desktop windows, process control, filesystem browsing, voice pipeline, real chat/memory/tool/style modules.
- Any claim that the preview is a complete operating system.
- Publishing to the N.E.K.O Market. The repository owner publishes manually.

## Inferred Technical Needs
- plugin.toml sections: `[plugin]`, `[plugin.author]`, `[plugin.sdk]`, `[plugin.i18n]`, `[plugin.ui]`, `[plugin_runtime]`
- SDK surfaces: `NekoPluginBase`, `neko_plugin`, `plugin_entry`, `lifecycle`, `tr`, `ui.context`, `ui.action`, `get_os_activity_snapshot`
- cross-plugin: `self.plugins.call_entry("web_search:search", ...)` when available
- network fallback: fixed Bing RSS URL through stdlib `urllib.request`, executed via `asyncio.to_thread`
- price data: fixed CheapShark API URLs through stdlib `urllib.request`; USD only
- CN current price: fixed Steam Store `appdetails` endpoint with `cc=cn` and `filters=price_overview`; CNY only
- sale picks: fixed CheapShark deals endpoint, filtered and enriched; no paid placement
- free shelf: versioned `steam_catalog.py` list of permanently free titles
- sale calendar: versioned `steam_sales.py` snapshot from Steamworks; dates shown in local time; Valve can change them
- UI profile: `ui_profile.py` schema, persisted to `data/ui_profile.json`, exported as `ama.ui.profile` JSON
- UI surfaces: one `panel` (`ui/panel.tsx`), one Markdown guide, one Markdown docs page
- state/config: read-only snapshot plus in-memory last search and price lookup; no persistent config in 0.6.12
- lifecycle/background work: startup/shutdown only; no timers or background tasks
- external integrations: N.E.K.O web search plugin, Bing RSS fallback, CheapShark price API

## Read Context Plan

N.E.K.O plugin docs (`docs/plugins/*`), plugin skill references, `plugin/sdk/plugin/*`,
`frontend/plugin-manager/src/components/plugin/hosted/*`, and existing Hosted TSX
plugins such as `lifekit` and `mcp_adapter`.

## Write Workspace
- Plugin repository root: `ama_monster_os/`
- No N.E.K.O platform files are modified.

## Risk Follow-ups

- Hosted TSX is compiled by N.E.K.O. A future standalone build must provide an
  equivalent renderer or rebuild this view; only the Python runtime and JSON
  contract are guaranteed reusable.
- `get_os_activity_snapshot` may be unavailable on older hosts; the adapter
  degrades to `unavailable` rather than failing the UI.
- Search depends on either the host `web_search` plugin or the fixed Bing RSS
  endpoint. Users may be offline or blocked by the search provider; the window
  reports that instead of fabricating results.
- The Bing fallback is intentionally limited to one fixed endpoint and does not
  follow result pages, which prevents arbitrary-URL SSRF but reduces quality
  compared with the host's multi-engine search.
- Steam sign-in is OpenID-only: `checkid_setup` in the browser, loopback
  callback, `check_authentication` verification. Passwords are never collected
  by the plugin. When `steamcommunity.com` is unreachable the card reports the
  Steam++ detection result instead of pretending to be connected.
- CheapShark prices are USD and its all-time low is cross-store, not an official
  Steam regional low. The UI carries both labels.
- Steam China prices are current prices in CNY from Valve's store API, not CN
  historical lows. No SteamDB scraping or password is used.
- Sale picks are editorial: discount and rating filters, not paid placements.
  The hoard flag is a joke, not a guarantee that a game is worth owning.
- The free shelf is a static snapshot of permanently free titles, not a
  limited-time giveaway tracker and not complete coverage.
- The UI Studio is declarative only: no arbitrary CSS, remote images, HTML, or
  executable content. Local PNG/JPG/WebP/GIF window images are read as bounded
  data URLs; profiles are validated server-side before persistence.
- The sale calendar is a static snapshot, not a live feed. It is marked with an
  update date and an official Steamworks link so users can verify changed dates.
- Window chrome controls are presentation state inside one hosted panel; they
  do not control the N.E.K.O application window.
- Version `0.6.12` is a Stable release; the user publishes manually with their
  own tag and Market confirmation.
