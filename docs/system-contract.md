# Ama Monster OS system bridge v1

> Status: implemented by the hosted plugin; reserved for the future built-in app.
> Contract ID: `ama.system.bridge` · Version: `1.0.0` · API level: `1`

This document is the handoff contract between the Ama Monster OS shell and its
host. The hosted N.E.K.O plugin is the first provider. A future standalone
build must be able to supply the same contract without importing the N.E.K.O
plugin facade.

## 1. Boundary

```text
ui/panel.tsx                  presentation only; Hosted UI props
__init__.py                   N.E.K.O SDK facade
shell_runtime.py              host-free runtime; JSON in / JSON out
system_contract.py            protocol + manifest + validation
system_port.py                N.E.K.O adapter
DesktopSystemPort             future built-in adapter (not in this repo)
```

`AmaOsRuntime` and `system_contract.py` use only the Python standard library.
`shell_runtime.py` must stay free of N.E.K.O imports. If a change needs a host API, add it
to `SystemPort` rather than importing the host into the runtime.

## 2. SystemPort protocol

```python
class SystemPort(Protocol):
    provider_id: str
    mode: str
    capabilities: Sequence[str]

    def manifest(self) -> Mapping[str, Any]: ...
    async def environment(self) -> Mapping[str, Any]: ...
    async def activity(self) -> Mapping[str, Any] | None: ...
    async def search_web(self, query: str, max_results: int = 5) -> Mapping[str, Any]: ...
    async def search_game_prices(self, query: str, max_results: int = 3) -> Mapping[str, Any]: ...
    async def fetch_steam_deals(self, max_results: int = 6) -> Mapping[str, Any]: ...
    def record_event(self, name: str, detail: str = "") -> None: ...
    async def close(self) -> None: ...
```

### `environment()`

Return non-sensitive facts only. The shipped adapter returns:

```json
{
  "host": "N.E.K.O",
  "host_surface": "plugin-manager",
  "plugin_id": "ama_monster_os",
  "platform": "Windows",
  "os_release": "11",
  "python": "3.11.17",
  "sdk": "0.1.0"
}
```

Do not include usernames, hostnames, absolute paths, environment variables, or
raw window titles.

### `activity()`

Return privacy-filtered activity, or `None` on failure:

```json
{
  "available": true,
  "privacy": "visible",
  "category": "game",
  "idle_seconds": 4.2
}
```

Allowed `privacy` values: `visible`, `private`, `unavailable`. When the state is
`private`, `category` and `idle_seconds` MUST be omitted or `null`. A future host
must preserve this rule; the shell itself also drops them defensively.

### `search_web()`

Return a structured search result. The shipped adapter first calls the running
N.E.K.O `web_search` plugin and falls back to a fixed Bing RSS endpoint:

```json
{
  "ok": true,
  "available": true,
  "provider": "N.E.K.O web_search",
  "query": "N.E.K.O 插件开发",
  "count": 2,
  "results": [
    {
      "title": "开发指南",
      "url": "https://project-neko.online/zh-CN/guide",
      "snippet": "N.E.K.O. Docs...",
      "domain": "project-neko.online"
    }
  ],
  "fallback": false,
  "at": "2026-11-06T11:30:00Z"
}
```

Rules:

- Send only the query text. Do not auto-fetch a result URL, follow redirects
  recursively, or open a browser tab.
- Result URLs MUST be `http` or `https`; reject everything else.
- Treat titles/snippets as untrusted external text; strip HTML and clamp size.
- The fallback endpoint is fixed in code. Do not accept a user-supplied URL.
- `available: false` means the shell should show an offline state, not fake
  results.

### `search_game_prices()`

Return a game's current lowest price and all-time low. The shipped adapter uses
CheapShark and never asks for a Steam password:

```json
{
  "ok": true,
  "available": true,
  "provider": "CheapShark",
  "currency": "USD",
  "query": "Portal 2",
  "count": 1,
  "results": [
    {
      "game_id": "36",
      "steam_app_id": "620",
      "title": "Portal 2",
      "title_cn": "传送门2",
      "currency": "USD",
      "current": {
        "price": "9.99",
        "retail_price": "9.99",
        "savings_percent": 0,
        "store": "Steam"
      },
      "history": {
        "lowest": "0.99",
        "date": "2019-06-25",
        "currency": "USD"
      },
      "cn": {
        "available": true,
        "currency": "CNY",
        "price": "35.00",
        "initial": "35.00",
        "discount_percent": 0,
        "formatted": "¥ 35.00",
        "source": "Steam CN"
      },
      "gap_to_low": "+9.00",
      "is_at_low": false,
      "source": "CheapShark"
    }
  ]
}
```

