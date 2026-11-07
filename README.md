# N.E.K.O Ama Monster OS

> **0.1.0 Beta** · a NEKO-styled shell window for Project N.E.K.O, with live
> web search, a Steam price radar, and a versioned system bridge reserved for a
> future standalone build.

![Ama Monster OS shell preview](docs/preview.png)

This is the first window of **Ama Monster OS**, not a finished operating
system. It runs as a normal N.E.K.O Hosted TSX plugin and is honest about what
0.1.0 Beta contains.

## What is real in this version

- A working Hosted TSX window: cat-ear title bar, Home/Web/Steam/Core/Bridge/About
  views, minimize, expand, sleep/wake, day/moon theme, and responsive layout.
- A live snapshot from the plugin: uptime, boot count, bridge health, host
  platform, Python/SDK versions, and privacy-filtered activity.
- A **Web room** with live internet search, result cards, and links that open in
  the user's browser.
- A **Steam price room** with current lowest price, all-time low, low date,
  store, discount, and gap-to-low data from CheapShark (USD), plus the current
  **Steam China price in CNY** from Valve's store API.
- A **Steam sale picks** view with high-discount, well-rated games, historical
  lows, CN prices, and a playful **“可以不玩，但不能没有”** flag.
- A **free-to-play shelf** of permanently free Steam titles, versioned as a
  curated snapshot rather than a live catalogue.
- A **Pulse check** action that calls the Python plugin and refreshes the
  context through the real Hosted UI bridge.
- A stable, versioned contract (`ama.system.bridge` v1.0.0) and a `SystemPort`
  seam designed for the future built-in desktop app.
- Eight locales: `en`, `es`, `ja`, `ko`, `pt`, `ru`, `zh-CN`, `zh-TW`.

## Web search and internet access

The Web room uses a two-step provider chain:

1. **N.E.K.O `web_search`** when that built-in plugin is running. This keeps
   the host's regional engine choice, caching, and retry policy.
2. **Bing RSS fallback** using only the Python standard library when the host
   plugin is stopped or unavailable.

Only the query text leaves the plugin. The window never fetches an arbitrary
URL, never follows a result page automatically, and never opens a link without
a click. The fallback targets one fixed Bing RSS endpoint; result URLs are
validated as `http`/`https` before they are rendered. Opening a result uses the
official Hosted UI external-open bridge and leaves N.E.K.O for your browser.

![Ama Monster OS web search](docs/preview-web.png)

## Steam price radar

The Steam room searches by game title or numeric Steam AppID and enriches each
match with CheapShark price data:

- current lowest price and store
- all-time low and its date
- gap to the all-time low
- retail price and current discount
- **Steam China current price in CNY** (including its own discount)
- **Chinese game titles** for recommendations, preferring Steam's official
  Simplified Chinese name and falling back to curated aliases for older titles
- explicit **USD**, **CNY**, and **CheapShark cross-store** labeling

The CN price is a live current price from the official Steam Store API
(`cc=cn`). It is **not** a CN historical low: Valve does not publish a public
regional price-history API, and this build does not scrape SteamDB. The all-time
low remains CheapShark's cross-store USD record.

![Ama Monster OS Steam CN price](docs/preview-cn-price.png)

### Sale calendar

A sale radar above the search shows the current sale, the **next Steam event**,
the **next seasonal sale**, and local countdowns. The built-in calendar is
sourced from Valve's Steamworks schedule, captured **2026-11-07**:

| Event | Dates |
|-------|-------|
| Steam Auto-Battler RPG Fest 2026 | Nov 16–23, 2026 |
| Steam Winter Sale 2026 | Dec 17, 2026 – Jan 4, 2027 |
| Steam Spring Sale 2027 | Mar 18–25, 2027 |
| Steam Summer Sale 2027 | Jun 24 – Jul 8, 2027 |
| Steam Autumn Sale 2027 | TBD |

At the time of this build, the next event is **Auto-Battler RPG Fest** and the
next seasonal sale is **Winter Sale 2026**. The UI includes an **Official
schedule** link to Steamworks; Valve can change dates. Dates are shown in
Pacific Time (PT); countdowns use the viewer's local clock.

![Ama Monster OS sale radar](docs/preview-sale.png)

