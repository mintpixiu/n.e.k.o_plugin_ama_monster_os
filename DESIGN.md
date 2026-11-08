# Ama Monster OS Design Brief

## Identity Lock
- plugin_id: `ama_monster_os`
- folder: `ama_monster_os/`
- name: `N.E.K.O Ama Monster OS`
- entry: `plugin.plugins.ama_monster_os:AmaMonsterOsPlugin`
- main class: `AmaMonsterOsPlugin`
- version: `0.2.3-beta` (displayed as **0.2.3 Beta**)

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
- A curated, versioned free-to-play shelf with fixed Steam store links.
- A **UI Studio** with presets, accent colour, light/dark theme, **window background**, desktop backdrop pattern, radius, density, window title/glyph, a **2–30 colour gradient builder**, **Steam-style selection sounds with custom sound import**, live preview, persistent profile, and JSON import/export.
- A versioned Steam sale calendar snapshot sourced from Steamworks, with current/next event, next seasonal sale, local countdowns, and an official schedule link.
- A two-provider search chain: N.E.K.O `web_search` first, fixed Bing RSS fallback second.
- Steam account login is deliberately deferred; the UI says so and never asks for a password.
- Live, privacy-filtered bridge/telemetry snapshot from the plugin.
- A versioned system contract (`ama.system.bridge` v1.0.0) and documented `SystemPort` seam for the future built-in app.
- Eight locale files: `en`, `es`, `ja`, `ko`, `pt`, `ru`, `zh-CN`, `zh-TW`.

## Out of Scope

- A general browser or arbitrary-URL reader; only search is implemented.
- Steam account login, Steam library, achievements, or wallet in 0.2.3 Beta. Login is deferred until a safe OpenID/API path can be tested.
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
- state/config: read-only snapshot plus in-memory last search and price lookup; no persistent config in 0.2.3 Beta
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
- Steam account login is deferred because Steam Community/API are unreachable on
  the current network and passwords must never be collected by a plugin. The UI
  states this plainly; no fake login is included.
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
- Version `0.2.3-beta` is a pre-release; the user publishes manually with their
  own tag and Market confirmation.