Rules:

- Use a fixed price endpoint; do not accept an arbitrary URL.
- Require a non-empty Steam AppID on every result.
- Label currency explicitly. CheapShark is USD; do not present it as CNY or as
  an official Steam regional price.
- The `cn` object is the **current** Steam China store price in CNY from the
  official `appdetails` API (`cc=cn`). It is not a CN historical low.
- `title_cn` prefers a Steam `l=schinese` name containing CJK; for older English-
  only names a curated alias may be used. The UI shows the English `title` on
  top and the Chinese title directly underneath.
- The all-time low is CheapShark's cross-store record. Keep that attribution.
- Steam account linking is out of scope for this method. It is the reserved
  `steam.account` seam and must never store a password.

### `fetch_steam_deals()`

Return high-discount Steam picks. The shipped adapter uses CheapShark's fixed
deals endpoint, filters for at least 40% off and a 7/10 deal rating, then
enriches the top picks with historical lows:

```json
{
  "ok": true,
  "available": true,
  "provider": "CheapShark",
  "currency": "USD",
  "count": 1,
  "results": [
    {
      "steam_app_id": "49520",
      "title": "Borderlands 2",
      "title_cn": "无主之地2",
      "current": {"price": "1.99", "retail_price": "19.99", "savings_percent": 90, "store": "Steam"},
      "history": {"lowest": "1.99", "date": "2026-11-01", "currency": "USD"},
      "cn": {"available": true, "currency": "CNY", "price": "6.40", "formatted": "¥ 6.40", "discount_percent": 90, "source": "Steam CN"},
      "gap_to_low": "+0.00",
      "is_at_low": true,
      "hoard_worthy": true,
      "deal_rating": 9.5,
      "steam_percent": 90,
      "release_year": 2012,
      "store_url": "https://store.steampowered.com/app/49520/",
      "source": "CheapShark"
    }
  ]
}
```

Rules:

- Fixed deals endpoint; no arbitrary URL and no Steam password.
- `hoard_worthy` is the light-hearted **"可以不玩，但不能没有"** flag for
  80%+ off, a price at or below US$5, or a historical low.
- Recommendations are editorial sort order, not paid placements.
- Each result may include the current Steam China price as `cn`; it is current,
  not a CN historical low.
- Use `title_cn` for the Chinese display title and keep `title` for matching.
- The provider must not present CheapShark's cross-store low as an official
  Steam regional low.

The runtime also exposes a static `free_to_play` shelf from `steam_catalog.py`
with fixed Steam store links. It is a versioned snapshot, not a live full
catalogue of every free game.

### UI profile

The snapshot contains a validated `ui_profile` object. The same schema is used
by the Studio UI and the plugin persistence action:

```json
{
  "version": 1,
  "name": "Sakura",
  "brand": "Ama Monster OS",
  "glyph": "✦",
  "accent": "#e88aa8",
  "wallpaper": "dots",
  "radius": 16,
  "density": "comfortable",
  "theme": "light"
}
```

Rules:

- `accent` must be a six-digit hex colour.
- `wallpaper` is one of `grid`, `dots`, `aurora`, `stars`, `plain`.
- `density` is `comfortable` or `compact`; `theme` is `light` or `dark`.
- `radius` is clamped to 8–28; text fields are length-limited.
- The plugin writes `data/ui_profile.json` in its data folder through
  `ama_ui_profile_save`; no arbitrary CSS, HTML, or remote assets are accepted.
- Export envelopes use `{"format": "ama.ui.profile", "version": 1, "profile": {...}}`.
  Import accepts that envelope or a direct profile object.

### Sale calendar

The runtime adds `steam.sale` to the snapshot from
`steam_sales.evaluate_sales()`. It contains `current`, `next`,
`next_seasonal`, `upcoming`, and the source metadata. The calendar is a
versioned snapshot from Valve's Steamworks documentation, not a live feed:

- `updated`: capture date (`2026-11-07`)
- `source_url`: official Steamworks upcoming-events page
- dates from Valve are shown in Pacific Time; countdowns use the local clock
- `autumn_2027` is `TBD` and must not be used as a next event until dated