Sources:
[Steamworks Upcoming Events](https://partner.steamgames.com/doc/marketing/upcoming_events) ·
[Steam Winter Sale 2026](https://partner.steamgames.com/doc/marketing/upcoming_events/2026_winter_sale)

### 值得入手 / 免费即玩

The Steam room has two tabs:

- **价格查询** — the original title/AppID price-history search.
- **促销精选** — a live CheapShark picks list plus the curated free shelf.

Sale picks are filtered to at least **40% off** and a **7/10** CheapShark deal
rating, then enriched with historical lows, current **CNY** prices, and
**Chinese titles**. The top six show a **“可以不玩，但不能没有”** badge when they
are 80%+ off, at or below US$5, or at their all-time low. These are editorial
picks, not paid placements.

Chinese titles prefer the official Steam `l=schinese` name. Older games whose
Steam name stays English use a small curated alias map (for example
`Borderlands 2` → `无主之地2`, `Sid Meier's Civilization IV` → `文明4`). The
English original is always the main title, with the Chinese name directly
underneath.

The free shelf lists six **permanently free-to-play** titles with fixed Steam
store links. It is a versioned snapshot (updated **2026-11-07**), not a
limited-time giveaway tracker and not a live full catalogue.

![Ama Monster OS sale picks and free shelf](docs/preview-picks.png)

![Ama Monster OS free-to-play shelf](docs/preview-free.png)

**Steam account login is deliberately not enabled in 0.1.0 Beta.** This build
does not ask for a Steam password and does not put Steam's login page inside an
iframe. The account card says **Login deferred** instead of pretending to be
connected. A future safe integration can use Steam OpenID (browser redirect,
no password handled by the plugin) or a user-supplied Web API key.

The all-time low is CheapShark's cross-store record, not an official Steam
regional low. Steam Community and the Steam Store API were unreachable from the
test network, so they are not used.

## What is deliberately not here yet

- A general browser or arbitrary-URL reader. This is a search room, not an
  embedded Chromium.
- Steam account login, Steam library, achievements, or wallet.
- A live tracker for every limited-time free-to-keep giveaway. The free shelf is
  a versioned curated snapshot, not a claim of complete coverage.
- A CN historical-low database. The CN price is current only; Steam does not
  expose a public regional price-history API, and SteamDB is not scraped.
- Native windows, process control, filesystem access, voice pipeline.
- Real chat/memory/tool/style modules. They are shown as **Reserved**, not
  faked as working.
- Any Market publication. The repository owner publishes manually.

## Install and open the window

1. Open **N.E.K.O → Plugin Manager**.
2. Install the package through **Import**, or use **Developer mode → Load
   unpacked plugin** and point it at this repository folder.
3. Start **N.E.K.O Ama Monster OS**. Auto-start is off by design.
4. Open the plugin's **UI** tab and choose the **Ama Monster OS** panel.

The window chrome is part of the hosted surface. Minimize, expand, and sleep
only affect this panel; they never control the N.E.K.O application window.

## How the system bridge is shaped

```text
Hosted TSX panel (ui/panel.tsx)
        │  props.state / props.api.call
AmaMonsterOsPlugin (__init__.py)
        │
AmaOsRuntime (shell_runtime.py)  ← no N.E.K.O imports
        │
SystemPort (system_contract.py)
        ├── environment / activity
        ├── web.search
        ├── steam.prices
        └── events
        │
NekoHostSystemPort (system_port.py)   now
DesktopSystemPort                      future built-in app
```

The runtime and the JSON contract are host-free. A future desktop build only
implements `SystemPort`; the plugin facade and N.E.K.O adapter are not imported.

Read [docs/system-contract.md](docs/system-contract.md) for the exact protocol,
privacy rules, reserved seams, and integration sequence.

## Project layout

```text
ama_monster_os/
├── plugin.toml                 manifest and Hosted UI surfaces
├── __init__.py                 SDK facade, context, entries, lifecycle
├── shell_runtime.py            host-free shell runtime
├── steam_catalog.py            versioned free-to-play shelf
├── steam_sales.py              versioned Steam sale calendar
├── system_contract.py          contract v1 + SystemPort protocol
├── system_port.py              N.E.K.O adapter (read-only)
├── ui/panel.tsx                the NEKO-style window
├── docs/quickstart.md           user guide
├── docs/system-contract.md      future built-in integration guide
├── docs/system-contract.v1.schema.json
├── docs/preview.png             shell preview
├── docs/preview-web.png         web room preview
├── docs/preview-cn-price.png    Steam China current price preview
├── docs/preview-sale.png        Steam sale radar preview
├── docs/preview-picks.png       sale picks preview
├── docs/preview-free.png        free-to-play shelf preview
├── i18n/                       8 locale files
└── tests/                      contract, runtime, web, manifest, i18n, UI checks
```

## Development

From the N.E.K.O source checkout (replace the path with your clone):

```powershell
uv run neko-plugin check "<path-to-ama_monster_os>"
uv run neko-plugin check -r "<path-to-ama_monster_os>" --target-dir "<path-to-dist>"
```

Hosted TSX validation, from `frontend/plugin-manager`:

```powershell
node scripts/check-hosted-tsx.mjs "C:\path\to\N.E.K.O\plugin\plugins\ama_monster_os_check"
```

The checker requires the plugin to be inside the N.E.K.O repository. Copy it to
a temporary folder under `plugin/plugins/` for validation; do not symlink.

Run the Python tests directly:

```powershell
cd "<path-to-ama_monster_os>"
python -m pytest tests
```

See [PUBLISHING.md](PUBLISHING.md) for the owner-only Beta release steps. This
repository does not publish itself.

## Versioning and release

- Manifest version: `0.1.0-beta`
- Display version: **0.1.0 Beta**
- Release channel: **Beta**
- The user publishes manually. No tag, GitHub Release, or Market notification is
  created by this repository.

## Credits

Built for [Project N.E.K.O](https://github.com/Project-N-E-K-O/N.E.K.O).
N.E.K.O and its marks belong to their respective owners.
