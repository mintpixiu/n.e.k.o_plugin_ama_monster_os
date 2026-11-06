# N.E.K.O Ama Monster OS

> **0.1.0 Beta** · a NEKO-styled shell window for Project N.E.K.O, with a
> versioned system bridge reserved for a future standalone build.

![Ama Monster OS shell preview](docs/preview.png)

This is the first window of **Ama Monster OS**, not a finished operating
system. It runs as a normal N.E.K.O Hosted TSX plugin and is honest about what
0.1.0 Beta contains.

## What is real in this version

- A working Hosted TSX window: cat-ear title bar, Home/Core/Bridge/About views,
  minimize, expand, sleep/wake, day/moon theme, and responsive layout.
- A live snapshot from the plugin: uptime, boot count, bridge health, host
  platform, Python/SDK versions, and privacy-filtered activity.
- A **Pulse check** action that calls the Python plugin and refreshes the
  context through the real Hosted UI bridge.
- A stable, versioned contract (`ama.system.bridge` v1.0.0) and a `SystemPort`
  seam designed for the future built-in desktop app.
- Eight locales: `en`, `es`, `ja`, `ko`, `pt`, `ru`, `zh-CN`, `zh-TW`.

## What is deliberately not here yet

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
AmaOsRuntime (app.py)  ← no N.E.K.O imports
        │
SystemPort (system_contract.py)
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
├── app.py                      host-free shell runtime
├── system_contract.py          contract v1 + SystemPort protocol
├── system_port.py              N.E.K.O adapter (read-only)
├── ui/panel.tsx                the NEKO-style window
├── docs/quickstart.md           user guide
├── docs/system-contract.md      future built-in integration guide
├── docs/system-contract.v1.schema.json
├── i18n/                       8 locale files
└── tests/                      contract, runtime, manifest, i18n, UI checks
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
