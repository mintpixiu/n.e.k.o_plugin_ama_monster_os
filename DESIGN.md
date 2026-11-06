# Ama Monster OS Design Brief

## Identity Lock
- plugin_id: `ama_monster_os`
- folder: `ama_monster_os/`
- name: `N.E.K.O Ama Monster OS`
- entry: `plugin.plugins.ama_monster_os:AmaMonsterOsPlugin`
- main class: `AmaMonsterOsPlugin`
- version: `0.1.0-beta` (displayed as **0.1.0 Beta**)

## Purpose

Give N.E.K.O a soft, catgirl-flavoured operating-system shell window, and make
the boundary between that window and a future standalone desktop build explicit
from the first version.

## Package Type and Capabilities
- package type: `plugin`
- capabilities: Hosted TSX panel, lifecycle hooks, one UI action, two callable entries, eight-locale i18n
- inferred architecture: thin SDK facade → host-free `AmaOsRuntime` → `SystemPort` → `NekoHostSystemPort`

## First Version Scope

- One real Hosted TSX window with title bar, sidebar navigation, Home/Core/Bridge/About views, minimize/expand/sleep states, and a working pulse action.
- Live, privacy-filtered bridge/telemetry snapshot from the plugin.
- A versioned system contract (`ama.system.bridge` v1.0.0) and documented `SystemPort` seam for the future built-in app.
- Eight locale files: `en`, `es`, `ja`, `ko`, `pt`, `ru`, `zh-CN`, `zh-TW`.

## Out of Scope

- Native desktop windows, process control, filesystem browsing, voice pipeline, real chat/memory/tool/style modules.
- Any claim that the preview is a complete operating system.
- Publishing to the N.E.K.O Market. The repository owner publishes manually.

## Inferred Technical Needs
- plugin.toml sections: `[plugin]`, `[plugin.author]`, `[plugin.sdk]`, `[plugin.i18n]`, `[plugin.ui]`, `[plugin_runtime]`
- SDK surfaces: `NekoPluginBase`, `neko_plugin`, `plugin_entry`, `lifecycle`, `tr`, `ui.context`, `ui.action`, `get_os_activity_snapshot`
- UI surfaces: one `panel` (`ui/panel.tsx`), one Markdown guide, one Markdown docs page
- state/config: read-only snapshot; no persistent config in 0.1.0 Beta
- lifecycle/background work: startup/shutdown only; no timers or background tasks
- external integrations: none; activity data comes from the host SDK's privacy-filtered snapshot

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
- Window chrome controls are presentation state inside one hosted panel; they
  do not control the N.E.K.O application window.
- Version `0.1.0-beta` is a pre-release; the user publishes manually with their
  own tag and Market confirmation.