A future desktop build can reuse `steam_sales.py` directly; it has no host or
network dependency.

### `record_event()`

Best-effort host journal. It must never raise. A failing journal must not break
the window.

### `close()`

Release provider resources. Must be idempotent.

## 3. Manifest shape

`build_manifest()` produces the serialized contract:

```json
{
  "contract_id": "ama.system.bridge",
  "contract_version": "1.0.0",
  "schema_version": "1.0",
  "api_level": 1,
  "provider": "neko-plugin-host",
  "mode": "hosted-plugin",
  "capabilities": [
    "telemetry.environment",
    "activity.privacy",
    "actions.invoke",
    "events.record",
    "web.search",
    "steam.prices",
    "steam.deals"
  ],
  "reserved": [
    {
      "id": "window.native",
      "state": "reserved",
      "summary": "Native always-on-top shell window managed by the built-in app."
    }
  ],
  "entrypoints": {
    "context": "os_shell",
    "pulse": "ama_pulse",
    "web_search": "ama_web_search",
    "steam_search": "ama_steam_search",
    "steam_deals": "ama_steam_deals",
    "ui_profile": "ama_ui_profile_save",
    "contract": "ama_system_contract"
  }
}
```

The JSON Schema is at
[`system-contract.v1.schema.json`](system-contract.v1.schema.json).

Modes:

- `hosted-plugin` — the current N.E.K.O panel.
- `desktop-builtin` — reserved for the future application.

## 4. Reserved seams

| id | State | Meaning |
|----|-------|---------|
| `window.native` | reserved | Native always-on-top shell window. |
| `process.supervision` | reserved | Start/stop/health-check companion processes with consent. |
| `vault.storage` | reserved | User-scoped settings and secrets from the desktop vault. |
| `voice.pipeline` | reserved | Speech input/output handoff. |
| `web.fetch` | reserved | Read a specific page with an SSRF-safe URL policy and size limit. |
| `steam.account` | reserved | Steam OpenID or a user-supplied API key; never store passwords. |
| `module.registry` | reserved | Additional OS modules beyond the preview. |

A reserved seam is declared, not implemented. A provider must not advertise a
capability it cannot serve.

## 5. Future desktop integration sequence

1. Implement `DesktopSystemPort` in the desktop app.
2. Construct `AmaOsRuntime(DesktopSystemPort(...))`.
3. Call `await runtime.start()` when the app shell opens.
4. Render `runtime.snapshot()` in an equivalent shell view. The current TSX is
   written against the Hosted UI bridge; a desktop build can reuse the visual
   design, but must provide its own renderer or bundle.
5. Call `runtime.pulse()` for the pulse button, `runtime.search_web(query)` for
   the Web room, `runtime.search_game_prices(query)` for the Steam price room,
   `runtime.steam_deals()` for sale picks, `runtime.set_ui_profile(profile)` for
   the appearance studio, and `runtime.contract()` for the bridge page.
6. Call `await runtime.stop()` before exiting.
7. Keep `contract_version` at `1.0.0` for additions that do not break v1. Bump
   the major version and update the schema for breaking changes.

The hosted plugin's UI action and entries stay N.E.K.O-specific; the desktop
build does not need to expose them.

## 6. Compatibility rules

- Adding an optional snapshot key is non-breaking; removing or renaming one is
  breaking.
- New capabilities may be added to `capabilities`; consumers must ignore
  unknown capability strings.
- `reserved` entries may move from `reserved` to `implemented` by adding a new
  `state` value; do not reuse a reserved id for a different meaning.
- `mode` must be one of the declared modes.
- The shell must degrade safely when any port call raises or times out.

## 7. Verification

The shipped tests cover:

- manifest validation and reserved ids;
- `SystemPort` protocol conformance of the N.E.K.O adapter shape;
- private activity not leaking category/idle time;
- RSS parsing, URL validation, HTML stripping, and dotted-acronym query fallback;
- CheapShark normalization, historical-low date/price, and non-Steam filtering;
- Steam deal filtering, hoard-worthy flags, and free-to-play shelf links;
- Steam sale calendar current/next evaluation, local countdown inputs, and TBD handling;
- UI profile normalization, import envelope validation, and persistence path;
- runtime boot, pulse, web search, Steam price lookup, shutdown, and degraded-host behaviour;
- serializability of the complete snapshot.
